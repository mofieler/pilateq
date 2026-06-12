'use server';

import { z } from 'zod';
import { addMinutes } from 'date-fns';
import { db } from '@/db';
import {
  welcomeJourneyRequests,
  users,
  classSessions,
  classTemplates,
  bookings,
  instructors,
  creditPurchases,
  creditPackages,
} from '@/db/schema';
import { eq, and, desc, gte, inArray, isNull, ne, lt, gt, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { requireStudioId } from '@/lib/studio/studio-context';
import { verifyWelcomeJourneyRequestStudio } from '@/lib/security/tenant-guard';
import { getLogger } from '@/lib/logger';
import type { ServiceResult } from '@/modules/billing/services/credit.service';
import {
  WELCOME_JOURNEY_OFFER_EXPIRY_HOURS,
  WELCOME_JOURNEY_REQUEST_STATUS,
} from '@/constants/BOOKING_RULES';
import { formatStudioDate, formatStudioTime } from '@/lib/utils/date.utils';
import {
  purgeWelcomeJourneySlotsByIds,
  withdrawWelcomeJourneySlots,
} from '@/modules/welcome/services/slotManager.service';
import {
  sendWelcomeJourneyRequestToAdmin,
  sendWelcomeJourneySlotsOffered,
  sendWelcomeJourneyRejectionToAdmin,
  sendWelcomeJourneyBookingConfirmation,
} from '@/lib/email/welcome.emails';

// ─── Input schemas ────────────────────────────────────────────────────────────

const requestSchema = z.object({
  message: z.string().max(1000).optional(),
  preferredSlots: z.array(z.string()).max(3).optional(),
});

const offerSlotsSchema = z.object({
  requestId: z.string().uuid(),
  sessionIds: z.array(z.string().uuid()).min(1).max(3),
});

const rejectSlotsSchema = z.object({
  requestId: z.string().uuid(),
  newMessage: z.string().max(1000).optional(),
});

const bookOfferedSlotSchema = z.object({
  requestId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getStudioEmail(): Promise<string> {
  return process.env.STUDIO_EMAIL ?? 'hello@paquitapilates.de';
}

// ─── User actions ─────────────────────────────────────────────────────────────

export async function createWelcomeJourneyRequest(
  input: z.infer<typeof requestSchema>,
): Promise<ServiceResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }
  const userId = session.user.id;

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'INVALID_STATE' };
  }

  try {
    const studioId = await requireStudioId();

    // Prevent duplicate active requests
    const [existing] = await db
      .select({ id: welcomeJourneyRequests.id })
      .from(welcomeJourneyRequests)
      .where(
        and(
          eq(welcomeJourneyRequests.userId, userId),
          eq(welcomeJourneyRequests.studioId, studioId),
          inArray(welcomeJourneyRequests.status, [
            WELCOME_JOURNEY_REQUEST_STATUS.pending,
            WELCOME_JOURNEY_REQUEST_STATUS.slotsOffered,
          ]),
        ),
      )
      .limit(1);

    if (existing) {
      return { success: false, error: 'You already have an active Welcome Journey request.', code: 'INVALID_STATE' };
    }

    const [request] = await db
      .insert(welcomeJourneyRequests)
      .values({
        studioId,
        userId,
        status: WELCOME_JOURNEY_REQUEST_STATUS.pending,
        userMessage: parsed.data.message ?? null,
        preferredSlots: parsed.data.preferredSlots ?? [],
      })
      .returning();

    // Notify admin
    const [userRow] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRow?.email) {
      sendWelcomeJourneyRequestToAdmin(
        await getStudioEmail(),
        userRow.name ?? 'A student',
        userRow.email,
        parsed.data.message,
      ).catch(() => {});
    }

    revalidatePath('/book');
    return { success: true, data: { id: request.id } };
  } catch (err) {
    getLogger('welcome-request').error({ err }, 'create failed');
    return { success: false, error: 'Failed to create request', code: 'DB_ERROR' };
  }
}

export async function getMyWelcomeJourneyRequest(): Promise<
  ServiceResult<{
    request: typeof welcomeJourneyRequests.$inferSelect;
    offeredSessions: Array<{
      id: string;
      startsAt: Date;
      endsAt: Date;
      instructorName: string | null;
      className: string;
      location: string | null;
    }>;
  } | null>
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }
  const userId = session.user.id;

  try {
    const studioId = await requireStudioId();

    const [request] = await db
      .select()
      .from(welcomeJourneyRequests)
      .where(and(eq(welcomeJourneyRequests.userId, userId), eq(welcomeJourneyRequests.studioId, studioId)))
      .orderBy(desc(welcomeJourneyRequests.createdAt))
      .limit(1);

    if (!request) return { success: true, data: null };

    const offeredSessions: Array<{
      id: string;
      startsAt: Date;
      endsAt: Date;
      instructorName: string | null;
      className: string;
      location: string | null;
    }> = [];

    if (request.offeredSessionIds && request.offeredSessionIds.length > 0) {
      const sessionRows = await db
        .select({
          session: classSessions,
          template: classTemplates,
        })
        .from(classSessions)
        .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
        .where(and(eq(classSessions.studioId, studioId), eq(classTemplates.studioId, studioId), inArray(classSessions.id, request.offeredSessionIds)));

      for (const row of sessionRows) {
        let instructorName: string | null = null;
        if (row.session.instructorId) {
          const [instr] = await db
            .select({ name: users.name })
            .from(instructors)
            .innerJoin(users, eq(instructors.userId, users.id))
            .where(eq(instructors.id, row.session.instructorId))
            .limit(1);
          instructorName = instr?.name ?? null;
        }
        offeredSessions.push({
          id: row.session.id,
          startsAt: row.session.startsAt,
          endsAt: row.session.endsAt,
          instructorName,
          className: row.template.name,
          location: row.template.location,
        });
      }
    }

    return { success: true, data: { request, offeredSessions } };
  } catch (err) {
    getLogger('welcome-request').error({ err }, 'getMy failed');
    return { success: false, error: 'Failed to load request', code: 'DB_ERROR' };
  }
}

export async function rejectOfferedSlots(
  input: z.infer<typeof rejectSlotsSchema>,
): Promise<ServiceResult<{ newRequestId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }
  const userId = session.user.id;

  const parsed = rejectSlotsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', code: 'INVALID_STATE' };
  }

  try {
    const studioId = await requireStudioId();

    const [existingForReject] = await db
      .select({ offeredSessionIds: welcomeJourneyRequests.offeredSessionIds })
      .from(welcomeJourneyRequests)
      .where(
        and(
          eq(welcomeJourneyRequests.id, parsed.data.requestId),
          eq(welcomeJourneyRequests.studioId, studioId),
          eq(welcomeJourneyRequests.userId, userId),
        ),
      )
      .limit(1);

    const offeredSlotCount = existingForReject?.offeredSessionIds?.length ?? 0;

    // Mark old request as rejected
    await db
      .update(welcomeJourneyRequests)
      .set({
        status: WELCOME_JOURNEY_REQUEST_STATUS.rejected,
        offeredSessionIds: [],
        expiresAt: null,
        warningEmailSentAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(welcomeJourneyRequests.id, parsed.data.requestId),
          eq(welcomeJourneyRequests.studioId, studioId),
          eq(welcomeJourneyRequests.userId, userId),
        ),
      );

    // Create a new pending request
    const [newRequest] = await db
      .insert(welcomeJourneyRequests)
      .values({
        studioId,
        userId,
        status: WELCOME_JOURNEY_REQUEST_STATUS.pending,
        userMessage: parsed.data.newMessage ?? null,
      })
      .returning();

    if (
      existingForReject?.offeredSessionIds &&
      existingForReject.offeredSessionIds.length > 0
    ) {
      await purgeWelcomeJourneySlotsByIds(
        existingForReject.offeredSessionIds,
        'Welcome Journey: student rejected offered slots',
        studioId,
      );
    }

    // Notify admin
    const [userRow] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRow?.email) {
      sendWelcomeJourneyRejectionToAdmin(
        await getStudioEmail(),
        userRow.name ?? 'A student',
        userRow.email,
        parsed.data.newMessage,
        offeredSlotCount > 0 ? offeredSlotCount : undefined,
      ).catch(() => {});
    }

    revalidatePath('/book');
    return { success: true, data: { newRequestId: newRequest.id } };
  } catch (err) {
    getLogger('welcome-request').error({ err }, 'reject failed');
    return { success: false, error: 'Failed to reject slots', code: 'DB_ERROR' };
  }
}

// ─── Admin actions ────────────────────────────────────────────────────────────

export async function getPendingWelcomeJourneyRequests(): Promise<
  ServiceResult<
    Array<{
      request: typeof welcomeJourneyRequests.$inferSelect;
      userName: string | null;
      userEmail: string | null;
    }>
  >
> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  try {
    const studioId = await requireStudioId();
    const rows = await db
      .select({
        request: welcomeJourneyRequests,
        userName: users.name,
        userEmail: users.email,
      })
      .from(welcomeJourneyRequests)
      .innerJoin(users, eq(welcomeJourneyRequests.userId, users.id))
      .where(
        and(
          eq(welcomeJourneyRequests.studioId, studioId),
          inArray(welcomeJourneyRequests.status, [
            WELCOME_JOURNEY_REQUEST_STATUS.pending,
            WELCOME_JOURNEY_REQUEST_STATUS.slotsOffered,
          ])
        )
      )
      .orderBy(desc(welcomeJourneyRequests.createdAt));

    return { success: true, data: rows };
  } catch (err) {
    getLogger('welcome-request').error({ err }, 'admin getPending failed');
    return { success: false, error: 'Failed to load requests', code: 'DB_ERROR' };
  }
}

export async function getWelcomeJourneyRequestsForAttendance(): Promise<
  ServiceResult<
    Array<{
      requestId: string;
      userId: string;
      userName: string | null;
      userEmail: string | null;
      sessionId: string;
      startsAt: Date;
      endsAt: Date;
      className: string;
      bookingId: string;
    }>
  >
> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  try {
    const studioId = await requireStudioId();
    const now = new Date();

    const rows = await db
      .select({
        requestId: welcomeJourneyRequests.id,
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        sessionId: classSessions.id,
        startsAt: classSessions.startsAt,
        endsAt: classSessions.endsAt,
        className: classTemplates.name,
        bookingId: bookings.id,
      })
      .from(welcomeJourneyRequests)
      .innerJoin(users, eq(welcomeJourneyRequests.userId, users.id))
      .innerJoin(bookings, eq(welcomeJourneyRequests.userId, bookings.userId))
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
      .where(
        and(
          eq(welcomeJourneyRequests.studioId, studioId),
          eq(bookings.studioId, studioId),
          eq(classSessions.studioId, studioId),
          eq(classTemplates.studioId, studioId),
          eq(welcomeJourneyRequests.status, WELCOME_JOURNEY_REQUEST_STATUS.booked),
          eq(classTemplates.isWelcomeJourney, true),
          eq(bookings.status, 'confirmed'),
          gte(classSessions.startsAt, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
          isNull(users.welcomeCompletedAt),
        ),
      )
      .orderBy(desc(classSessions.startsAt));

    return { success: true, data: rows };
  } catch (err) {
    getLogger('welcome-request').error({ err }, 'attendance list failed');
    return { success: false, error: 'Failed to load attendance list', code: 'DB_ERROR' };
  }
}

export async function offerWelcomeJourneySlots(
  input: z.infer<typeof offerSlotsSchema>,
): Promise<ServiceResult<boolean>> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  const parsed = offerSlotsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', code: 'INVALID_STATE' };
  }

  try {
    const studioId = await requireStudioId();

    const [request] = await db
      .select()
      .from(welcomeJourneyRequests)
      .where(and(eq(welcomeJourneyRequests.id, parsed.data.requestId), eq(welcomeJourneyRequests.studioId, studioId)))
      .limit(1);

    if (!request) {
      return { success: false, error: 'Request not found', code: 'NOT_FOUND' };
    }

    if (request.status !== WELCOME_JOURNEY_REQUEST_STATUS.pending) {
      return { success: false, error: 'Request is not pending', code: 'INVALID_STATE' };
    }

    // Validate sessions exist and are Welcome Journey sessions
    const sessions = await db
      .select({ id: classSessions.id })
      .from(classSessions)
      .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
      .where(
        and(
          eq(classSessions.studioId, studioId),
          eq(classTemplates.studioId, studioId),
          inArray(classSessions.id, parsed.data.sessionIds),
          eq(classTemplates.isWelcomeJourney, true),
        ),
      );

    if (sessions.length !== parsed.data.sessionIds.length) {
      return { success: false, error: 'Invalid sessions selected', code: 'INVALID_STATE' };
    }

    await db
      .update(welcomeJourneyRequests)
      .set({
        status: WELCOME_JOURNEY_REQUEST_STATUS.slotsOffered,
        offeredSessionIds: parsed.data.sessionIds,
        expiresAt: new Date(Date.now() + WELCOME_JOURNEY_OFFER_EXPIRY_HOURS * 60 * 60 * 1000),
        warningEmailSentAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(welcomeJourneyRequests.id, parsed.data.requestId), eq(welcomeJourneyRequests.studioId, studioId)));

    // Notify user
    const [userRow] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    if (userRow?.email) {
      sendWelcomeJourneySlotsOffered(
        userRow.email,
        userRow.name ?? 'there',
        parsed.data.sessionIds.length,
      ).catch(() => {});
    }

    revalidatePath('/admin');
    revalidatePath('/book');
    return { success: true, data: true };
  } catch (err) {
    getLogger('welcome-request').error({ err }, 'offer failed');
    return { success: false, error: 'Failed to offer slots', code: 'DB_ERROR' };
  }
}

export async function getUpcomingWelcomeJourneySessions(): Promise<
  ServiceResult<
    Array<{
      id: string;
      startsAt: Date;
      endsAt: Date;
      instructorName: string | null;
      className: string;
      bookedCount: number;
      maxCapacity: number;
    }>
  >
> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  try {
    const studioId = await requireStudioId();
    const now = new Date();
    const rows = await db
      .select({
        id: classSessions.id,
        startsAt: classSessions.startsAt,
        endsAt: classSessions.endsAt,
        instructorName: users.name,
        className: classTemplates.name,
        bookedCount: classSessions.bookedCount,
        maxCapacity: classSessions.maxCapacity,
      })
      .from(classSessions)
      .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
      .leftJoin(users, eq(classSessions.instructorId, users.id))
      .where(
        and(
          eq(classSessions.studioId, studioId),
          eq(classTemplates.studioId, studioId),
          eq(classTemplates.isWelcomeJourney, true),
          eq(classSessions.status, 'scheduled'),
          gte(classSessions.startsAt, now),
        ),
      )
      .orderBy(classSessions.startsAt);

    return { success: true, data: rows };
  } catch (err) {
    getLogger('welcome-request').error({ err }, 'getSessions failed');
    return { success: false, error: 'Failed to load sessions', code: 'DB_ERROR' };
  }
}

export async function bookOfferedWelcomeJourneySlot(
  input: z.infer<typeof bookOfferedSlotSchema>,
): Promise<ServiceResult<{ bookingId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }
  const userId = session.user.id;

  const parsed = bookOfferedSlotSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', code: 'INVALID_STATE' };
  }

  try {
    const studioId = await requireStudioId();

    const [request] = await db
      .select()
      .from(welcomeJourneyRequests)
      .where(
        and(
          eq(welcomeJourneyRequests.id, parsed.data.requestId),
          eq(welcomeJourneyRequests.studioId, studioId),
          eq(welcomeJourneyRequests.userId, userId),
        ),
      )
      .limit(1);

    if (!request || request.status !== WELCOME_JOURNEY_REQUEST_STATUS.slotsOffered) {
      return { success: false, error: 'No active slot offer found', code: 'INVALID_STATE' };
    }

    if (request.expiresAt && request.expiresAt.getTime() <= Date.now()) {
      return { success: false, error: 'The offered slots have expired. Please request new slots.', code: 'INVALID_STATE' };
    }

    if (!request.offeredSessionIds?.includes(parsed.data.sessionId)) {
      return { success: false, error: 'This slot was not offered to you', code: 'INVALID_STATE' };
    }

    // Use existing booking action
    const { createBookingAction } = await import('@/modules/booking/actions/createBooking.action');
    const result = await createBookingAction({
      sessionId: parsed.data.sessionId,
      isWelcomeJourneyBooking: true,
    });

    if (!result.success) {
      return { success: false, error: result.error, code: result.code };
    }

    const bookingId = result.data?.id;
    if (!bookingId) {
      return { success: false, error: 'Booking created but ID missing', code: 'DB_ERROR' };
    }

    // Unchosen offered slots are one-off holds for this student — remove them from the
    // schedule (and external calendar) so only the booked session remains visible.
    const otherSessionIds = request.offeredSessionIds.filter(
      (id) => id !== parsed.data.sessionId,
    );

    let alternateSessionsMeta: {
      id: string;
      instructorId: string | null;
      googleCalendarEventId: string | null;
      googleCalendarId: string | null;
    }[] = [];
    if (otherSessionIds.length > 0) {
      alternateSessionsMeta = await db
        .select({
          id: classSessions.id,
          instructorId: classSessions.instructorId,
          googleCalendarEventId: classSessions.googleCalendarEventId,
          googleCalendarId: classSessions.googleCalendarId,
        })
        .from(classSessions)
        .where(and(inArray(classSessions.id, otherSessionIds), eq(classSessions.studioId, studioId)));
    }

    await db
      .update(welcomeJourneyRequests)
      .set({ status: WELCOME_JOURNEY_REQUEST_STATUS.booked, updatedAt: new Date() })
      .where(
        and(
          eq(welcomeJourneyRequests.id, parsed.data.requestId),
          eq(welcomeJourneyRequests.studioId, studioId),
        ),
      );

    if (otherSessionIds.length > 0) {
      try {
        await db
          .delete(classSessions)
          .where(and(inArray(classSessions.id, otherSessionIds), eq(classSessions.studioId, studioId)));
      } catch (purgeErr) {
        getLogger('welcome-request').error({ err: purgeErr }, 'purge alternate WJ sessions failed, soft-cancelling');
        await db
          .update(classSessions)
          .set({
            status: 'cancelled',
            cancelledAt: new Date(),
            cancellationReason: 'Welcome Journey: student chose another offered slot',
            updatedAt: new Date(),
          })
          .where(and(inArray(classSessions.id, otherSessionIds), eq(classSessions.studioId, studioId)));
      }

      for (const row of alternateSessionsMeta) {
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
            getLogger('welcome-request').warn({ err }, 'Welcome Journey alternate slot GCal delete failed');
          }
        })();
      }
    }

    // Send confirmation email
    const [userRow] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const [sessionRow] = await db
      .select({
        startsAt: classSessions.startsAt,
        endsAt: classSessions.endsAt,
        className: classTemplates.name,
        location: classTemplates.location,
      })
      .from(classSessions)
      .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
      .where(eq(classSessions.id, parsed.data.sessionId))
      .limit(1);

    if (userRow?.email && sessionRow) {
      const classDate = formatStudioDate(sessionRow.startsAt);
      const classTime = formatStudioTime(sessionRow.startsAt);
      sendWelcomeJourneyBookingConfirmation(
        userRow.email,
        userRow.name ?? 'there',
        sessionRow.className,
        classDate,
        classTime,
        sessionRow.startsAt,
        sessionRow.endsAt,
        bookingId,
        sessionRow.location ?? undefined,
      ).catch(() => {});
    }

    revalidatePath('/book');
    revalidatePath('/bookings');
    revalidatePath('/admin/classes');
    return { success: true, data: { bookingId } };
  } catch (err) {
    getLogger('welcome-request').error({ err }, 'book slot failed');
    return { success: false, error: 'Failed to book slot', code: 'DB_ERROR' };
  }
}

export async function getWelcomeJourneyRecommendations(requestId: string): Promise<
  ServiceResult<{
    preferredSlots: Array<{
      startsAt: Date;
      existingSessions: Array<{
        id: string;
        startsAt: Date;
        endsAt: Date;
        instructorName: string | null;
        bookedCount: number;
        maxCapacity: number;
      }>;
      overlappingSessions: Array<{
        id: string;
        startsAt: Date;
        endsAt: Date;
        className: string;
        instructorName: string | null;
        bookedCount: number;
        maxCapacity: number;
      }>;
      availableInstructors: Array<{
        id: string;
        name: string;
      }>;
    }>;
  }>
> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  try {
    const studioId = await requireStudioId();

    const [request] = await db
      .select()
      .from(welcomeJourneyRequests)
      .where(and(eq(welcomeJourneyRequests.id, requestId), eq(welcomeJourneyRequests.studioId, studioId)))
      .limit(1);

    if (!request) {
      return { success: false, error: 'Request not found', code: 'NOT_FOUND' };
    }

    const preferredSlotStrings = request.preferredSlots ?? [];
    const preferredDates = preferredSlotStrings.map((s) => new Date(s)).filter((d) => !isNaN(d.getTime()));

    // Get welcome journey templates
    const [template] = await db
      .select({ id: classTemplates.id, durationMinutes: classTemplates.durationMinutes })
      .from(classTemplates)
      .where(and(eq(classTemplates.studioId, studioId), eq(classTemplates.isWelcomeJourney, true), eq(classTemplates.isActive, true)))
      .limit(1);

    const duration = template?.durationMinutes ?? 120; // fallback to 120 min

    // Get all active instructors
    const activeInstructors = await db
      .select({ id: instructors.id, name: users.name })
      .from(instructors)
      .innerJoin(users, and(eq(instructors.userId, users.id), isNull(users.deletedAt)))
      .where(and(eq(instructors.studioId, studioId), eq(instructors.isActive, true)))
      .orderBy(asc(users.name));

    const { getBlocksInRange } = await import('@/modules/calendar/services/calendar-sync.service');

    const preferredSlotsWithData = [];

    for (const startsAt of preferredDates) {
      const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);

      // Find any existing scheduled Welcome Journey sessions at this exact time
      const existingSessions = await db
        .select({
          id: classSessions.id,
          startsAt: classSessions.startsAt,
          endsAt: classSessions.endsAt,
          instructorName: users.name,
          bookedCount: classSessions.bookedCount,
          maxCapacity: classSessions.maxCapacity,
        })
        .from(classSessions)
        .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
        .leftJoin(instructors, eq(classSessions.instructorId, instructors.id))
        .leftJoin(users, eq(instructors.userId, users.id))
        .where(
          and(
            eq(classSessions.studioId, studioId),
            eq(classTemplates.studioId, studioId),
            eq(classTemplates.isWelcomeJourney, true),
            eq(classSessions.status, 'scheduled'),
            eq(classSessions.startsAt, startsAt),
          )
        );

      // Find ANY scheduled sessions overlapping with this slot [startsAt, endsAt]
      const overlappingSessions = await db
        .select({
          id: classSessions.id,
          startsAt: classSessions.startsAt,
          endsAt: classSessions.endsAt,
          className: classTemplates.name,
          instructorName: users.name,
          bookedCount: classSessions.bookedCount,
          maxCapacity: classSessions.maxCapacity,
        })
        .from(classSessions)
        .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
        .leftJoin(instructors, eq(classSessions.instructorId, instructors.id))
        .leftJoin(users, eq(instructors.userId, users.id))
        .where(
          and(
            eq(classSessions.studioId, studioId),
            eq(classTemplates.studioId, studioId),
            ne(classSessions.status, 'cancelled'),
            lt(classSessions.startsAt, endsAt),
            gt(classSessions.endsAt, startsAt),
          )
        );

      // If the studio is already occupied, no instructor can teach here
      if (overlappingSessions.length > 0) {
        preferredSlotsWithData.push({
          startsAt,
          existingSessions,
          overlappingSessions,
          availableInstructors: [],
        });
        continue; // Skip to next preferred slot
      }

      // Check instructor availability for this slot
      const availableInstructors = [];

      for (const inst of activeInstructors) {
        // 1. Check overlapping class sessions
        const [overlapping] = await db
          .select({ id: classSessions.id })
          .from(classSessions)
          .where(
            and(
              eq(classSessions.studioId, studioId),
              eq(classSessions.instructorId, inst.id),
              ne(classSessions.status, 'cancelled'),
              lt(classSessions.startsAt, endsAt),
              gt(classSessions.endsAt, startsAt)
            )
          )
          .limit(1);

        if (overlapping) continue; // Not available

        // 2. Check Google Calendar blocks
        let hasGcalBlock = false;
        try {
          const blocks = await getBlocksInRange(startsAt, endsAt, studioId);
          const instBlock = blocks.some((b) => b.instructorId === inst.id || b.instructorId === null);
          if (instBlock) {
            hasGcalBlock = true;
          }
        } catch (gcalErr) {
          getLogger('welcome-request').warn({ err: gcalErr }, 'Recommendations GCal check failed');
        }

        if (hasGcalBlock) continue;

        // Instructor is free!
        availableInstructors.push(inst);
      }

      preferredSlotsWithData.push({
        startsAt,
        existingSessions,
        overlappingSessions,
        availableInstructors,
      });
    }

    return { success: true, data: { preferredSlots: preferredSlotsWithData } };
  } catch (err) {
    getLogger('welcome-request').error({ err }, 'recommendations failed');
    return { success: false, error: 'Failed to compute recommendations', code: 'DB_ERROR' };
  }
}

export async function createAndOfferWelcomeJourneySlot(input: {
  requestId: string;
  startsAtISO: string;
  instructorId: string;
}): Promise<ServiceResult<boolean>> {
  // 1. Authenticate admin
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  const studioId = await requireStudioId();

  // 2. Fetch the welcome journey request
  const [request] = await db
    .select()
    .from(welcomeJourneyRequests)
    .where(and(eq(welcomeJourneyRequests.id, input.requestId), eq(welcomeJourneyRequests.studioId, studioId)))
    .limit(1);

  if (!request || request.status !== WELCOME_JOURNEY_REQUEST_STATUS.pending) {
    return { success: false, error: 'Request not found or not pending', code: 'INVALID_STATE' };
  }

  // 3. Find the welcome journey template
  const [template] = await db
    .select()
    .from(classTemplates)
    .where(and(eq(classTemplates.studioId, studioId), eq(classTemplates.isWelcomeJourney, true), eq(classTemplates.isActive, true)))
    .limit(1);

  if (!template) {
    return { success: false, error: 'No active Welcome Journey class template found', code: 'NOT_FOUND' };
  }

  // 4. Calculate endsAt
  const startsAt = new Date(input.startsAtISO);
  const endsAt = addMinutes(startsAt, template.durationMinutes);

  try {
    // 5. Create a classSession
    const [newSession] = await db
      .insert(classSessions)
      .values({
        studioId: request.studioId,
        templateId: template.id,
        instructorId: input.instructorId,
        startsAt,
        endsAt,
        maxCapacity: template.maxCapacity,
        bookedCount: 0,
        waitlistCount: 0,
        status: 'scheduled',
      })
      .returning();

    // 6. Push to Google Calendar (fire-and-forget)
    try {
      const { pushSession } = await import('@/modules/calendar/services/calendar-sync.service');
      await pushSession(newSession.id, request.studioId);
    } catch (err) {
      getLogger('welcome-request').warn({ err }, 'WJ one-click session GCal push failed');
    }

    // 7. Offer this slot to the user
    await db
      .update(welcomeJourneyRequests)
      .set({
        status: WELCOME_JOURNEY_REQUEST_STATUS.slotsOffered,
        offeredSessionIds: [newSession.id],
        expiresAt: new Date(Date.now() + WELCOME_JOURNEY_OFFER_EXPIRY_HOURS * 60 * 60 * 1000),
        warningEmailSentAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(welcomeJourneyRequests.id, input.requestId), eq(welcomeJourneyRequests.studioId, studioId)));

    // Notify user
    const [userRow] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    if (userRow?.email) {
      sendWelcomeJourneySlotsOffered(
        userRow.email,
        userRow.name ?? 'there',
        1,
      ).catch(() => {});
    }

    revalidatePath('/admin');
    revalidatePath('/book');
    return { success: true, data: true };
  } catch (err) {
    getLogger('welcome-request').error({ err }, 'one-click create failed');
    return { success: false, error: 'Failed to create and offer slot', code: 'DB_ERROR' };
  }
}

export async function withdrawWelcomeJourneyOffer(
  input: { requestId: string }
): Promise<ServiceResult<boolean>> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  try {
    const studioId = await requireStudioId();

    // Verify the request belongs to the current studio before delegating to the service.
    const requestBelongs = await verifyWelcomeJourneyRequestStudio(input.requestId, studioId);
    if (!requestBelongs) {
      return { success: false, error: 'Request not found', code: 'NOT_FOUND' };
    }

    const res = await withdrawWelcomeJourneySlots(input.requestId, studioId);
    if (!res.success) {
      return { success: false, error: res.error ?? 'Failed to withdraw offer', code: 'DB_ERROR' };
    }
    return { success: true, data: true };
  } catch (err) {
    getLogger('welcome-request').error({ err }, 'withdraw failed');
    return { success: false, error: 'Failed to withdraw offer', code: 'DB_ERROR' };
  }
}

export async function hasPurchasedWelcomeJourney(): Promise<ServiceResult<boolean>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  try {
    const studioId = await requireStudioId();
    const [purchase] = await db
      .select({ id: creditPurchases.id })
      .from(creditPurchases)
      .innerJoin(creditPackages, eq(creditPurchases.packageId, creditPackages.id))
      .where(
        and(
          eq(creditPurchases.studioId, studioId),
          eq(creditPackages.studioId, studioId),
          eq(creditPurchases.userId, session.user.id),
          eq(creditPackages.name, 'Welcome Journey'),
          ne(creditPurchases.paymentStatus, 'cancelled'),
        ),
      )
      .limit(1);

    return { success: true, data: purchase != null };
  } catch (err) {
    getLogger('welcome-request').error({ err }, 'hasPurchasedWelcomeJourney failed');
    return { success: false, error: 'Failed to check purchase status', code: 'DB_ERROR' };
  }
}
