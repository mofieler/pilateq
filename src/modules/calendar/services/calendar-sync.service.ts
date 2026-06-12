import { db } from '@/db';
import {
  calendarConnections,
  classSessions,
  classTemplates,
  externalCalendarBlocks,
  bookings,
  instructors,
  users,
} from '@/db/schema';
import { and, eq, gt, gte, isNull, lt, lte } from 'drizzle-orm';
import { getCalendarApi } from './google-calendar.client';
import { getLogger } from '@/lib/logger';

const logger = getLogger('calendar-sync');
import { APP_CONFIG } from '@/constants/APP_CONFIG';
import type { CalendarConnection, ClassSession } from '@/db/schema';

// Push: App → Google Calendar
// Pull: Google Calendar → external_calendar_blocks
//
// Push failures NEVER block the user-facing flow. They write to
// classSessions.googleCalendarSyncError so the worker can retry-sweep.

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SYNC_WINDOW_DAYS_PAST = 1;
const SYNC_WINDOW_DAYS_FUTURE = 60;
const EVENT_SUMMARY_PREFIX = `[${APP_CONFIG.APP_NAME}]`;
const APP_MANAGED_TAG = `${APP_CONFIG.APP_NAME.toLowerCase()}.managed`;
const MAX_ATTENDEES_IN_DESCRIPTION = 50;

interface SessionForSync {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: ClassSession['status'];
  maxCapacity: number;
  instructorId: string | null;
  googleCalendarEventId: string | null;
  googleCalendarId: string | null;
  templateName: string | null;
  instructorUserId: string | null;
  instructorName: string | null;
  location: string | null;
}

async function loadSessionForSync(
  sessionId: string,
  studioId: string,
): Promise<SessionForSync | null> {
  const rows = await db
    .select({
      id: classSessions.id,
      startsAt: classSessions.startsAt,
      endsAt: classSessions.endsAt,
      status: classSessions.status,
      maxCapacity: classSessions.maxCapacity,
      instructorId: classSessions.instructorId,
      googleCalendarEventId: classSessions.googleCalendarEventId,
      googleCalendarId: classSessions.googleCalendarId,
      templateName: classTemplates.name,
      location: classTemplates.location,
      instructorUserId: instructors.userId,
      instructorName: users.name,
    })
    .from(classSessions)
    .leftJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
    .leftJoin(instructors, eq(classSessions.instructorId, instructors.id))
    .leftJoin(users, and(eq(instructors.userId, users.id), isNull(users.deletedAt)))
    .where(and(eq(classSessions.id, sessionId), eq(classSessions.studioId, studioId)))
    .limit(1);
  return rows[0] ?? null;
}

async function loadConnectionForUser(
  userId: string,
  studioId: string,
): Promise<CalendarConnection | null> {
  const rows = await db
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
  const row = rows[0];
  if (!row || !row.selectedCalendarId) return null;
  return row;
}

// Fallback: if the session's instructor has no connected calendar, use any
// admin-connected calendar so studio classes always appear somewhere in GCal.
async function loadFallbackAdminConnection(studioId: string): Promise<CalendarConnection | null> {
  const rows = await db
    .select({ conn: calendarConnections })
    .from(calendarConnections)
    .innerJoin(users, eq(users.id, calendarConnections.userId))
    .where(
      and(
        eq(calendarConnections.studioId, studioId),
        eq(users.role, 'admin'),
        eq(users.studioId, studioId),
        isNull(users.deletedAt),
        eq(calendarConnections.syncEnabled, true),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row?.conn || !row.conn.selectedCalendarId) return null;
  return row.conn;
}

async function loadAttendees(sessionId: string, studioId: string) {
  return db
    .select({
      name: users.name,
      email: users.email,
    })
    .from(bookings)
    .innerJoin(users, and(eq(bookings.userId, users.id), isNull(users.deletedAt)))
    .where(
      and(
        eq(bookings.sessionId, sessionId),
        eq(bookings.studioId, studioId),
        eq(bookings.status, 'confirmed'),
      ),
    );
}

function buildEventDescription(opts: {
  className: string;
  instructorName: string | null;
  bookedCount: number;
  capacity: number;
  attendees: Array<{ name: string; email: string }>;
  sessionId: string;
}): string {
  const lines: string[] = [];
  lines.push(`Klasse: ${opts.className}${opts.instructorName ? ` (${opts.instructorName})` : ''}`);
  lines.push('');
  lines.push(`Teilnehmer (${opts.bookedCount}/${opts.capacity}):`);
  if (opts.attendees.length === 0) {
    lines.push(' • Noch keine Buchungen');
  } else {
    const shown = opts.attendees.slice(0, MAX_ATTENDEES_IN_DESCRIPTION);
    for (const a of shown) {
      lines.push(` • ${a.name} (${a.email})`);
    }
    const hidden = opts.attendees.length - shown.length;
    if (hidden > 0) {
      lines.push(` • … und ${hidden} weitere`);
    }
  }
  lines.push('');
  lines.push(`— Verwaltet durch ${APP_CONFIG.APP_NAME} — bitte hier nicht editieren —`);
  lines.push(
    `Booking-Link: ${process.env.NEXT_PUBLIC_APP_URL}/admin/sessions/${opts.sessionId}`,
  );
  return lines.join('\n');
}

function buildEventSummary(className: string, instructorName: string | null): string {
  return instructorName
    ? `${EVENT_SUMMARY_PREFIX} ${className} — ${instructorName}`
    : `${EVENT_SUMMARY_PREFIX} ${className}`;
}

// ─── Push ────────────────────────────────────────────────────────────────────

/**
 * Pushes (creates or patches) a class session to the instructor's GCal.
 * Fire-and-forget — never throws. Failures stored in googleCalendarSyncError.
 *
 * Concurrency: the class_sessions row is locked FOR UPDATE before we decide
 * insert-vs-patch. Two concurrent calls for the same sessionId will serialize,
 * so only the first creates the event and the second sees the populated
 * googleCalendarEventId and PATCHes it. No duplicate events.
 */
export async function pushSession(
  sessionId: string,
  studioId: string,
): Promise<boolean> {
  try {
    const session = await loadSessionForSync(sessionId, studioId);
    if (!session) return false;

    // Prefer the instructor's own calendar; fall back to any admin calendar so
    // sessions are always visible even before an instructor connects theirs.
    const conn = session.instructorUserId
      ? (await loadConnectionForUser(session.instructorUserId, studioId)) ??
        await loadFallbackAdminConnection(studioId)
      : await loadFallbackAdminConnection(studioId);
    if (!conn) return false; // No calendar connected anywhere → skip

    const attendees = await loadAttendees(sessionId, studioId);
    const className = session.templateName ?? 'Pilates Klasse';
    const location = session.location;

    const summary = buildEventSummary(className, session.instructorName);
    const description = buildEventDescription({
      className,
      instructorName: session.instructorName,
      bookedCount: attendees.length,
      capacity: session.maxCapacity,
      attendees,
      sessionId,
    });

    const api = await getCalendarApi(conn);
    const calendarId = conn.selectedCalendarId!;

    const eventBody = {
      summary,
      description,
      location: location ?? undefined,
      start: { dateTime: session.startsAt.toISOString() },
      end: { dateTime: session.endsAt.toISOString() },
      extendedProperties: {
        private: {
          [APP_MANAGED_TAG]: 'true',
          appSessionId: sessionId,
        },
      },
    };

    // Decide insert vs patch under a row lock so concurrent calls don't both insert.
    const eventId = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({
          googleCalendarEventId: classSessions.googleCalendarEventId,
          googleCalendarId: classSessions.googleCalendarId,
        })
        .from(classSessions)
        .where(and(eq(classSessions.id, sessionId), eq(classSessions.studioId, studioId)))
        .for('update')
        .limit(1);

      let id: string;
      if (locked?.googleCalendarEventId && locked.googleCalendarId === calendarId) {
        const res = await api.events.patch({
          calendarId,
          eventId: locked.googleCalendarEventId,
          requestBody: eventBody,
        });
        id = res.data.id!;
      } else {
        // First push, or calendar selection changed since last sync (old event
        // stays in the previous calendar — admin can clean up manually).
        const res = await api.events.insert({
          calendarId,
          requestBody: eventBody,
        });
        id = res.data.id!;
      }

      await tx
        .update(classSessions)
        .set({
          googleCalendarEventId: id,
          googleCalendarId: calendarId,
          googleCalendarSyncedAt: new Date(),
          googleCalendarSyncError: null,
        })
        .where(and(eq(classSessions.id, sessionId), eq(classSessions.studioId, studioId)));

      return id;
    });

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, sessionId }, 'pushSession failed');
    await db
      .update(classSessions)
      .set({ googleCalendarSyncError: message.slice(0, 500) })
      .where(and(eq(classSessions.id, sessionId), eq(classSessions.studioId, studioId)))
      .catch(() => {});
    return false;
  }
}

/**
 * Updates only the description (attendee list) of an already-synced event.
 * Cheaper than a full push when only bookings changed.
 */
export async function updateAttendeesInDescription(
  sessionId: string,
  studioId: string,
): Promise<boolean> {
  try {
    const session = await loadSessionForSync(sessionId, studioId);
    if (!session || !session.googleCalendarEventId || !session.googleCalendarId) {
      return await pushSession(sessionId, studioId);
    }

    const conn = session.instructorUserId
      ? (await loadConnectionForUser(session.instructorUserId, studioId)) ??
        await loadFallbackAdminConnection(studioId)
      : await loadFallbackAdminConnection(studioId);
    if (!conn) return false;

    const attendees = await loadAttendees(sessionId, studioId);
    const className = session.templateName ?? 'Pilates Klasse';

    const description = buildEventDescription({
      className,
      instructorName: session.instructorName,
      bookedCount: attendees.length,
      capacity: session.maxCapacity,
      attendees,
      sessionId,
    });

    const api = await getCalendarApi(conn);
    await api.events.patch({
      calendarId: session.googleCalendarId,
      eventId: session.googleCalendarEventId,
      requestBody: { description },
    });

    await db
      .update(classSessions)
      .set({ googleCalendarSyncedAt: new Date(), googleCalendarSyncError: null })
      .where(and(eq(classSessions.id, sessionId), eq(classSessions.studioId, studioId)));
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, sessionId }, 'updateAttendees failed');
    await db
      .update(classSessions)
      .set({ googleCalendarSyncError: message.slice(0, 500) })
      .where(and(eq(classSessions.id, sessionId), eq(classSessions.studioId, studioId)))
      .catch(() => {});
    return false;
  }
}

/**
 * Deletes the GCal event mirroring this session.
 * Called when a class is cancelled by admin/instructor.
 */
export async function deleteEvent(sessionId: string, studioId: string): Promise<void> {
  try {
    const session = await loadSessionForSync(sessionId, studioId);
    if (!session || !session.googleCalendarEventId || !session.googleCalendarId) return;

    const conn = session.instructorUserId
      ? (await loadConnectionForUser(session.instructorUserId, studioId)) ??
        await loadFallbackAdminConnection(studioId)
      : await loadFallbackAdminConnection(studioId);
    if (!conn) return;

    const api = await getCalendarApi(conn);
    try {
      await api.events.delete({
        calendarId: session.googleCalendarId,
        eventId: session.googleCalendarEventId,
      });
    } catch (err) {
      // 410/404 means it's already gone — treat as success
      if (!isGoneError(err)) throw err;
    }

    await db
      .update(classSessions)
      .set({
        googleCalendarEventId: null,
        googleCalendarId: null,
        googleCalendarSyncedAt: new Date(),
        googleCalendarSyncError: null,
      })
      .where(and(eq(classSessions.id, sessionId), eq(classSessions.studioId, studioId)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, sessionId }, 'deleteEvent failed');
    await db
      .update(classSessions)
      .set({ googleCalendarSyncError: message.slice(0, 500) })
      .where(and(eq(classSessions.id, sessionId), eq(classSessions.studioId, studioId)))
      .catch(() => {});
  }
}

/**
 * Direct event deletion by GCal IDs — used when the class_sessions row is
 * about to be (or has just been) hard-deleted, so we can't look it up.
 */
export async function deleteEventDirect(opts: {
  instructorDbId: string;
  googleCalendarId: string;
  googleEventId: string;
  studioId: string;
}): Promise<void> {
  try {
    const [row] = await db
      .select({ conn: calendarConnections })
      .from(calendarConnections)
      .innerJoin(instructors, eq(instructors.userId, calendarConnections.userId))
      .where(
        and(
          eq(instructors.id, opts.instructorDbId),
          eq(instructors.studioId, opts.studioId),
          eq(calendarConnections.studioId, opts.studioId),
        ),
      )
      .limit(1);
    if (!row?.conn) return;
    const api = await getCalendarApi(row.conn);
    try {
      await api.events.delete({
        calendarId: opts.googleCalendarId,
        eventId: opts.googleEventId,
      });
    } catch (err) {
      if (!isGoneError(err)) throw err;
    }
  } catch (err) {
    logger.error({ err }, 'deleteEventDirect failed');
  }
}

// ─── Pull ────────────────────────────────────────────────────────────────────

function isGoneError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err.code === 410 || err.code === 404)
  );
}

function isSyncTokenExpired(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 410;
}

interface PullResult {
  added: number;
  updated: number;
  removed: number;
  nextSyncToken: string | null;
}

/**
 * Pulls events from the connection's selected calendar into external_calendar_blocks.
 * Uses Google's incremental syncToken when available, falling back to a full
 * window query on first run or after a 410 Gone.
 *
 * App-managed events are skipped (we don't block ourselves).
 */
export async function pullBlocks(conn: CalendarConnection): Promise<PullResult> {
  if (!conn.selectedCalendarId) {
    return { added: 0, updated: 0, removed: 0, nextSyncToken: null };
  }

  const api = await getCalendarApi(conn);
  const calendarId = conn.selectedCalendarId;

  let pageToken: string | undefined;
  let syncToken = conn.lastPullSyncToken ?? undefined;
  let nextSyncToken: string | null = null;
  let added = 0;
  let updated = 0;
  let removed = 0;

  // Find the linked instructor record (for the instructorId FK on blocks).
  const [instructorRow] = await db
    .select({ id: instructors.id })
    .from(instructors)
    .where(and(eq(instructors.userId, conn.userId), eq(instructors.studioId, conn.studioId)))
    .limit(1);
  const instructorId = instructorRow?.id ?? null;

  // True after a 410 forces us to abandon the incremental token and restart
  // with a full-window list. Reset to false at the end of one iteration so we
  // only retry once per call.
  let retryAfter410 = false;

  do {
    let res;
    const baseParams = {
      calendarId,
      pageToken,
      showDeleted: true,
      singleEvents: true,
      maxResults: 250,
    } as const;

    try {
      if (syncToken) {
        res = await api.events.list({ ...baseParams, syncToken });
      } else {
        const timeMin = new Date(Date.now() - SYNC_WINDOW_DAYS_PAST * 24 * 60 * 60 * 1000);
        const timeMax = new Date(Date.now() + SYNC_WINDOW_DAYS_FUTURE * 24 * 60 * 60 * 1000);
        res = await api.events.list({
          ...baseParams,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          orderBy: 'startTime',
        });
      }
      retryAfter410 = false;
    } catch (err) {
      // 410 Gone → syncToken expired, restart this iteration with full-window query.
      if (isSyncTokenExpired(err) && syncToken) {
        syncToken = undefined;
        await db
          .update(calendarConnections)
          .set({ lastPullSyncToken: null })
          .where(eq(calendarConnections.id, conn.id));
        retryAfter410 = true;
        continue;
      }
      throw err;
    }

    const items = res.data.items ?? [];
    for (const ev of items) {
      if (!ev.id) continue;

      // Skip our own pushed events
      const isAppManaged =
        ev.extendedProperties?.private?.[APP_MANAGED_TAG] === 'true' ||
        (ev.summary?.startsWith(EVENT_SUMMARY_PREFIX) ?? false);

      if (ev.status === 'cancelled') {
        const del = await db
          .delete(externalCalendarBlocks)
          .where(
            and(
              eq(externalCalendarBlocks.connectionId, conn.id),
              eq(externalCalendarBlocks.googleEventId, ev.id),
            ),
          )
          .returning({ id: externalCalendarBlocks.id });
        removed += del.length;
        continue;
      }

      if (isAppManaged) continue;

      // All-day events have date instead of dateTime — treat as blocks too
      const startsAt = ev.start?.dateTime
        ? new Date(ev.start.dateTime)
        : ev.start?.date
          ? new Date(ev.start.date + 'T00:00:00Z')
          : null;
      const endsAt = ev.end?.dateTime
        ? new Date(ev.end.dateTime)
        : ev.end?.date
          ? new Date(ev.end.date + 'T00:00:00Z')
          : null;

      if (!startsAt || !endsAt) continue;

      const existing = await db
        .select({ id: externalCalendarBlocks.id })
        .from(externalCalendarBlocks)
        .where(
          and(
            eq(externalCalendarBlocks.connectionId, conn.id),
            eq(externalCalendarBlocks.googleEventId, ev.id),
          ),
        )
        .limit(1);

      if (existing[0]) {
        await db
          .update(externalCalendarBlocks)
          .set({
            summary: ev.summary?.slice(0, 500) ?? null,
            startsAt,
            endsAt,
            instructorId,
            updatedAt: new Date(),
          })
          .where(eq(externalCalendarBlocks.id, existing[0].id));
        updated += 1;
      } else {
        await db.insert(externalCalendarBlocks).values({
          studioId: conn.studioId,
          connectionId: conn.id,
          instructorId,
          googleEventId: ev.id,
          summary: ev.summary?.slice(0, 500) ?? null,
          startsAt,
          endsAt,
        });
        added += 1;
      }
    }

    pageToken = res.data.nextPageToken ?? undefined;
    if (!pageToken && res.data.nextSyncToken) {
      nextSyncToken = res.data.nextSyncToken;
    }
  } while (pageToken || retryAfter410);

  // Prune stale blocks that are entirely in the past (older than the past-window)
  const cutoff = new Date(Date.now() - SYNC_WINDOW_DAYS_PAST * 24 * 60 * 60 * 1000);
  await db
    .delete(externalCalendarBlocks)
    .where(
      and(
        eq(externalCalendarBlocks.connectionId, conn.id),
        lte(externalCalendarBlocks.endsAt, cutoff),
      ),
    );

  return { added, updated, removed, nextSyncToken };
}

// ─── Convenience: list all enabled connections for the cron worker ───────────

export async function listActiveConnections(studioId: string): Promise<CalendarConnection[]> {
  return db
    .select()
    .from(calendarConnections)
    .where(and(eq(calendarConnections.syncEnabled, true), eq(calendarConnections.studioId, studioId)));
}

/**
 * Returns external blocks overlapping the given time range — used by booking UI
 * to grey out unavailable slots.
 */
export async function getBlocksInRange(from: Date, to: Date, studioId: string) {
  return db
    .select({
      id: externalCalendarBlocks.id,
      instructorId: externalCalendarBlocks.instructorId,
      startsAt: externalCalendarBlocks.startsAt,
      endsAt: externalCalendarBlocks.endsAt,
      summary: externalCalendarBlocks.summary,
    })
    .from(externalCalendarBlocks)
    .where(
      and(
        eq(externalCalendarBlocks.studioId, studioId),
        lt(externalCalendarBlocks.startsAt, to),
        gt(externalCalendarBlocks.endsAt, from),
      ),
    );
}
