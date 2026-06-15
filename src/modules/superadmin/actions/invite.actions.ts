'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { db } from '@/db';
import { studioClaimInvites, users } from '@/db/schema';
import { requireSuperAdmin } from '@/lib/auth/action-auth';
import { resolveClientIP } from '@/lib/security/client-ip';
import {
  checkRateLimit,
  superadminInviteRateLimitConfig,
  inviteAcceptRateLimitConfig,
} from '@/lib/security/server-action-rate-limiter';
import {
  generateStudioInviteToken,
  hashInviteToken,
} from '@/lib/superadmin/invite-tokens';
import { sendStudioInviteEmail } from '@/lib/email/invite.emails';
import { eq, desc, inArray, and, isNull } from 'drizzle-orm';

const INVITE_EXPIRY_HOURS = 7 * 24; // 1 week

type CreateStudioInviteResult =
  | { success: true; inviteId: string; link: string; expiresAt: Date }
  | { success: false; error: string };

type RevokeInviteResult = { success: true } | { success: false; error: string };

const createInviteSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  studioSlug: z
    .string()
    .regex(/^[a-z0-9-]*$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
    .max(63)
    .optional(),
  notes: z.string().max(500).optional(),
});

export interface InviteListItem {
  id: string;
  email: string | null;
  studioSlug: string | null;
  notes: string | null;
  status: 'pending' | 'used' | 'expired';
  invitedByName: string;
  usedByEmail: string | null;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

function buildInviteLink(rawToken: string): string {
  if (process.env.APP_URL) {
    return `${process.env.APP_URL}/start?invite=${rawToken}`;
  }
  if (process.env.NEXT_PUBLIC_PLATFORM_DOMAIN) {
    return `https://${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN}/start?invite=${rawToken}`;
  }
  console.warn(
    '[SUPERADMIN_INVITE] APP_URL and NEXT_PUBLIC_PLATFORM_DOMAIN are both missing; invite link will be invalid.',
  );
  return `https://__missing_platform_domain__/start?invite=${rawToken}`;
}

export async function createStudioInviteAction(input: unknown): Promise<CreateStudioInviteResult> {
  const ctx = await requireSuperAdmin();
  const validated = createInviteSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? 'Invalid input' };
  }

  const rateLimit = await checkRateLimit(superadminInviteRateLimitConfig, ctx.userId);
  if (!rateLimit.success) {
    return { success: false, error: 'Too many invites. Please try again later.' };
  }

  const email = validated.data.email?.trim().toLowerCase() || null;
  const studioSlug = validated.data.studioSlug?.trim().toLowerCase() || null;
  const notes = validated.data.notes?.trim() || null;

  const { raw, hash } = generateStudioInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

  const [invite] = await db
    .insert(studioClaimInvites)
    .values({
      tokenHash: hash,
      email,
      studioSlug,
      notes,
      invitedByUserId: ctx.userId,
      expiresAt,
    })
    .returning({ id: studioClaimInvites.id });

  if (email) {
    sendStudioInviteEmail(email, email.split('@')[0] ?? 'Studio Owner', raw).catch((err) => {
      console.error('[SUPERADMIN_INVITE] Failed to send invite email:', err);
    });
  }

  return {
    success: true,
    inviteId: invite.id,
    link: buildInviteLink(raw),
    expiresAt,
  };
}

export async function listInvitesAction(status?: 'pending' | 'used' | 'expired') {
  await requireSuperAdmin();

  const now = new Date();

  const rows = await db
    .select({
      invite: studioClaimInvites,
      invitedByName: users.name,
    })
    .from(studioClaimInvites)
    .leftJoin(users, eq(studioClaimInvites.invitedByUserId, users.id))
    .orderBy(desc(studioClaimInvites.createdAt))
    .limit(200);

  const usedByUserIds = rows
    .map((r) => r.invite.usedByUserId)
    .filter(Boolean) as string[];

  const usedByMap = new Map<string, string>();
  if (usedByUserIds.length > 0) {
    const userRows = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.id, usedByUserIds));
    for (const u of userRows) {
      if (u.id) usedByMap.set(u.id, u.email);
    }
  }

  const items: InviteListItem[] = [];
  for (const row of rows) {
    const invite = row.invite;
    let statusComputed: InviteListItem['status'] = 'pending';
    if (invite.usedAt) {
      statusComputed = 'used';
    } else if (invite.expiresAt < now) {
      statusComputed = 'expired';
    }

    if (status && statusComputed !== status) continue;

    const usedByEmail = invite.usedByUserId
      ? (usedByMap.get(invite.usedByUserId) ?? null)
      : null;

    items.push({
      id: invite.id,
      email: invite.email,
      studioSlug: invite.studioSlug,
      notes: invite.notes,
      status: statusComputed,
      invitedByName: row.invitedByName ?? 'Unknown',
      usedByEmail,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      usedAt: invite.usedAt,
    });
  }

  return { success: true, items };
}

export async function revokeInviteAction(inviteId: string): Promise<RevokeInviteResult> {
  await requireSuperAdmin();

  const result = await db
    .update(studioClaimInvites)
    .set({
      expiresAt: new Date(0), // force expired
      updatedAt: new Date(),
    })
    .where(and(eq(studioClaimInvites.id, inviteId), isNull(studioClaimInvites.usedAt)))
    .returning({ id: studioClaimInvites.id });

  if (result.length === 0) {
    return { success: false, error: 'Invite not found or already used.' };
  }

  return { success: true };
}

export async function validateInviteTokenAction(rawToken: string) {
  if (!rawToken || rawToken.length > 128) {
    return { success: false, error: 'Invalid invite token.' };
  }

  const headersList = await headers();
  const clientIp = resolveClientIP(headersList);
  const rateLimit = await checkRateLimit(inviteAcceptRateLimitConfig, clientIp);
  if (!rateLimit.success) {
    return { success: false, error: 'Too many attempts. Please try again later.' };
  }

  const hash = hashInviteToken(rawToken);
  const [invite] = await db
    .select()
    .from(studioClaimInvites)
    .where(eq(studioClaimInvites.tokenHash, hash))
    .limit(1);

  if (!invite) {
    return { success: false, error: 'Invalid invite token.', code: 'INVALID_INVITE' };
  }

  if (invite.usedAt) {
    return { success: false, error: 'Invite has already been used.', code: 'INVITE_USED' };
  }

  if (invite.expiresAt < new Date()) {
    return { success: false, error: 'Invite has expired.', code: 'INVITE_EXPIRED' };
  }

  return {
    success: true,
    email: invite.email,
    studioSlug: invite.studioSlug,
  };
}
