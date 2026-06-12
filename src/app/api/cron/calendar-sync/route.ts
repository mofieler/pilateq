import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/db';
import { calendarConnections, classSessions } from '@/db/schema';
import { and, eq, gte, isNotNull, isNull, or, ne } from 'drizzle-orm';
import {
  listActiveConnections,
  pullBlocks,
  pushSession,
} from '@/modules/calendar/services/calendar-sync.service';
import { getLogger } from '@/lib/logger';

const cronLogger = getLogger('calendar-sync-cron');

// POST /api/cron/calendar-sync
// Triggered by an external scheduler (Coolify cron, Vercel cron, etc.) every
// 5 minutes. Auth via shared secret in `Authorization: Bearer <CRON_SECRET>`.
//
// Performs:
//  1. Pull external GCal events for all active connections → external_calendar_blocks.
//  2. Retry-sweep: re-push class_sessions whose previous push errored and that
//     start in the future or within the last hour.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface SyncReport {
  connections: number;
  pulledAdded: number;
  pulledUpdated: number;
  pulledRemoved: number;
  pulledErrors: number;
  retriedPushes: number;
  retriedSuccesses: number;
}

async function runPullSweep() {
  // Process connections grouped by studio so every tenant-scoped lookup carries
  // its studioId. Distinct studios with at least one active connection.
  const studioRows = await db
    .selectDistinct({ studioId: calendarConnections.studioId })
    .from(calendarConnections)
    .where(eq(calendarConnections.syncEnabled, true));

  const report = {
    connections: 0,
    pulledAdded: 0,
    pulledUpdated: 0,
    pulledRemoved: 0,
    pulledErrors: 0,
  };

  for (const { studioId } of studioRows) {
    const conns = await listActiveConnections(studioId);
    report.connections += conns.length;

    for (const conn of conns) {
      if (!conn.selectedCalendarId) continue;
      try {
        const r = await pullBlocks(conn);
        report.pulledAdded += r.added;
        report.pulledUpdated += r.updated;
        report.pulledRemoved += r.removed;
        await db
          .update(calendarConnections)
          .set({
            lastSyncAt: new Date(),
            lastPullSyncToken: r.nextSyncToken,
            lastSyncError: null,
          })
          .where(eq(calendarConnections.id, conn.id));
      } catch (err) {
        report.pulledErrors += 1;
        const message = err instanceof Error ? err.message : String(err);
        await db
          .update(calendarConnections)
          .set({ lastSyncError: message.slice(0, 500) })
          .where(eq(calendarConnections.id, conn.id));
        cronLogger.error({ connectionId: conn.id, err: message }, 'pullBlocks failed');
      }
    }
  }
  return report;
}

async function runPushRetrySweep() {
  // Find sessions that need a push:
  //   • Never synced (googleCalendarEventId IS NULL), OR
  //   • Previously errored (googleCalendarSyncError IS NOT NULL)
  // Both cases: upcoming/recent, not cancelled, and instructor has an active
  // calendar connection with a selected calendar — JOIN ensures we don't
  // endlessly retry sessions with no matching connection.
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  // Find all unsync'd future sessions — pushSession handles the instructor-vs-admin
  // calendar fallback logic and silently no-ops when no connection exists.
  const toRetry = await db
    .select({ id: classSessions.id, studioId: classSessions.studioId })
    .from(classSessions)
    .where(
      and(
        ne(classSessions.status, 'cancelled'),
        gte(classSessions.startsAt, cutoff),
        or(
          isNull(classSessions.googleCalendarEventId),
          isNotNull(classSessions.googleCalendarSyncError),
        ),
      ),
    )
    .limit(50);

  let succeeded = 0;
  for (const row of toRetry) {
    const ok = await pushSession(row.id, row.studioId);
    if (ok) succeeded += 1;
  }
  return { retriedPushes: toRetry.length, retriedSuccesses: succeeded };
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const pullPart = await runPullSweep();
    const pushPart = await runPushRetrySweep();
    const report: SyncReport = { ...pullPart, ...pushPart };
    cronLogger.info({ report, durationMs: Date.now() - startedAt }, 'calendar-sync done');
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    cronLogger.error({ err }, 'calendar-sync fatal');
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// Also accept GET for manual browser-based testing (still auth-protected).
export const GET = POST;
