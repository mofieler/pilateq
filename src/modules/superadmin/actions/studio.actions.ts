'use server';

import { z } from 'zod';
import { db } from '@/db';
import {
  studios,
  studioSettings,
  studioMemberships,
  users,
  verificationTokens,
  studioStatusEnum,
} from '@/db/schema';
import { requireSuperAdmin } from '@/lib/auth/action-auth';
import { eq, desc, isNull, and } from 'drizzle-orm';
import { parseStudioConfig, DEFAULT_STUDIO_CONFIG } from '@/lib/studio';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendVerificationEmail } from '@/lib/email/auth.emails';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

export interface StudioListItem {
  id: string;
  slug: string;
  name: string;
  status: string;
  ownerEmail: string | null;
  createdAt: Date;
}

export type StudioStatus = (typeof studioStatusEnum.enumValues)[number];

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

type CreateStudioResult =
  | { success: true; studioId: string; slug: string; ownerId: string }
  | { success: false; error: string; code?: string };

const createStudioSchema = z.object({
  name: z.string().min(1, 'Studio name is required').max(120),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'),
  ownerEmail: z.string().email('Invalid owner email'),
  ownerPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(255)
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export async function listStudiosAction(status?: StudioStatus, limit = 200) {
  await requireSuperAdmin();

  const rows = await db
    .select({
      studio: studios,
      ownerEmail: users.email,
    })
    .from(studios)
    .leftJoin(users, eq(studios.createdByUserId, users.id))
    .where(and(isNull(studios.deletedAt), status ? eq(studios.status, status) : undefined))
    .orderBy(desc(studios.createdAt))
    .limit(limit);

  const items: StudioListItem[] = rows.map((r) => ({
    id: r.studio.id,
    slug: r.studio.slug,
    name: r.studio.name,
    status: r.studio.status,
    ownerEmail: r.ownerEmail,
    createdAt: r.studio.createdAt,
  }));

  return { success: true, items };
}

export async function createStudioAction(input: unknown): Promise<CreateStudioResult> {
  const ctx = await requireSuperAdmin();
  const validated = createStudioSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { name, slug, ownerEmail, ownerPassword } = validated.data;
  const cleanSlug = sanitizeSlug(slug);
  if (!cleanSlug) {
    return { success: false, error: 'Invalid studio slug' };
  }

  const normalizedEmail = ownerEmail.toLowerCase().trim();
  const timezone = process.env.DEFAULT_STUDIO_TIMEZONE ?? DEFAULT_STUDIO_CONFIG.timezone ?? 'Europe/Berlin';

  const existingSlug = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.slug, cleanSlug))
    .limit(1)
    .then((rows) => rows[0]);

  if (existingSlug) {
    return { success: false, error: `The slug "${cleanSlug}" is already taken.`, code: 'SLUG_TAKEN' };
  }

  const existingEmail = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)
    .then((rows) => rows[0]);

  if (existingEmail) {
    return { success: false, error: 'A user with this email already exists.', code: 'EMAIL_EXISTS' };
  }

  const passwordHash = await bcrypt.hash(ownerPassword, 12);

  const result = await db.transaction(async (tx) => {
    const [studio] = await tx
      .insert(studios)
      .values({
        slug: cleanSlug,
        name,
        status: 'onboarding',
        timezone,
        defaultLocale: DEFAULT_STUDIO_CONFIG.defaultLocale ?? 'en',
      })
      .returning();

    await tx.insert(studioSettings).values({
      studioId: studio.id,
      configJson: parseStudioConfig({
        ...DEFAULT_STUDIO_CONFIG,
        identity: {
          ...DEFAULT_STUDIO_CONFIG.identity,
          name,
          slug: cleanSlug,
          email: normalizedEmail,
        },
      }) as unknown as Record<string, unknown>,
    });

    const localPart = normalizedEmail.split('@')[0] ?? 'Studio Admin';
    const ownerName = localPart
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .slice(0, 120);

    const [owner] = await tx
      .insert(users)
      .values({
        email: normalizedEmail,
        name: ownerName,
        passwordHash,
        role: 'admin',
        studioId: studio.id,
        emailVerified: null,
      })
      .returning();

    await tx.update(studios).set({ createdByUserId: owner.id }).where(eq(studios.id, studio.id));

    await tx.insert(studioMemberships).values({
      userId: owner.id,
      studioId: studio.id,
      role: 'owner',
      status: 'active',
      invitedByUserId: ctx.userId,
      joinedAt: new Date(),
    });

    return { studio, owner };
  });

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + APP_CONFIG.EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db.insert(verificationTokens).values({
    identifier: result.owner.email,
    token,
    expires,
  });

  sendVerificationEmail(result.owner.email, result.owner.name ?? 'Studio Admin', token).catch((err) =>
    console.error('[SUPERADMIN_CREATE_STUDIO] Failed to send verification email:', err),
  );

  return {
    success: true,
    studioId: result.studio.id,
    slug: cleanSlug,
    ownerId: result.owner.id,
  };
}

const updateStudioStatusSchema = z.object({
  status: z.enum(studioStatusEnum.enumValues as [StudioStatus, ...StudioStatus[]]),
});

export async function updateStudioStatusAction(studioId: string, status: string) {
  await requireSuperAdmin();

  const parsed = updateStudioStatusSchema.safeParse({ status });
  if (!parsed.success) {
    return { success: false, error: 'Invalid status' };
  }

  await db
    .update(studios)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(studios.id, studioId));

  return { success: true };
}
