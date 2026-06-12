/**
 * Avatar upload pipeline (self-hosted filesystem version — no AWS S3 required).
 *
 * Best practices applied:
 * - Magic-number validation (not just extension/MIME trust)
 * - Sharp processing: resize 256×256, WebP, strip ALL metadata, high compression effort
 * - One avatar per user: old file is deleted before new one is saved
 * - Orphan cleanup script available at scripts/cleanup-orphan-avatars.ts
 * - Dual-path serving: primary (storage/) + fallback (public/)
 */

import { mkdir, writeFile, access, unlink, readdir } from 'fs/promises';
import { dirname, join } from 'path';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { APP_CONFIG } from '@/constants/APP_CONFIG';
import { getLogger } from '@/lib/logger';

const logger = getLogger('avatar-upload');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const OUTPUT_SIZE = 256;
const OUTPUT_QUALITY = 80;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureWritableDir(absolutePath: string): Promise<boolean> {
  try {
    await mkdir(absolutePath, { recursive: true });
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete an old avatar file from both possible storage locations.
 * Silently ignores errors (file may not exist).
 */
async function deleteOldAvatar(avatarUrl: string | null | undefined): Promise<void> {
  if (!avatarUrl) return;

  // Extract the relative path from the URL
  const urlPath = avatarUrl.replace(process.env.NEXT_PUBLIC_APP_URL ?? '', '');

  // Parse userId and filename from /api/avatars/{userId}/{filename} or /avatars/{userId}/{filename}
  const match = urlPath.match(/\/(?:api\/)?avatars\/([^/]+)\/(.+)$/);
  if (!match) return;

  const [, userId, filename] = match;

  const primaryPath = join(process.cwd(), 'storage', 'avatars', userId, filename);
  const fallbackPath = join(process.cwd(), 'public', 'avatars', userId, filename);

  await Promise.all([
    unlink(primaryPath).catch(() => {}),
    unlink(fallbackPath).catch(() => {}),
  ]);
}

/**
 * Remove all other .webp files in the user's avatar directory,
 * keeping only the current one. This is a safety net.
 */
async function cleanupUserAvatarDir(userId: string, keepFilename: string): Promise<void> {
  const dirs = [
    join(process.cwd(), 'storage', 'avatars', userId),
    join(process.cwd(), 'public', 'avatars', userId),
  ];

  for (const dir of dirs) {
    try {
      const entries = await readdir(dir);
      const oldFiles = entries.filter(
        (f) => f.endsWith('.webp') && f !== keepFilename,
      );
      await Promise.all(oldFiles.map((f) => unlink(join(dir, f)).catch(() => {})));
    } catch {
      // Directory may not exist — ignore
    }
  }
}

// Magic numbers for allowed image types
const MAGIC_NUMBERS: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
};

function detectMimeType(buffer: Buffer): string | null {
  for (const [mime, signature] of Object.entries(MAGIC_NUMBERS)) {
    if (signature.every((byte, i) => buffer[i] === byte)) {
      return mime;
    }
  }
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CropCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UploadAvatarResult {
  success: boolean;
  avatarUrl?: string;
  error?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function uploadAvatar(
  userId: string,
  fileBuffer: Buffer,
  claimedContentType: string,
  crop?: CropCoordinates,
): Promise<UploadAvatarResult> {
  // ── 1. Validate size ────────────────────────────────────────────────────────
  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    return { success: false, error: 'File too large. Maximum size is 5 MB.' };
  }

  // ── 2. Validate type by magic number ────────────────────────────────────────
  const detectedType = detectMimeType(fileBuffer);
  if (!detectedType || !APP_CONFIG.ALLOWED_IMAGE_TYPES.includes(detectedType as 'image/jpeg' | 'image/png' | 'image/webp')) {
    return { success: false, error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' };
  }

  // ── 3. Process with sharp ───────────────────────────────────────────────────
  let processedBuffer: Buffer;
  try {
    const sharp = (await import('sharp')).default;
    let image = sharp(fileBuffer).rotate();

    if (crop) {
      const metadata = await image.metadata();
      const metaWidth = metadata.width || 0;
      const metaHeight = metadata.height || 0;

      const left = Math.max(0, Math.round(crop.x));
      const top = Math.max(0, Math.round(crop.y));
      const width = Math.min(metaWidth - left, Math.round(crop.width));
      const height = Math.min(metaHeight - top, Math.round(crop.height));

      if (width > 0 && height > 0) {
        image = image.extract({ left, top, width, height });
      }
    }

    processedBuffer = await image
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'cover', position: 'centre' })
      .webp({
        quality: OUTPUT_QUALITY,
        effort: 6,           // Max compression effort (smaller file)
      })
      .toBuffer();
  } catch (err) {
    logger.error({ err }, 'Sharp processing failed');
    return { success: false, error: 'Failed to process image. Please try a different file.' };
  }

  // ── 4. Delete old avatar + save new one ─────────────────────────────────────
  const filename = `${Date.now()}.webp`;

  const primaryDir = join(process.cwd(), 'storage', 'avatars', userId);
  const primaryPath = join(primaryDir, filename);
  const primaryRelative = `/api/avatars/${userId}/${filename}`;

  const fallbackDir = join(process.cwd(), 'public', 'avatars', userId);
  const fallbackPath = join(fallbackDir, filename);
  const fallbackRelative = `/avatars/${userId}/${filename}`;

  let savedPath: string;
  let relativePath: string;

  const primaryWritable = await ensureWritableDir(primaryDir);
  if (primaryWritable) {
    savedPath = primaryPath;
    relativePath = primaryRelative;
  } else {
    const fallbackWritable = await ensureWritableDir(fallbackDir);
    if (!fallbackWritable) {
      logger.error('Neither storage/avatars/ nor public/avatars/ is writable');
      return { success: false, error: 'Avatar storage is not configured. Please contact support.' };
    }
    savedPath = fallbackPath;
    relativePath = fallbackRelative;
  }

  // Delete previous avatar(s) from DB + disk BEFORE writing the new file
  try {
    const [userRow] = await db
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    await deleteOldAvatar(userRow?.avatarUrl);
  } catch (err) {
    logger.warn({ err }, 'Failed to delete old avatar');
    // Non-fatal: continue with upload
  }

  try {
    await writeFile(savedPath, processedBuffer);
    logger.info({ savedPath, sizeBytes: processedBuffer.length }, 'Saved avatar');
  } catch (err) {
    logger.error({ err }, 'Filesystem write failed');
    return { success: false, error: 'Failed to save image. Please try again later.' };
  }

  // Safety net: remove any other .webp files in the user's directory
  await cleanupUserAvatarDir(userId, filename);

  // ── 5. Build public URL and update DB ───────────────────────────────────────
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
  const avatarUrl = baseUrl ? `${baseUrl}${relativePath}` : relativePath;

  try {
    await db
      .update(users)
      .set({ avatarUrl, image: avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, userId));
  } catch (err) {
    logger.error({ err }, 'DB update failed');
    return { success: false, error: 'Failed to save avatar. Please try again.' };
  }

  return { success: true, avatarUrl };
}

/**
 * Delete the user's current avatar from disk and clear the DB column.
 */
export async function deleteAvatar(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const [userRow] = await db
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    await deleteOldAvatar(userRow?.avatarUrl);

    await db
      .update(users)
      .set({ avatarUrl: null, image: null, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (err) {
    logger.error({ err }, 'avatar delete failed');
    return { success: false, error: 'Failed to remove avatar. Please try again.' };
  }
}
