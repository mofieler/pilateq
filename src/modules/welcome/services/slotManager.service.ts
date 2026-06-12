import { db } from '@/db';
import {
  welcomeJourneyRequests,
  classSessions,
  users,
} from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { sendWelcomeJourneyExpired } from '@/lib/email/welcome.emails';
import { WELCOME_JOURNEY_REQUEST_STATUS } from '@/constants/BOOKING_RULES';
import { getLogger } from '@/lib/logger';

const logger = getLogger('slot-manager');

async function purgeWelcomeJourneyHeldSessions(
  sessionIds: string[],
  reason: string,
  studioId: string,
): Promise<void> {
  if (sessionIds.length === 0) return;

  const sessionsMeta = await db
    .select({
      id: classSessions.id,
      bookedCount: classSessions.bookedCount,
      instructorId: classSessions.instructorId,
      googleCalendarEventId: classSessions.googleCalendarEventId,
      googleCalendarId: classSessions.googleCalendarId,
    })
    .from(classSessions)
    .where(and(inArray(classSessions.id, sessionIds), eq(classSessions.studioId, studioId)));

  const deletable = sessionsMeta.filter((s) => (s.bookedCount ?? 0) === 0);
  const deletableIds = deletable.map((s) => s.id);
  if (deletableIds.length === 0) return;

  try {
    await db
      .delete(classSessions)
      .where(and(inArray(classSessions.id, deletableIds), eq(classSessions.studioId, studioId)));
  } catch (purgeErr) {
    logger.error({ err: purgeErr }, 'purge held sessions failed, soft-cancelling');
    await db
      .update(classSessions)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(and(inArray(classSessions.id, deletableIds), eq(classSessions.studioId, studioId)));
  }

  for (const row of deletable) {
    const iid = row.instructorId;
    const gcid = row.googleCalendarId;
    const geid = row.googleCalendarEventId;
    if (!iid || !gcid || !geid) continue;
    (async () => {
      try {
        const { deleteEventDirect } = await import(
          '@/modules/calendar/services/calendar-sync.service'
        );
        await deleteEventDirect({
          instructorDbId: iid,
          googleCalendarId: gcid,
          googleEventId: geid,
          studioId,
        });
      } catch (err) {
        logger.warn({ err }, 'Welcome Journey held slot GCal delete failed');
      }
    })();
  }
}

export async function expireWelcomeJourneySlots(
  requestId: string,
  studioId: string,
  reason = 'Welcome Journey: slot offer expired'
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Fetch the request to verify and get offered sessions
    const [request] = await db
      .select()
      .from(welcomeJourneyRequests)
      .where(and(eq(welcomeJourneyRequests.id, requestId), eq(welcomeJourneyRequests.studioId, studioId)))
      .limit(1);

    if (!request) {
      return { success: false, error: 'Welcome Journey request not found.' };
    }

    if (request.status !== WELCOME_JOURNEY_REQUEST_STATUS.slotsOffered) {
      return { success: false, error: 'Request is not in slots_offered state.' };
    }

    const sessionIds = request.offeredSessionIds ?? [];

    // 2. Mark request as expired in database
    await db
      .update(welcomeJourneyRequests)
      .set({
        status: WELCOME_JOURNEY_REQUEST_STATUS.expired,
        offeredSessionIds: [],
        warningEmailSentAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(welcomeJourneyRequests.id, requestId), eq(welcomeJourneyRequests.studioId, studioId)));

    await purgeWelcomeJourneyHeldSessions(sessionIds, reason, request.studioId);

    // 6. Notify student via transactional email
    const [userRow] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.id, request.userId), eq(users.studioId, studioId)))
      .limit(1);

    if (userRow?.email) {
      sendWelcomeJourneyExpired(userRow.email, userRow.name ?? 'there').catch((err) => {
        logger.error({ err }, 'failed to send slot expiration email');
      });
    }

    // 7. Force UI path revalidation
    revalidatePath('/admin');
    revalidatePath('/book');

    return { success: true };
  } catch (err) {
    logger.error({ err }, 'expireWelcomeJourneySlots error');
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function withdrawWelcomeJourneySlots(
  requestId: string,
  studioId: string,
  reason = 'Welcome Journey: offer withdrawn by admin'
): Promise<{ success: boolean; error?: string }> {
  try {
    const [request] = await db
      .select()
      .from(welcomeJourneyRequests)
      .where(and(eq(welcomeJourneyRequests.id, requestId), eq(welcomeJourneyRequests.studioId, studioId)))
      .limit(1);

    if (!request) {
      return { success: false, error: 'Welcome Journey request not found.' };
    }

    if (request.status !== WELCOME_JOURNEY_REQUEST_STATUS.slotsOffered) {
      return { success: false, error: 'Request is not in slots_offered state.' };
    }

    const sessionIds = request.offeredSessionIds ?? [];

    await db
      .update(welcomeJourneyRequests)
      .set({
        status: WELCOME_JOURNEY_REQUEST_STATUS.pending,
        offeredSessionIds: [],
        expiresAt: null,
        warningEmailSentAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(welcomeJourneyRequests.id, requestId), eq(welcomeJourneyRequests.studioId, studioId)));

    await purgeWelcomeJourneyHeldSessions(sessionIds, reason, request.studioId);

    revalidatePath('/admin');
    revalidatePath('/book');

    return { success: true };
  } catch (err) {
    logger.error({ err }, 'withdrawWelcomeJourneySlots error');
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function purgeWelcomeJourneySlotsByIds(
  sessionIds: string[],
  reason: string,
  studioId: string,
): Promise<void> {
  await purgeWelcomeJourneyHeldSessions(sessionIds, reason, studioId);
}
