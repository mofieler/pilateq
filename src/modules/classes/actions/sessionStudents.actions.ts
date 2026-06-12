'use server';

import { z } from 'zod';
import { db } from '@/db';
import { bookings, users, classSessions } from '@/db/schema';
import { eq, and, isNull, asc, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAdmin, requireAdminOrInstructor, ActionAuthError } from '@/lib/auth/action-auth';
import { requireStudioId } from '@/lib/studio/studio-context';
import { APP_CONFIG } from '@/constants/APP_CONFIG';
import { ActionResult } from '@/lib/types/action.types';
import type { CreditType } from '@/lib/config/class-types';
import { isWelcomeJourneyBooking } from '@/lib/welcome';
import { cancellationService } from '@/modules/booking/services/cancellation.service';
import { verifyBookingStudio } from '@/lib/security/tenant-guard';
import { getLogger } from '@/lib/logger';

const logger = getLogger('session-students');

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionStudent = {
  userId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  bookingId: string;
  bookingStatus: string;
  creditsSpent: number;
  creditType: CreditType;
  bookedAt: Date;
};

type SessionStudentErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'DB_ERROR'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN_ERROR';

async function requireAdminContext(): Promise<
  ActionResult<never, 'UNAUTHORIZED'> | { userId: string; role: string; studioId: string }
> {
  try {
    return await requireAdmin();
  } catch (err) {
    if (err instanceof ActionAuthError) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }
    throw err;
  }
}

async function requireAdminOrInstructorContext(): Promise<
  ActionResult<never, 'UNAUTHORIZED'> | { userId: string; role: string; studioId: string }
> {
  try {
    return await requireAdminOrInstructor();
  } catch (err) {
    if (err instanceof ActionAuthError) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }
    throw err;
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getSessionStudentsAction(sessionId: string): Promise<ActionResult<SessionStudent[], SessionStudentErrorCode>> {
  const auth = await requireAdminOrInstructorContext();
  if ('success' in auth) return auth;

  try {
    const studioId = await requireStudioId();
    const data = await db
      .select({
        userId: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl,
        bookingId: bookings.id, bookingStatus: bookings.status,
        creditsSpent: bookings.creditsSpent, creditType: bookings.creditType,
        bookedAt: bookings.bookedAt,
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.userId, users.id))
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .where(
        and(
          eq(bookings.sessionId, sessionId),
          eq(bookings.studioId, studioId),
          eq(classSessions.studioId, studioId),
          inArray(bookings.status, ['confirmed', 'attended']),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(asc(bookings.bookedAt))
      .limit(APP_CONFIG.MAX_PAGE_SIZE);

    return { success: true, data: data as SessionStudent[] };
  } catch (err) {
    logger.error({ err }, 'getSessionStudentsAction failed');
    return { success: false, error: 'Failed to load students.', code: 'DB_ERROR' };
  }
}

const removeStudentSchema = z.object({
  bookingId: z.string().uuid(),
  reason:    z.string().min(3).max(500),
});

export async function removeStudentFromSessionAction(
  input: z.infer<typeof removeStudentSchema>,
): Promise<ActionResult<{ success: boolean }, SessionStudentErrorCode>> {
  const auth = await requireAdminContext();
  if ('success' in auth) return auth;
  const { userId } = auth;

  const parsed = removeStudentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'INVALID_STATE' };

  const { bookingId, reason } = parsed.data;

  try {
    const studioId = await requireStudioId();
    const bookingBelongs = await verifyBookingStudio(bookingId, studioId);
    if (!bookingBelongs) {
      return { success: false, error: 'Booking not found', code: 'NOT_FOUND' };
    }

    const result = await cancellationService.cancel(bookingId, userId, reason);
    if (!result.success) {
      return { success: false, error: result.error ?? 'Failed to remove student.', code: result.code as SessionStudentErrorCode };
    }

    revalidatePath('/admin/classes');
    revalidatePath('/book');

    return { success: true, data: { success: true } };
  } catch (err) {
    logger.error({ err }, 'removeStudentFromSessionAction failed');
    return { success: false, error: 'Failed to remove student.', code: 'DB_ERROR' };
  }
}

// ─── Mark booking as attended ─────────────────────────────────────────────────

const markAttendedSchema = z.object({
  bookingId: z.string().uuid(),
});

export async function markBookingAttendedAction(
  input: z.infer<typeof markAttendedSchema>,
): Promise<ActionResult<{ success: boolean }, SessionStudentErrorCode>> {
  const auth = await requireAdminContext();
  if ('success' in auth) return auth;

  const parsed = markAttendedSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'INVALID_STATE' };

  const { bookingId } = parsed.data;

  try {
    const studioId = await requireStudioId();

    const [bookingData] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.studioId, studioId))).limit(1);
    if (!bookingData) return { success: false, error: 'Booking not found', code: 'NOT_FOUND' };
    if (bookingData.status !== 'confirmed') {
      return { success: false, error: 'Can only mark confirmed bookings as attended', code: 'INVALID_STATE' };
    }

    const [sessionRow] = await db
      .select({ endsAt: classSessions.endsAt })
      .from(bookings)
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .where(and(eq(bookings.id, bookingId), eq(bookings.studioId, studioId), eq(classSessions.studioId, studioId)))
      .limit(1);

    if (!sessionRow?.endsAt) {
      return { success: false, error: 'Booking has no session.', code: 'NOT_FOUND' };
    }

    const now = new Date();
    if (sessionRow.endsAt.getTime() > now.getTime()) {
      return {
        success: false,
        error: 'You can only mark attendance after the class has ended (scheduled end time).',
        code: 'INVALID_STATE',
      };
    }

    await db.transaction(async (tx) => {
      // Update booking status
      await tx
        .update(bookings)
        .set({ status: 'attended', updatedAt: new Date() })
        .where(and(eq(bookings.id, bookingId), eq(bookings.studioId, studioId)));

      // If this was the Welcome Journey, mark the user as welcomed
      const isWelcome = await isWelcomeJourneyBooking(bookingId, tx);
      if (isWelcome) {
        await tx
          .update(users)
          .set({ welcomeCompletedAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, bookingData.userId));
      }
    });

    revalidatePath('/admin/classes');
    revalidatePath('/admin');
    revalidatePath('/book');
    revalidatePath('/bookings');
    revalidatePath('/');

    return { success: true, data: { success: true } };
  } catch (err) {
    logger.error({ err }, 'markBookingAttendedAction failed');
    return { success: false, error: 'Failed to mark as attended.', code: 'DB_ERROR' };
  }
}
