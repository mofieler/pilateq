'use server';

import { z } from 'zod';
import { db } from '@/db';
import { duoInvites, bookings, users, classSessions, classTemplates } from '@/db/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { revalidatePath } from 'next/cache';
import type { ServiceResult } from '@/modules/billing/services/credit.service';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'admin') return null;
  return session;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type DuoInviteAdminItem = {
  id: string;
  status: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  organizerName: string;
  organizerEmail: string;
  partnerName: string | null;
  partnerEmail: string | null;
  sessionName: string;
  startsAt: Date;
};

export type DuoSessionAdminItem = {
  sessionId: string;
  sessionName: string;
  startsAt: Date;
  organizerName: string;
  organizerEmail: string;
  partnerName: string | null;
  partnerEmail: string | null;
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const cancelSchema = z.object({
  inviteId: z.string().uuid(),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getDuoInvitesForAdminAction(): Promise<ServiceResult<DuoInviteAdminItem[]>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const studioId = session.user.studioId;
  if (!studioId) return { success: false, error: 'No studio context.', code: 'UNAUTHORIZED' };

  try {
    const rows = await db
      .select({
        id: duoInvites.id,
        status: duoInvites.status,
        token: duoInvites.token,
        createdAt: duoInvites.createdAt,
        expiresAt: duoInvites.expiresAt,
        organizerName: users.name,
        organizerEmail: users.email,
        partnerName: sql<string | null>`CASE WHEN ${duoInvites.partnerUserId} IS NOT NULL THEN (SELECT ${users.name} FROM ${users} WHERE ${users.id} = ${duoInvites.partnerUserId}) END`,
        partnerEmail: sql<string | null>`CASE WHEN ${duoInvites.partnerUserId} IS NOT NULL THEN (SELECT ${users.email} FROM ${users} WHERE ${users.id} = ${duoInvites.partnerUserId}) END`,
        sessionName: classTemplates.name,
        startsAt: classSessions.startsAt,
      })
      .from(duoInvites)
      .innerJoin(bookings, eq(duoInvites.organizerBookingId, bookings.id))
      .innerJoin(users, eq(duoInvites.organizerUserId, users.id))
      .innerJoin(classSessions, eq(duoInvites.sessionId, classSessions.id))
      .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
      .where(
        and(
          eq(duoInvites.studioId, studioId),
          eq(bookings.studioId, studioId),
          eq(users.studioId, studioId),
          eq(classSessions.studioId, studioId),
          eq(classTemplates.studioId, studioId),
        ),
      )
      .orderBy(desc(duoInvites.createdAt))
      .limit(50);

    return { success: true, data: rows as DuoInviteAdminItem[] };
  } catch {
    return { success: false, error: 'Failed to fetch duo invites.', code: 'DB_ERROR' };
  }
}

export async function getUpcomingDuoSessionsAction(): Promise<ServiceResult<DuoSessionAdminItem[]>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const studioId = session.user.studioId;
  if (!studioId) return { success: false, error: 'No studio context.', code: 'UNAUTHORIZED' };

  try {
    const rows = await db
      .select({
        sessionId: classSessions.id,
        sessionName: classTemplates.name,
        startsAt: classSessions.startsAt,
        organizerName: users.name,
        organizerEmail: users.email,
        partnerName: sql<string | null>`(SELECT ${users.name} FROM ${users} WHERE ${users.id} = ${duoInvites.partnerUserId})`,
        partnerEmail: sql<string | null>`(SELECT ${users.email} FROM ${users} WHERE ${users.id} = ${duoInvites.partnerUserId})`,
      })
      .from(duoInvites)
      .innerJoin(bookings, eq(duoInvites.organizerBookingId, bookings.id))
      .innerJoin(users, eq(duoInvites.organizerUserId, users.id))
      .innerJoin(classSessions, eq(duoInvites.sessionId, classSessions.id))
      .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
      .where(
        and(
          gte(classSessions.startsAt, new Date()),
          eq(duoInvites.status, 'accepted'),
          eq(duoInvites.studioId, studioId),
          eq(bookings.studioId, studioId),
          eq(users.studioId, studioId),
          eq(classSessions.studioId, studioId),
          eq(classTemplates.studioId, studioId),
        ),
      )
      .orderBy(classSessions.startsAt)
      .limit(50);

    return { success: true, data: rows as DuoSessionAdminItem[] };
  } catch {
    return { success: false, error: 'Failed to fetch duo sessions.', code: 'DB_ERROR' };
  }
}

export async function cancelDuoInviteAction(
  input: z.infer<typeof cancelSchema>,
): Promise<ServiceResult<null>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const studioId = session.user.studioId;
  if (!studioId) return { success: false, error: 'No studio context.', code: 'UNAUTHORIZED' };

  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input.', code: 'INVALID_STATE' };

  try {
    const [invite] = await db
      .select({
        id: duoInvites.id,
        status: duoInvites.status,
        partnerBookingId: duoInvites.partnerBookingId,
        sessionId: duoInvites.sessionId,
      })
      .from(duoInvites)
      .where(and(eq(duoInvites.id, parsed.data.inviteId), eq(duoInvites.studioId, studioId)))
      .limit(1);

    if (!invite) return { success: false, error: 'Invite not found.', code: 'NOT_FOUND' };
    if (invite.status !== 'pending') return { success: false, error: 'Only pending invites can be cancelled.', code: 'INVALID_STATE' };

    await db.transaction(async (tx) => {
      // Mark invite as cancelled
      await tx
        .update(duoInvites)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(duoInvites.id, invite.id), eq(duoInvites.studioId, studioId)));

      // Decrement session booked count since the reserved spot is released
      const [session] = await tx
        .select({ bookedCount: classSessions.bookedCount })
        .from(classSessions)
        .where(and(eq(classSessions.id, invite.sessionId), eq(classSessions.studioId, studioId)))
        .limit(1);

      if (session && session.bookedCount > 0) {
        await tx
          .update(classSessions)
          .set({ bookedCount: session.bookedCount - 1, updatedAt: new Date() })
          .where(and(eq(classSessions.id, invite.sessionId), eq(classSessions.studioId, studioId)));
      }
    });

    revalidatePath('/admin');
    return { success: true, data: null };
  } catch {
    return { success: false, error: 'Failed to cancel invite.', code: 'DB_ERROR' };
  }
}
