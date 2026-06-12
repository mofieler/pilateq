/**
 * Orphan Avatar Cleanup Script
 *
 * Scans the avatar storage directories and removes any .webp files
 * that are no longer referenced in the users table.
 *
 * Run manually:
 *   npx tsx scripts/cleanup-orphan-avatars.ts
 *
 * Or add to a cron job / CI pipeline for periodic cleanup.
 */

import { readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { db } from '../src/db';
import { users } from '../src/db/schema';
import { isNotNull } from 'drizzle-orm';

const STORAGE_DIR = join(process.cwd(), 'storage', 'avatars');
const FALLBACK_DIR = join(process.cwd(), 'public', 'avatars');

interface CleanupResult {
  scanned: number;
  orphaned: number;
  bytesReclaimed: number;
  errors: string[];
}

async function cleanupOrphanAvatars(): Promise<CleanupResult> {
  const result: CleanupResult = { scanned: 0, orphaned: 0, bytesReclaimed: 0, errors: [] };

  // Fetch all avatar URLs from the database
  const rows = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(isNotNull(users.avatarUrl));

  // Build a Set of valid filenames (full relative paths)
  const validPaths = new Set<string>();
  for (const row of rows) {
    if (row.avatarUrl) {
      // Store both /api/avatars/... and /avatars/... variants
      const urlPath = row.avatarUrl.replace(process.env.NEXT_PUBLIC_APP_URL ?? '', '');
      validPaths.add(urlPath);
      // Also store without leading slash for matching
      validPaths.add(urlPath.replace(/^\//, ''));
    }
  }

  async function scanDirectory(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Recurse into user subdirectories
          await scanDirectory(join(dir, entry.name));
        } else if (entry.name.endsWith('.webp')) {
          result.scanned++;

          const relativeToStorage = dir.replace(process.cwd() + '/', '').replace(/\\/g, '/');
          const relativePath = `/${relativeToStorage}/${entry.name}`;
          const altPath = relativePath.replace('/storage/avatars/', '/api/avatars/').replace('/public/avatars/', '/avatars/');

          const isReferenced =
            validPaths.has(relativePath) ||
            validPaths.has(relativePath.replace(/^\//, '')) ||
            validPaths.has(altPath) ||
            validPaths.has(altPath.replace(/^\//, ''));

          if (!isReferenced) {
            try {
              const fileStat = await stat(join(dir, entry.name));
              await unlink(join(dir, entry.name));
              result.orphaned++;
              result.bytesReclaimed += fileStat.size;
              console.log(`🗑️  Removed orphan: ${relativePath}`);
            } catch (err) {
              const msg = `Failed to delete ${relativePath}: ${err}`;
              result.errors.push(msg);
              console.error(msg);
            }
          }
        }
      }
    } catch {
      // Directory may not exist — ignore
    }
  }

  await scanDirectory(STORAGE_DIR);
  await scanDirectory(FALLBACK_DIR);

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('🔍 Scanning for orphan avatars...\n');

  const result = await cleanupOrphanAvatars();

  console.log('\n────────────────────────────────────────');
  console.log(`  Scanned:    ${result.scanned} files`);
  console.log(`  Orphans:    ${result.orphaned} files`);
  console.log(`  Reclaimed:  ${(result.bytesReclaimed / 1024 / 1024).toFixed(2)} MB`);
  if (result.errors.length > 0) {
    console.log(`  Errors:     ${result.errors.length}`);
  }
  console.log('────────────────────────────────────────');

  process.exit(0);
})();
