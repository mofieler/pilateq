/**
 * Studio membership helpers.
 *
 * These functions manage the many-to-many relationship between users and
 * studios introduced by the multi-tenant migration. They are intentionally
 * low-level and cache-free; callers (auth, middleware, UI) can layer caching
 * and session integration on top.
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  studioMemberships,
  studioInvites,
  type StudioMembership,
  type StudioMembershipRole,
  type NewStudioMembership,
} from '@/db/schema';

export class MembershipError extends Error {
  code = 'MEMBERSHIP_ERROR' as const;

  constructor(message = 'Membership error') {
    super(message);
    this.name = 'MembershipError';
  }
}

const ROLE_PRECEDENCE: Record<StudioMembershipRole, number> = {
  owner: 0,
  admin: 1,
  instructor: 2,
  student: 3,
};

/**
 * Fetch a single membership by user and studio.
 *
 * @returns The membership row, or `undefined` if none exists.
 */
export async function getMembership(
  userId: string,
  studioId: string,
): Promise<StudioMembership | undefined> {
  const [membership] = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.userId, userId),
        eq(studioMemberships.studioId, studioId),
      ),
    )
    .limit(1);

  return membership;
}

/**
 * Require an active membership with an optional role constraint.
 *
 * @throws MembershipError when the membership is missing, inactive, or the
 *   user's role is not in `allowedRoles`.
 */
export async function requireMembership(
  userId: string,
  studioId: string,
  allowedRoles?: StudioMembershipRole | StudioMembershipRole[],
): Promise<StudioMembership> {
  const membership = await getMembership(userId, studioId);

  if (!membership || membership.status !== 'active') {
    throw new MembershipError('Studio membership required');
  }

  if (allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(membership.role)) {
      throw new MembershipError('Insufficient studio role');
    }
  }

  return membership;
}

/**
 * Return every active membership for a user.
 */
export async function getUserMemberships(userId: string): Promise<StudioMembership[]> {
  return db
    .select()
    .from(studioMemberships)
    .where(and(eq(studioMemberships.userId, userId), eq(studioMemberships.status, 'active')))
    .orderBy(desc(studioMemberships.updatedAt));
}

/**
 * Pick the membership to use when no explicit studio is selected.
 *
 * Preference order: owner > admin > instructor > student, then most recently
 * updated. Returns `undefined` for users with no active memberships.
 */
export async function getActiveMembership(
  userId: string,
): Promise<StudioMembership | undefined> {
  const memberships = await getUserMemberships(userId);

  if (memberships.length === 0) {
    return undefined;
  }

  return memberships.sort((a, b) => {
    const precedenceDiff = ROLE_PRECEDENCE[a.role] - ROLE_PRECEDENCE[b.role];
    if (precedenceDiff !== 0) return precedenceDiff;
    return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
  })[0];
}

interface CreateMembershipInput {
  userId: string;
  studioId: string;
  role: StudioMembershipRole;
  invitedBy?: string;
}

/**
 * Create a new studio membership.
 *
 * Idempotent: if a membership already exists for the user/studio pair it is
 * updated with the requested role and marked active.
 */
export async function createMembership(
  input: CreateMembershipInput,
): Promise<StudioMembership> {
  const values: NewStudioMembership = {
    userId: input.userId,
    studioId: input.studioId,
    role: input.role,
    status: 'active',
    invitedByUserId: input.invitedBy,
    joinedAt: new Date(),
  };

  const [membership] = await db
    .insert(studioMemberships)
    .values(values)
    .onConflictDoUpdate({
      target: [studioMemberships.userId, studioMemberships.studioId],
      set: {
        role: values.role,
        status: 'active',
        invitedByUserId: values.invitedByUserId,
        joinedAt: values.joinedAt,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!membership) {
    throw new MembershipError('Failed to create membership');
  }

  return membership;
}

/**
 * Change a user's role within a studio.
 *
 * @throws MembershipError when the membership does not exist.
 */
export async function updateMembershipRole(
  userId: string,
  studioId: string,
  role: StudioMembershipRole,
): Promise<StudioMembership> {
  const membership = await getMembership(userId, studioId);

  if (!membership) {
    throw new MembershipError('Membership not found');
  }

  // Guard: ensure the studio keeps at least one owner when demoting the
  // current owner.
  if (membership.role === 'owner' && role !== 'owner') {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(studioMemberships)
      .where(
        and(
          eq(studioMemberships.studioId, studioId),
          eq(studioMemberships.role, 'owner'),
          eq(studioMemberships.status, 'active'),
        ),
      );

    if (count <= 1) {
      throw new MembershipError('Cannot remove the last owner of a studio');
    }
  }

  const [updated] = await db
    .update(studioMemberships)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(studioMemberships.userId, userId), eq(studioMemberships.studioId, studioId)))
    .returning();

  if (!updated) {
    throw new MembershipError('Failed to update membership role');
  }

  return updated;
}

/**
 * Remove a user's membership from a studio.
 *
 * Guards against removing the last active owner of a studio. Soft removal is
 * preferred in most flows (set status to 'cancelled'); this helper performs a
 * hard delete and should only be called when the row should genuinely disappear.
 */
export async function removeMembership(userId: string, studioId: string): Promise<void> {
  const membership = await getMembership(userId, studioId);

  if (!membership) {
    return;
  }

  if (membership.role === 'owner' && membership.status === 'active') {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(studioMemberships)
      .where(
        and(
          eq(studioMemberships.studioId, studioId),
          eq(studioMemberships.role, 'owner'),
          eq(studioMemberships.status, 'active'),
        ),
      );

    if (count <= 1) {
      throw new MembershipError('Cannot remove the last owner of a studio');
    }
  }

  await db
    .delete(studioMemberships)
    .where(and(eq(studioMemberships.userId, userId), eq(studioMemberships.studioId, studioId)));
}

/**
 * Check whether a user has an active membership with a specific role.
 */
export async function hasRole(
  userId: string,
  studioId: string,
  role: StudioMembershipRole | StudioMembershipRole[],
): Promise<boolean> {
  const membership = await getMembership(userId, studioId);

  if (!membership || membership.status !== 'active') {
    return false;
  }

  const roles = Array.isArray(role) ? role : [role];
  return roles.includes(membership.role);
}

// ─── Invite helpers (colocated for discoverability) ───────────────────────────

interface CreateInviteInput {
  studioId: string;
  email: string;
  role: StudioMembershipRole;
  tokenHash: string;
  invitedBy?: string;
  expiresAt: Date;
}

/**
 * Persist a studio invite token.
 */
export async function createStudioInvite(input: CreateInviteInput): Promise<{
  id: string;
  studioId: string;
  email: string;
  role: StudioMembershipRole;
  tokenHash: string;
  invitedByUserId: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}> {
  const [invite] = await db
    .insert(studioInvites)
    .values({
      studioId: input.studioId,
      email: input.email.toLowerCase(),
      role: input.role,
      tokenHash: input.tokenHash,
      invitedByUserId: input.invitedBy,
      expiresAt: input.expiresAt,
    })
    .returning();

  if (!invite) {
    throw new MembershipError('Failed to create studio invite');
  }

  return invite;
}

/**
 * Look up an invite by its token hash.
 */
export async function getStudioInviteByTokenHash(
  tokenHash: string,
): Promise<typeof studioInvites.$inferSelect | undefined> {
  const [invite] = await db
    .select()
    .from(studioInvites)
    .where(eq(studioInvites.tokenHash, tokenHash))
    .limit(1);

  return invite;
}

/**
 * Mark a studio invite as redeemed.
 */
export async function markStudioInviteUsed(
  inviteId: string,
  usedAt: Date = new Date(),
): Promise<void> {
  await db
    .update(studioInvites)
    .set({ usedAt, updatedAt: usedAt })
    .where(eq(studioInvites.id, inviteId));
}
