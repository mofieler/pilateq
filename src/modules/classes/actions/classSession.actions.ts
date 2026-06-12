'use server';

import { z } from 'zod';
import { addMinutes } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { studioYmd } from '@/lib/utils/date.utils';
import { db } from '@/db';
import { classTemplates, classSessions, instructors, users, bookings } from '@/db/schema';
import type { ClassSession, ClassTemplate, Instructor, User } from '@/db/schema';
import { asc, eq, and, isNull, inArray, gte, gt, lte, lt, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { cancellationService } from '@/modules/booking/services/cancellation.service';
import { sendClassRescheduledEmail } from '@/lib/email/resend';
import { ActionResult } from '@/lib/types/action.types';
import type { ServiceErrorCode } from '@/modules/billing/services/credit.service';
import type { InstructorCancellationResult } from '@/modules/booking/services/cancellation.service';
import type { ClassType, CreditType } from '@/lib/config/class-types';
import { STUDIO_TIMEZONE } from '@/constants/BOOKING_RULES';
import { checkStudioCollision } from '@/modules/classes/services/studio-schedule.service';
import { requireStudioId } from '@/lib/studio/studio-context';
import { getLogger } from '@/lib/logger';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InstructorOption = { id: string; name: string };

export type AdminSession = ClassSession & {
  template: ClassTemplate | null;
  instructor: (Instructor & { user: User }) | null;
};

export type PaginatedSessions = {
  data: AdminSession[];
  nextCursor: Date | null;
};

export type WeekViewSessionData = {
  id: string;
  templateName: string;
  classType: ClassType;
  creditType: CreditType;
  creditCost: number;
  durationMinutes: number;
  instructorId: string | null;
  instructorName: string | null;
  startsAt: Date;
  endsAt: Date;
  bookedCount: number;
  maxCapacity: number;
  status: string;
};

const logger = getLogger('class-session-actions');

export type ConflictItem = {
  type: 'session' | 'gcal_block' | 'studio_session';
  summary: string;
  startsAt: Date;
  endsAt: Date;
};

type ClassSessionErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'DB_ERROR'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN_ERROR';

export type AvailabilityResult = {
  conflicts: ConflictItem[];
  suggestions: string[];
};

// ─── Auth Guard ───────────────────────────────────────────────────────────────

type AuthCtx = {
  userId: string;
  role: 'admin' | 'instructor';
  instructorId: string | null; // instructors.id for instructor role, null for admin
};

async function requireAdminOrInstructor(): Promise<AuthCtx | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = session.user.role as string;
  if (role !== 'admin' && role !== 'instructor') return null;

  let instructorId: string | null = null;
  if (role === 'instructor') {
    const [row] = await db
      .select({ id: instructors.id })
      .from(instructors)
      .where(eq(instructors.userId, session.user.id))
      .limit(1);
    instructorId = row?.id ?? null;
    if (!instructorId) return null; // user has instructor role but no instructor record
  }

  return { userId: session.user.id, role: role as 'admin' | 'instructor', instructorId };
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const getAdminSessionsSchema = z.object({
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  limit:  z.number().int().positive().max(100).optional(),
  cursor: z.coerce.date().optional(),
});

const cancelClassSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  reason:    z.string().min(1, 'Cancellation reason is required').max(500),
});

const createClassSessionSchema = z.object({
  templateId:   z.string().uuid('Invalid template ID'),
  startsAtISO:  z.string().datetime(),
  instructorId: z.string().uuid().optional().nullable(),
});

const updateClassSessionSchema = z.object({
  id:           z.string().uuid('Invalid session ID'),
  instructorId: z.string().uuid().nullable().optional(),
  maxCapacity:  z.number().int().positive().optional(),
});

const rescheduleClassSessionSchema = z.object({
  id:              z.string().uuid('Invalid session ID'),
  startsAtISO:     z.string().datetime(),
  durationMinutes: z.number().int().positive().optional(),
});

const checkSlotSchema = z.object({
  instructorId:     z.string().uuid().optional(),
  startsAtISO:      z.string().datetime(),
  durationMinutes:  z.number().int().positive(),
  tzOffsetMinutes:  z.number().int(),
  excludeSessionId: z.string().uuid().optional(),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getAdminSessionsAction(
  input: z.infer<typeof getAdminSessionsSchema> = {},
): Promise<ActionResult<PaginatedSessions, ClassSessionErrorCode>> {
  const ctx = await requireAdminOrInstructor();
  if (!ctx) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = getAdminSessionsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.', code: 'INVALID_STATE' };

  const { status, limit, cursor } = parsed.data;
  const safeLimit = Math.min(limit ?? 50, 100);

  try {
    const studioId = await requireStudioId();
    const rows = await db.query.classSessions.findMany({
      with: { template: true, instructor: { with: { user: true } } },
      where: (sessions, { eq, and, lt }) =>
        and(
          eq(sessions.studioId, studioId),
          status !== undefined ? eq(sessions.status, status) : undefined,
          cursor !== undefined ? lt(sessions.startsAt, cursor) : undefined,
        ),
      orderBy: (sessions, { desc }) => [desc(sessions.startsAt)],
      limit: safeLimit + 1,
    });

    const hasNextPage = rows.length > safeLimit;
    const data = hasNextPage ? rows.slice(0, safeLimit) : rows;
    const nextCursor = hasNextPage && data.length > 0 ? data[data.length - 1].startsAt : null;

    return { success: true, data: { data: data as AdminSession[], nextCursor } };
  } catch (err) {
    logger.error({ err }, 'getAdminSessionsAction failed');
    return { success: false, error: 'Failed to fetch sessions.', code: 'DB_ERROR' };
  }
}

export async function cancelClassSessionAction(
  input: z.infer<typeof cancelClassSessionSchema>,
): Promise<ActionResult<InstructorCancellationResult, ServiceErrorCode>> {
  const ctx = await requireAdminOrInstructor();
  if (!ctx) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = cancelClassSessionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.', code: 'INVALID_STATE' };

  const studioId = await requireStudioId();
  const [session] = await db
    .select({ instructorId: classSessions.instructorId })
    .from(classSessions)
    .where(and(eq(classSessions.id, parsed.data.sessionId), eq(classSessions.studioId, studioId)))
    .limit(1);
  if (!session) return { success: false, error: 'Session not found.', code: 'NOT_FOUND' };

  if (ctx.role === 'instructor' && session.instructorId !== ctx.instructorId) {
    return { success: false, error: 'You can only cancel your own sessions.', code: 'UNAUTHORIZED' };
  }

  return cancellationService.cancelSessionByInstructor(parsed.data.sessionId, ctx.userId, studioId, parsed.data.reason);
}

export async function createClassSessionAction(
  input: z.infer<typeof createClassSessionSchema>,
): Promise<ActionResult<ClassSession, ClassSessionErrorCode>> {
  const ctx = await requireAdminOrInstructor();
  if (!ctx) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = createClassSessionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.', code: 'INVALID_STATE' };

  const studioId = await requireStudioId();

  const { templateId, startsAtISO } = parsed.data;
  // Instructors can only create sessions for themselves — ignore any passed instructorId
  const instructorId = ctx.role === 'instructor' ? ctx.instructorId : parsed.data.instructorId;

  const [template] = await db
    .select()
    .from(classTemplates)
    .where(and(eq(classTemplates.id, templateId), eq(classTemplates.studioId, studioId)))
    .limit(1);
  if (!template) return { success: false, error: 'Class template not found.', code: 'NOT_FOUND' };

  const startsAt = new Date(startsAtISO);
  if (isNaN(startsAt.getTime())) return { success: false, error: 'Invalid date or time.', code: 'INVALID_STATE' };

  const endsAt = addMinutes(startsAt, template.durationMinutes);
  const resolvedInstructorId = instructorId ?? template.instructorId ?? null;

  // 0. Studio-wide collision check (single-room studio — only one class at a time)
  const studioCollision = await checkStudioCollision(db, { startsAt, endsAt, studioId });
  if (studioCollision.hasCollision) {
    const first = studioCollision.collisions[0];
    const detail = first
      ? ` (${first.className ?? 'Another class'}${first.instructorName ? ` with ${first.instructorName}` : ''})`
      : '';
    return {
      success: false,
      error: `Studio is already booked at this time. Only one class can run simultaneously.${detail}`,
      code: 'INVALID_STATE',
    };
  }

  if (resolvedInstructorId) {
    // 1. Check overlapping class sessions for this instructor (not cancelled)
    const [conflict] = await db
      .select({ id: classSessions.id })
      .from(classSessions)
      .where(
        and(
          eq(classSessions.instructorId, resolvedInstructorId),
          ne(classSessions.status, 'cancelled'),
          lt(classSessions.startsAt, endsAt),
          gt(classSessions.endsAt, startsAt)
        )
      )
      .limit(1);

    if (conflict) {
      return { success: false, error: 'Instructor is already booked/busy for this time slot.', code: 'INVALID_STATE' };
    }

    // 2. Check Google Calendar blocks
    try {
      const { getBlocksInRange } = await import('@/modules/calendar/services/calendar-sync.service');
      const blocks = await getBlocksInRange(startsAt, endsAt, studioId);
      const hasGcalBlock = blocks.some((b) => b.instructorId === resolvedInstructorId || b.instructorId === null);
      if (hasGcalBlock) {
        return { success: false, error: 'Time slot is blocked on the instructor\'s Google Calendar.', code: 'INVALID_STATE' };
      }
    } catch (gcalErr) {
      logger.warn({ err: gcalErr }, 'createClassSession GCal availability check failed');
    }
  }

  try {
    const [session] = await db
      .insert(classSessions)
      .values({ studioId, templateId, instructorId: resolvedInstructorId, startsAt, endsAt, maxCapacity: template.maxCapacity, bookedCount: 0, waitlistCount: 0, status: 'scheduled' })
      .returning();

    revalidatePath('/admin/classes');
    revalidatePath('/book');

    try {
      const { pushSession } = await import('@/modules/calendar/services/calendar-sync.service');
      await pushSession(session.id, studioId);
    } catch (err) {
      logger.warn({ err }, 'New session GCal push failed');
    }

    return { success: true, data: session as ClassSession };
  } catch (err) {
    logger.error({ err }, 'createClassSessionAction failed');
    return { success: false, error: 'Failed to create session.', code: 'DB_ERROR' };
  }
}

export async function deleteClassSessionAction(input: { id: string }): Promise<ActionResult<null, ClassSessionErrorCode>> {
  const ctx = await requireAdminOrInstructor();
  if (!ctx) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };
  // Instructors cannot delete sessions — cancellation is the correct flow for them
  if (ctx.role === 'instructor') return { success: false, error: 'Only admins can delete sessions.', code: 'UNAUTHORIZED' };

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid ID.', code: 'INVALID_STATE' };

  const studioId = await requireStudioId();

  const [session] = await db
    .select()
    .from(classSessions)
    .where(and(eq(classSessions.id, parsed.data.id), eq(classSessions.studioId, studioId)))
    .limit(1);
  if (!session) return { success: false, error: 'Session not found.', code: 'NOT_FOUND' };

  if (session.status !== 'cancelled' && session.bookedCount > 0) {
    const cancelResult = await cancellationService.cancelSessionByInstructor(session.id, ctx.userId, studioId, 'Session deleted by administrator');
    if (!cancelResult.success) return { success: false, error: cancelResult.error ?? 'Failed to cancel session before deleting.', code: 'DB_ERROR' };
  }

  const { googleCalendarEventId, googleCalendarId, instructorId } = session;

  try {
    await db.transaction(async (tx) => {
      await tx.delete(bookings).where(and(eq(bookings.sessionId, parsed.data.id), eq(bookings.status, 'cancelled')));
      await tx.delete(classSessions).where(and(eq(classSessions.id, parsed.data.id), eq(classSessions.studioId, studioId)));
    });
    revalidatePath('/admin/classes');

    if (googleCalendarEventId && googleCalendarId && instructorId) {
      (async () => {
        try {
          const { deleteEventDirect } = await import('@/modules/calendar/services/calendar-sync.service');
          await deleteEventDirect({ instructorDbId: instructorId, googleCalendarId, googleEventId: googleCalendarEventId, studioId });
        } catch (err) {
          logger.warn({ err }, 'Session delete GCal cleanup failed');
        }
      })();
    }

    return { success: true, data: null };
  } catch (err) {
    logger.error({ err }, 'deleteClassSessionAction failed');
    return { success: false, error: 'Failed to delete session.', code: 'DB_ERROR' };
  }
}

export async function updateClassSessionAction(
  input: z.infer<typeof updateClassSessionSchema>,
): Promise<ActionResult<ClassSession, ClassSessionErrorCode>> {
  const ctx = await requireAdminOrInstructor();
  if (!ctx) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = updateClassSessionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.', code: 'INVALID_STATE' };

  const { id, maxCapacity } = parsed.data;
  // Instructors cannot reassign sessions to another instructor
  const instructorId = ctx.role === 'instructor' ? undefined : parsed.data.instructorId;

  try {
    const studioId = await requireStudioId();
    const [session] = await db
      .select()
      .from(classSessions)
      .where(and(eq(classSessions.id, id), eq(classSessions.studioId, studioId)))
      .limit(1);
    if (!session) return { success: false, error: 'Session not found.', code: 'NOT_FOUND' };

    if (ctx.role === 'instructor' && session.instructorId !== ctx.instructorId) {
      return { success: false, error: 'You can only edit your own sessions.', code: 'UNAUTHORIZED' };
    }

    if (session.bookedCount > 0 && maxCapacity !== undefined && maxCapacity < session.bookedCount) {
      return { success: false, error: `Cannot reduce capacity below ${session.bookedCount} booked students.`, code: 'INVALID_STATE' };
    }

    const updates: Partial<ClassSession> = { updatedAt: new Date() };
    if (instructorId !== undefined) updates.instructorId = instructorId;
    if (maxCapacity !== undefined) updates.maxCapacity = maxCapacity;

    const [updated] = await db.update(classSessions).set(updates).where(and(eq(classSessions.id, id), eq(classSessions.studioId, studioId))).returning();

    revalidatePath('/admin/classes');
    revalidatePath('/book');

    if (instructorId !== undefined && instructorId !== session.instructorId) {
      (async () => {
        try {
          const { pushSession } = await import('@/modules/calendar/services/calendar-sync.service');
          await pushSession(session.id, studioId);
        } catch (err) {
          logger.warn({ err }, 'Session update GCal push failed');
        }
      })();
    }

    return { success: true, data: updated as ClassSession };
  } catch (err) {
    logger.error({ err }, 'updateClassSessionAction failed');
    return { success: false, error: 'Failed to update session.', code: 'DB_ERROR' };
  }
}

export async function rescheduleClassSessionAction(
  input: z.infer<typeof rescheduleClassSessionSchema>,
): Promise<ActionResult<ClassSession, ClassSessionErrorCode>> {
  const ctx = await requireAdminOrInstructor();
  if (!ctx) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = rescheduleClassSessionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.', code: 'INVALID_STATE' };

  const { id, startsAtISO, durationMinutes } = parsed.data;

  try {
    const studioId = await requireStudioId();
    const [session] = await db
      .select()
      .from(classSessions)
      .where(and(eq(classSessions.id, id), eq(classSessions.studioId, studioId)))
      .limit(1);

    if (!session) return { success: false, error: 'Session not found.', code: 'NOT_FOUND' };

    if (ctx.role === 'instructor' && session.instructorId !== ctx.instructorId) {
      return { success: false, error: 'You can only reschedule your own sessions.', code: 'UNAUTHORIZED' };
    }
    if (session.status === 'cancelled') {
      return { success: false, error: 'Cannot reschedule a cancelled class.', code: 'INVALID_STATE' };
    }

    const newStartsAt = new Date(startsAtISO);
    if (isNaN(newStartsAt.getTime())) {
      return { success: false, error: 'Invalid date or time.', code: 'INVALID_STATE' };
    }
    if (newStartsAt <= new Date()) {
      return { success: false, error: 'New start time must be in the future.', code: 'INVALID_STATE' };
    }

    // Resolve duration: explicit override → template duration → fallback to existing gap
    let resolvedDuration = durationMinutes;
    if (!resolvedDuration && session.templateId) {
      const [tmpl] = await db
        .select({ durationMinutes: classTemplates.durationMinutes })
        .from(classTemplates)
        .where(eq(classTemplates.id, session.templateId))
        .limit(1);
      resolvedDuration = tmpl?.durationMinutes;
    }
    if (!resolvedDuration) {
      resolvedDuration = Math.round((session.endsAt.getTime() - session.startsAt.getTime()) / 60000);
    }

    const newEndsAt = addMinutes(newStartsAt, resolvedDuration);
    const now = new Date();

    const resolvedInstructorId = session.instructorId;

    // 0. Studio-wide collision check (single-room studio)
    const studioCollision = await checkStudioCollision(db, { startsAt: newStartsAt, endsAt: newEndsAt, excludeSessionId: id, studioId });
    if (studioCollision.hasCollision) {
      const first = studioCollision.collisions[0];
      const detail = first
        ? ` (${first.className ?? 'Another class'}${first.instructorName ? ` with ${first.instructorName}` : ''})`
        : '';
      return {
        success: false,
        error: `Studio is already booked at this time. Only one class can run simultaneously.${detail}`,
        code: 'INVALID_STATE',
      };
    }

    if (resolvedInstructorId) {
      // 1. Check overlapping class sessions for this instructor (not cancelled, and not this session itself)
      const [conflict] = await db
        .select({ id: classSessions.id })
        .from(classSessions)
        .where(
          and(
            eq(classSessions.instructorId, resolvedInstructorId),
            ne(classSessions.status, 'cancelled'),
            ne(classSessions.id, id),
            lt(classSessions.startsAt, newEndsAt),
            gt(classSessions.endsAt, newStartsAt)
          )
        )
        .limit(1);

      if (conflict) {
        return { success: false, error: 'Instructor is already booked/busy for this new time slot.', code: 'INVALID_STATE' };
      }

      // 2. Check Google Calendar blocks
      try {
        const { getBlocksInRange } = await import('@/modules/calendar/services/calendar-sync.service');
        const blocks = await getBlocksInRange(newStartsAt, newEndsAt, studioId);
        const hasGcalBlock = blocks.some((b) => b.instructorId === resolvedInstructorId || b.instructorId === null);
        if (hasGcalBlock) {
          return { success: false, error: 'New time slot is blocked on the instructor\'s Google Calendar.', code: 'INVALID_STATE' };
        }
      } catch (gcalErr) {
        logger.warn({ err: gcalErr }, 'rescheduleClassSession GCal availability check failed');
      }
    }

    // Capture old times before updating — used in student notification emails
    const oldStartsAt = session.startsAt;

    const [updated] = await db
      .update(classSessions)
      .set({ startsAt: newStartsAt, endsAt: newEndsAt, rescheduledAt: now, updatedAt: now })
      .where(and(eq(classSessions.id, id), eq(classSessions.studioId, studioId)))
      .returning();

    revalidatePath('/admin/classes');
    revalidatePath('/book');

    // Fire-and-forget: notify all confirmed students
    Promise.resolve().then(async () => {
      try {
        const confirmedBookings = await db
          .select({ userId: bookings.userId })
          .from(bookings)
          .where(and(eq(bookings.sessionId, id), eq(bookings.studioId, studioId), eq(bookings.status, 'confirmed')));

        if (confirmedBookings.length === 0) return;

        const [tmpl] = await db
          .select({ name: classTemplates.name, location: classTemplates.location })
          .from(classTemplates)
          .where(and(eq(classTemplates.id, session.templateId!), eq(classTemplates.studioId, studioId)))
          .limit(1);

        const studentIds = confirmedBookings.map((b) => b.userId);
        const students = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(and(inArray(users.id, studentIds), isNull(users.deletedAt)));

        const fmt = (d: Date) => ({
          date: d.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: STUDIO_TIMEZONE }),
          time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: STUDIO_TIMEZONE }),
        });
        const oldFmt = fmt(oldStartsAt);
        const newFmt = fmt(newStartsAt);

        await Promise.allSettled(
          students
            .filter((s) => s.email)
            .map((s) =>
              sendClassRescheduledEmail(
                s.email!,
                s.name ?? 'there',
                tmpl?.name ?? 'your class',
                oldFmt.date, oldFmt.time,
                newFmt.date, newFmt.time,
                newStartsAt,
                newEndsAt,
                id,
                tmpl?.location ?? undefined,
              ),
            ),
        );
      } catch (err) {
        logger.warn({ err }, 'Reschedule notification emails failed');
      }
    }).catch(() => {});

    // Fire-and-forget GCal sync with updated times
    (async () => {
      try {
        const { pushSession } = await import('@/modules/calendar/services/calendar-sync.service');
        await pushSession(id, studioId);
      } catch (err) {
        logger.warn({ err }, 'Reschedule GCal push failed');
      }
    })();

    return { success: true, data: updated as ClassSession };
  } catch (err) {
    logger.error({ err }, 'rescheduleClassSessionAction failed');
    return { success: false, error: 'Failed to reschedule session.', code: 'DB_ERROR' };
  }
}

export async function getSessionsForRangeAction(from: Date, to: Date): Promise<ActionResult<WeekViewSessionData[], ClassSessionErrorCode>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  try {
    const studioId = await requireStudioId();
    const rows = await db.query.classSessions.findMany({
      with: { template: true, instructor: { with: { user: true } } },
      where: (s, { and, gte, lte }) => and(eq(s.studioId, studioId), gte(s.startsAt, from), lte(s.startsAt, to)),
      orderBy: (s, { asc }) => [asc(s.startsAt)],
    });

    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        templateName: r.template?.name ?? '—',
        classType: (r.template?.classType ?? 'mat_group') as ClassType,
        creditType: (r.template?.creditType ?? 'pass') as CreditType,
        creditCost: r.template?.creditCost ?? 0,
        durationMinutes: r.template?.durationMinutes ?? 60,
        instructorId: r.instructorId,
        instructorName: r.instructor?.user?.name ?? null,
        startsAt: r.startsAt, endsAt: r.endsAt,
        bookedCount: r.bookedCount, maxCapacity: r.maxCapacity,
        status: r.status,
      })),
    };
  } catch (err) {
    logger.error({ err }, 'getSessionsForRangeAction failed');
    return { success: false, error: 'Failed to fetch sessions.', code: 'DB_ERROR' };
  }
}

export async function getInstructorsAction(): Promise<ActionResult<InstructorOption[], ClassSessionErrorCode>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  try {
    const studioId = await requireStudioId();
    const rows = await db
      .select({ id: instructors.id, name: users.name })
      .from(instructors)
      .innerJoin(users, and(eq(instructors.userId, users.id), isNull(users.deletedAt), eq(users.studioId, studioId)))
      .where(eq(instructors.isActive, true))
      .orderBy(asc(users.name));

    return { success: true, data: rows };
  } catch (err) {
    logger.error({ err }, 'getInstructorsAction failed');
    return { success: false, error: 'Failed to fetch instructors.', code: 'DB_ERROR' };
  }
}

export async function checkSlotAvailabilityAction(
  input: z.infer<typeof checkSlotSchema>,
): Promise<ActionResult<AvailabilityResult, ClassSessionErrorCode>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = checkSlotSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input.', code: 'INVALID_STATE' };

  const { instructorId, startsAtISO, durationMinutes, tzOffsetMinutes, excludeSessionId } = parsed.data;
  const startsAt = new Date(startsAtISO);
  const endsAt   = addMinutes(startsAt, durationMinutes);

  try {
    const { getBlocksInRange } = await import('@/modules/calendar/services/calendar-sync.service');
    const conflicts: ConflictItem[] = [];

    const studioId = await requireStudioId();

    // 0. Studio-wide collision check (always run — single-room studio)
    const studioCollision = await checkStudioCollision(db, { startsAt, endsAt, excludeSessionId, studioId });
    if (studioCollision.hasCollision) {
      for (const c of studioCollision.collisions) {
        conflicts.push({
          type: 'studio_session',
          summary: c.className
            ? `${c.className}${c.instructorName ? ` with ${c.instructorName}` : ''}`
            : 'Another class in the studio',
          startsAt: c.startsAt,
          endsAt: c.endsAt,
        });
      }
    }

    if (instructorId) {
      const overlappingSessions = await db
        .select({ startsAt: classSessions.startsAt, endsAt: classSessions.endsAt })
        .from(classSessions)
        .where(and(
          eq(classSessions.studioId, studioId),
          eq(classSessions.instructorId, instructorId),
          ne(classSessions.status, 'cancelled'),
          lt(classSessions.startsAt, endsAt),
          gt(classSessions.endsAt, startsAt),
          excludeSessionId ? ne(classSessions.id, excludeSessionId) : undefined,
        ));

      for (const s of overlappingSessions) {
        // Skip if already reported as a studio-wide collision (same time range)
        const alreadyReported = conflicts.some(
          (c) =>
            c.type === 'studio_session' &&
            c.startsAt.getTime() === s.startsAt.getTime() &&
            c.endsAt.getTime() === s.endsAt.getTime(),
        );
        if (!alreadyReported) {
          conflicts.push({ type: 'session', summary: `${APP_CONFIG.APP_NAME} class`, startsAt: s.startsAt, endsAt: s.endsAt });
        }
      }

      const blocks = await getBlocksInRange(startsAt, endsAt, studioId);
      for (const b of blocks) {
        if (b.instructorId === instructorId || b.instructorId === null) {
          conflicts.push({ type: 'gcal_block', summary: b.summary ?? 'Blocked (Google Calendar)', startsAt: b.startsAt, endsAt: b.endsAt });
        }
      }
    }

    const suggestions: string[] = [];
    if (instructorId && conflicts.length > 0) {
      const studioDateStr = studioYmd(startsAt);
      const dayStart = fromZonedTime(`${studioDateStr}T00:00:00`, STUDIO_TIMEZONE);
      const dayEnd   = fromZonedTime(`${studioDateStr}T23:59:59.999`, STUDIO_TIMEZONE);

      // In single-class mode, ALL studio sessions are busy intervals — not just this instructor's
      const daySessions = await db
        .select({ startsAt: classSessions.startsAt, endsAt: classSessions.endsAt })
        .from(classSessions)
        .where(and(
          eq(classSessions.studioId, studioId),
          ne(classSessions.status, 'cancelled'),
          lt(classSessions.startsAt, dayEnd),
          gt(classSessions.endsAt, dayStart),
          excludeSessionId ? ne(classSessions.id, excludeSessionId) : undefined,
        ));

      const dayBlocks = await getBlocksInRange(dayStart, dayEnd, studioId);
      // For suggestions, we care about studio-wide blocks (null instructor) and this instructor's blocks
      const busyIntervals = [
        ...daySessions,
        ...dayBlocks.filter((b) => b.instructorId === instructorId || b.instructorId === null),
      ];

      const requestedH = parseInt(formatInTimeZone(startsAt, STUDIO_TIMEZONE, 'H'), 10);
      const requestedM = parseInt(formatInTimeZone(startsAt, STUDIO_TIMEZONE, 'm'), 10);
      const requestedStudioMinutes = requestedH * 60 + requestedM;

      const freeBefore: string[] = [];
      const freeAfter:  string[] = [];
      const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');

      for (let localH = 7; localH < 22; localH++) {
        for (const m of [0, 30]) {
          const slotStudioMin = localH * 60 + m;
          if (slotStudioMin === requestedStudioMinutes) continue;

          const candidateStart = fromZonedTime(`${studioDateStr}T${pad(localH)}:${m === 0 ? '00' : '30'}:00`, STUDIO_TIMEZONE);
          const candidateEnd   = addMinutes(candidateStart, durationMinutes);
          const busy = busyIntervals.some((b) => b.startsAt < candidateEnd && b.endsAt > candidateStart);
          if (busy) continue;

          const localTimeStr = `${pad(localH)}:${m === 0 ? '00' : '30'}`;

          if (slotStudioMin < requestedStudioMinutes) freeBefore.push(localTimeStr);
          else freeAfter.push(localTimeStr);
        }
      }

      suggestions.push(...freeAfter.slice(0, 3), ...freeBefore.slice(-2).reverse());
    }

    return { success: true, data: { conflicts, suggestions } };
  } catch (err) {
    logger.error({ err }, 'checkSlotAvailabilityAction failed');
    return { success: false, error: 'Failed to check availability.', code: 'DB_ERROR' };
  }
}
