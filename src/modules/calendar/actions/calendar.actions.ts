'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { db } from '@/db';
import { calendarConnections } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  disconnect as disconnectCalendar,
} from '../services/calendar-oauth.service';
import { listAccessibleCalendars } from '../services/google-calendar.client';
import { listActiveConnections, pullBlocks } from '../services/calendar-sync.service';

async function requireAdminOrInstructor() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const role = session.user.role as string | undefined;
  if (role !== 'admin' && role !== 'instructor') throw new Error('Forbidden');
  const studioId = session.user.studioId;
  if (!studioId) throw new Error('No studio context');
  return { userId: session.user.id, role, studioId };
}

export async function listMyCalendars() {
  const { userId, studioId } = await requireAdminOrInstructor();
  const [conn] = await db
    .select()
    .from(calendarConnections)
    .where(and(eq(calendarConnections.userId, userId), eq(calendarConnections.studioId, studioId)))
    .limit(1);
  if (!conn) return { connected: false as const };

  try {
    const calendars = await listAccessibleCalendars(conn);
    return {
      connected: true as const,
      calendars,
      selectedCalendarId: conn.selectedCalendarId,
    };
  } catch (err) {
    return {
      connected: true as const,
      calendars: [],
      selectedCalendarId: conn.selectedCalendarId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

const selectCalendarSchema = z.object({
  calendarId: z.string().min(1),
  calendarName: z.string().min(1).max(255),
});

export async function selectCalendar(input: z.infer<typeof selectCalendarSchema>) {
  const { userId, studioId } = await requireAdminOrInstructor();
  const parsed = selectCalendarSchema.parse(input);

  const [conn] = await db
    .select()
    .from(calendarConnections)
    .where(and(eq(calendarConnections.userId, userId), eq(calendarConnections.studioId, studioId)))
    .limit(1);
  if (!conn) {
    return { success: false as const, error: 'No active connection' };
  }

  // Verify the picked calendar is actually one the user has access to.
  // Without this, a crafted request could store an arbitrary calendar ID.
  let accessible: Awaited<ReturnType<typeof listAccessibleCalendars>>;
  try {
    accessible = await listAccessibleCalendars(conn);
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Could not verify calendar access',
    };
  }
  const match = accessible.find((c) => c.id === parsed.calendarId);
  if (!match) {
    return { success: false as const, error: 'Calendar not accessible with this account' };
  }

  await db
    .update(calendarConnections)
    .set({
      selectedCalendarId: match.id,
      selectedCalendarName: match.summary,
      // Reset incremental sync token — calendar changed, do a full re-sync next.
      lastPullSyncToken: null,
      lastSyncError: null,
      updatedAt: new Date(),
    })
    .where(and(eq(calendarConnections.id, conn.id), eq(calendarConnections.studioId, studioId)));

  revalidatePath('/admin/calendar-sync');
  return { success: true as const };
}

export async function disconnectMyCalendar() {
  const { userId, studioId } = await requireAdminOrInstructor();
  await disconnectCalendar(userId, studioId);
  revalidatePath('/admin/calendar-sync');
  return { success: true as const };
}

export async function syncNow() {
  const { userId, studioId } = await requireAdminOrInstructor();
  const [conn] = await db
    .select()
    .from(calendarConnections)
    .where(
      and(
        eq(calendarConnections.userId, userId),
        eq(calendarConnections.studioId, studioId),
        eq(calendarConnections.syncEnabled, true),
      ),
    )
    .limit(1);

  if (!conn || !conn.selectedCalendarId) {
    return { success: false as const, error: 'No connected calendar selected.' };
  }

  try {
    const result = await pullBlocks(conn);
    await db
      .update(calendarConnections)
      .set({
        lastSyncAt: new Date(),
        lastPullSyncToken: result.nextSyncToken,
        lastSyncError: null,
      })
      .where(and(eq(calendarConnections.id, conn.id), eq(calendarConnections.studioId, studioId)));

    revalidatePath('/admin/calendar-sync');
    return {
      success: true as const,
      added: result.added,
      updated: result.updated,
      removed: result.removed,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(calendarConnections)
      .set({ lastSyncError: message.slice(0, 500) })
      .where(and(eq(calendarConnections.id, conn.id), eq(calendarConnections.studioId, studioId)));
    return { success: false as const, error: message };
  }
}

/**
 * Admin-only — sync ALL connections (every instructor that has connected).
 * Used by the "Sync everyone" button on the admin page.
 */
export async function syncAllConnections() {
  const { role, studioId } = await requireAdminOrInstructor();
  if (role !== 'admin') throw new Error('Forbidden: admin only');

  const conns = await listActiveConnections(studioId);
  const results: Array<{ connectionId: string; ok: boolean; error?: string }> = [];
  for (const conn of conns) {
    if (!conn.selectedCalendarId) {
      results.push({ connectionId: conn.id, ok: false, error: 'No calendar selected' });
      continue;
    }
    try {
      const r = await pullBlocks(conn);
      await db
        .update(calendarConnections)
        .set({
          lastSyncAt: new Date(),
          lastPullSyncToken: r.nextSyncToken,
          lastSyncError: null,
        })
        .where(and(eq(calendarConnections.id, conn.id), eq(calendarConnections.studioId, studioId)));
      results.push({ connectionId: conn.id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(calendarConnections)
        .set({ lastSyncError: message.slice(0, 500) })
        .where(and(eq(calendarConnections.id, conn.id), eq(calendarConnections.studioId, studioId)));
      results.push({ connectionId: conn.id, ok: false, error: message });
    }
  }
  revalidatePath('/admin/calendar-sync');
  return { success: true as const, results };
}
