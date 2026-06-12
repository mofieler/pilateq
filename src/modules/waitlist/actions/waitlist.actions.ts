'use server';

import { auth } from '@/lib/auth/auth';
import { db } from '@/db';
import { waitlistEntries, classSessions, classTemplates, instructors, users } from '@/db/schema';
import { and, eq, isNull, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { revalidatePath } from 'next/cache';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WaitlistEntry {
  id: string;
  position: number;
  status: 'waiting' | 'offered' | 'confirmed' | 'expired' | 'cancelled';
  offeredAt: Date | null;
  offerExpiresAt: Date | null;
  sessionId: string;
  className: string;
  classType: string;
  startsAt: Date;
  durationMinutes: number;
  location: string | null;
  instructorName: string | null;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getMyWaitlistEntries(): Promise<WaitlistEntry[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const studioId = session.user.studioId;
  if (!studioId) return [];

  const instructorUser = alias(users, 'instructor_user');

  const rows = await db
    .select({
      id: waitlistEntries.id,
      position: waitlistEntries.position,
      status: waitlistEntries.status,
      offeredAt: waitlistEntries.offeredAt,
      offerExpiresAt: waitlistEntries.offerExpiresAt,
      sessionId: classSessions.id,
      className: classTemplates.name,
      classType: classTemplates.classType,
      startsAt: classSessions.startsAt,
      durationMinutes: classTemplates.durationMinutes,
      location: classTemplates.location,
      instructorName: instructorUser.name,
    })
    .from(waitlistEntries)
    .innerJoin(classSessions, eq(waitlistEntries.sessionId, classSessions.id))
    .leftJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
    .leftJoin(instructors, eq(classSessions.instructorId, instructors.id))
    .leftJoin(instructorUser, and(
      eq(instructors.userId, instructorUser.id),
      isNull(instructorUser.deletedAt),
    ))
    .where(
      and(
        eq(waitlistEntries.userId, session.user.id),
        eq(waitlistEntries.studioId, studioId),
        eq(classSessions.studioId, studioId),
        // Only show active + offered entries (not expired/cancelled/confirmed)
        // Confirmed entries become bookings, so they don't appear here
      ),
    )
    .orderBy(asc(classSessions.startsAt));

  const now = new Date();

  return rows
    .filter((r) => r.status === 'waiting' || r.status === 'offered')
    .filter((r) => r.startsAt > now) // hide past sessions
    .map((r) => ({
      id: r.id,
      position: r.position,
      status: r.status as WaitlistEntry['status'],
      offeredAt: r.offeredAt,
      offerExpiresAt: r.offerExpiresAt,
      sessionId: r.sessionId,
      className: r.className ?? 'Unnamed Class',
      classType: r.classType ?? 'mat_group',
      startsAt: r.startsAt,
      durationMinutes: r.durationMinutes ?? 60,
      location: r.location ?? null,
      instructorName: r.instructorName ?? null,
    }));
}

// ─── Leave Waitlist ───────────────────────────────────────────────────────────

export async function leaveWaitlistAction(
  waitlistEntryId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' };

  const studioId = session.user.studioId;
  if (!studioId) return { success: false, error: 'No studio context' };

  try {
    // Validate: entry must belong to this user and be in a cancellable state
    const entry = await db
      .select({ userId: waitlistEntries.userId, status: waitlistEntries.status })
      .from(waitlistEntries)
      .where(and(eq(waitlistEntries.id, waitlistEntryId), eq(waitlistEntries.studioId, studioId)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!entry) return { success: false, error: 'Waitlist entry not found.' };
    if (entry.userId !== session.user.id) return { success: false, error: 'Not authorized.' };
    if (entry.status === 'confirmed') return { success: false, error: 'Already confirmed — cancel your booking instead.' };

    await db
      .update(waitlistEntries)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(
        and(
          eq(waitlistEntries.id, waitlistEntryId),
          eq(waitlistEntries.userId, session.user.id),
          eq(waitlistEntries.studioId, studioId),
        ),
      );

    revalidatePath('/bookings');
    return { success: true };
  } catch (err) {
    console.error('[leaveWaitlistAction]', err);
    return { success: false, error: 'Failed to leave waitlist. Please try again.' };
  }
}
