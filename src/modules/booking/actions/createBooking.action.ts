'use server';

import { z } from 'zod';
import { db } from '@/db';
import { bookings, classSessions, classTemplates, users, creditTransactions } from '@/db/schema';
import type { Booking } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import type { ServiceResult, ServiceErrorCode } from '@/modules/billing/services/credit.service';
import { checkRateLimit, bookingRateLimitConfig } from '@/lib/security/server-action-rate-limiter';
import { sendBookingConfirmationEmail } from '@/lib/email/resend';
import { hasCompletedWelcome } from '@/lib/welcome';
import { STUDIO_TIMEZONE } from '@/constants/BOOKING_RULES';
import { resolveAccessGrant, EntitlementError } from '@/modules/access/entitlement.service';
import { getStudioConfigContext } from '@/lib/studio/server';
import { requireStudioId } from '@/lib/studio/studio-context';
import { getUserBillingStatus } from '@/modules/billing/services/billingStatus.service';
import { getLogger } from '@/lib/logger';

const logger = getLogger('create-booking');

// ─── Input Validation ─────────────────────────────────────────────────────────

const schema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  isWelcomeJourneyBooking: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────

export async function createBookingAction(
  input: z.infer<typeof schema>,
): Promise<ServiceResult<Booking>> {
  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const authSession = await auth();
  if (!authSession?.user?.id) {
    return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };
  }
  const userId = authSession.user.id;

  // ── 1a. Rate Limiting ────────────────────────────────────────────────────────
  const rateLimitResult = await checkRateLimit(bookingRateLimitConfig, `create:${userId}`);
  if (!rateLimitResult.success) {
    return {
      success: false,
      error: 'Too many booking attempts. Please try again in a minute.',
      code: 'RATE_LIMITED',
    };
  }

  // ── 2. Zod validation ────────────────────────────────────────────────────────
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
      code: 'INVALID_STATE',
    };
  }
  const { sessionId, isWelcomeJourneyBooking } = parsed.data;

  // ── 2a. Waiver gate ──────────────────────────────────────────────────────────
  const [userRow] = await db
    .select({ hasSignedWaiver: users.hasSignedWaiver })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow?.hasSignedWaiver) {
    return {
      success: false,
      code: 'WAIVER_REQUIRED',
      error: 'Please sign the liability waiver before booking.',
    };
  }

  // ── 2b. Studio context (required by the Access Entitlement Service) ───────────
  const studioCtx = await getStudioConfigContext();
  const studio = studioCtx.config;
  const studioId = await requireStudioId();

  // ── 2c. Billing guard ─────────────────────────────────────────────────────────
  // Unified with purchase flow: users with overdue pay-at-studio bills cannot book
  // until they settle their account.
  const billing = await getUserBillingStatus(userId, studioId);
  if (billing.blockActions) {
    return {
      success: false,
      error:
        'You have overdue invoices. Please settle them at the studio or via bank transfer before booking.',
      code: 'OVERDUE_BILLS',
    };
  }

  // ── 3. Atomic transaction ─────────────────────────────────────────────────────
  try {
    const booking = await db.transaction(async (tx) => {
      // Lock session row — prevents concurrent overbooking
      const [classSession] = await tx
        .select()
        .from(classSessions)
        .where(eq(classSessions.id, sessionId))
        .for('update')
        .limit(1);

      if (!classSession) throw new BookingError('Session not found.', 'NOT_FOUND');
      if (classSession.studioId !== studioId) {
        throw new BookingError('Session not found.', 'NOT_FOUND');
      }

      if (classSession.status !== 'scheduled') {
        throw new BookingError('This class is no longer available for booking.', 'INVALID_STATE');
      }

      if (classSession.startsAt <= new Date()) {
        throw new BookingError('This class has already started or passed.', 'INVALID_STATE');
      }

      if (classSession.bookedCount >= classSession.maxCapacity) {
        throw new BookingError('This class is full.', 'CLASS_FULL');
      }

      // Studio collision check — another session may have been created since the page loaded
      const { checkStudioCollision } = await import('@/modules/classes/services/studio-schedule.service');
      const studioCollision = await checkStudioCollision(tx, {
        startsAt: classSession.startsAt,
        endsAt: classSession.endsAt,
        excludeSessionId: classSession.id,
        studioId,
      });
      if (studioCollision.hasCollision) {
        throw new BookingError(
          'This time slot is no longer available — another class was scheduled. Please choose another session.',
          'INVALID_STATE',
        );
      }

      // Instructor unavailable? Reject server-side too — UI might be stale
      // or the user might call the action directly.
      if (classSession.instructorId) {
        const { getBlocksInRange } = await import(
          '@/modules/calendar/services/calendar-sync.service'
        );
        const blocks = await getBlocksInRange(classSession.startsAt, classSession.endsAt, studioId);
        const overlap = blocks.find(
          (b) =>
            b.instructorId === classSession.instructorId &&
            b.startsAt < classSession.endsAt &&
            b.endsAt > classSession.startsAt,
        );
        if (overlap) {
          throw new BookingError(
            'The instructor is unavailable for this class. Please choose another session.',
            'INVALID_STATE',
          );
        }
      }

      // The unique index bookings_user_session_unique_idx covers (userId, sessionId)
      // without a status filter, so a cancelled row blocks re-insertion for the same
      // slot. We delete only the user's own cancelled row for this session so they can
      // rebook. The credit ledger (creditTransactions) is the authoritative audit trail
      // for the original booking and cancellation; this row's purpose is fulfilled.
      // TODO: change the unique index to a partial index (WHERE status = 'confirmed')
      // so cancelled rows are kept without needing this delete.
      await tx
        .delete(bookings)
        .where(
          and(
            eq(bookings.userId, userId),
            eq(bookings.sessionId, sessionId),
            eq(bookings.status, 'cancelled'),
          ),
        );

      // Prevent duplicate bookings for the same user + session
      const [existing] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.userId, userId),
            eq(bookings.sessionId, sessionId),
            eq(bookings.status, 'confirmed'),
          ),
        )
        .limit(1);

      if (existing) {
        throw new BookingError(
          'You already have a booking for this class.',
          'BOOKING_ALREADY_EXISTS',
        );
      }

      // Fetch credit cost and type from the class template
      if (!classSession.templateId) {
        throw new BookingError('Class template not configured for this session.', 'NOT_FOUND');
      }

      const [template] = await tx
        .select({
          creditCost: classTemplates.creditCost,
          creditType: classTemplates.creditType,
          classType: classTemplates.classType,
          isWelcomeJourney: classTemplates.isWelcomeJourney,
        })
        .from(classTemplates)
        .where(eq(classTemplates.id, classSession.templateId))
        .limit(1);

      if (!template) throw new BookingError('Class template not found.', 'NOT_FOUND');

      // Welcome Journey gate: intro sessions are never booked via the public calendar
      if (template.isWelcomeJourney && !isWelcomeJourneyBooking) {
        throw new BookingError(
          'Welcome Journey sessions are booked only through your Welcome Journey page when the studio offers you a time slot.',
          'INVALID_STATE',
        );
      }

      if (!isWelcomeJourneyBooking) {
        const welcomed = await hasCompletedWelcome(userId);
        // Yoga classes are open to everyone — no Welcome Journey required.
        if (!welcomed && template.classType !== 'yoga') {
          throw new BookingError(
            'Please complete your Welcome Journey first. Buy the Welcome Journey package, book your intro session, and attend it before booking Reformer, Mat, Chair and other Pilates apparatus classes. Yoga classes are open to everyone!',
            'WELCOME_REQUIRED',
          );
        }
      }

      // ── Membership session-subtype restriction ──────────────────────────────
      // Centralized check: if the user has an active membership with a
      // sessionSubtype restriction, they may only book matching session types.
      const { checkMembershipSessionRestriction } = await import(
        '@/modules/billing/services/membershipRestriction.service'
      );
      const restriction = await checkMembershipSessionRestriction(tx, userId, template.classType);
      if (!restriction.allowed) {
        throw new BookingError(restriction.reason, 'INVALID_STATE');
      }

      // ── Phase 4: resolve and consume access entitlement ─────────────────────
      const { grant } = await resolveAccessGrant(
        {
          studioConfig: studio,
          studioId,
          userId,
          tx,
        },
        {
          classType: template.classType,
          sessionId,
          cost: template.creditCost,
        },
      );

      // Insert booking with the resolved access grant
      const [newBooking] = await tx
        .insert(bookings)
        .values({
          studioId,
          userId,
          sessionId,
          status: 'confirmed',
          creditsSpent: template.creditCost,
          creditType: template.creditType,
          accessProvider: grant.provider,
          accessGrant: {
            grantId: grant.grantId,
            provider: grant.provider,
            label: grant.label,
            quantityConsumed: grant.quantityConsumed,
            metadata: grant.metadata,
          },
        })
        .returning();

      // Link the credit transaction to the booking when the credit system was used.
      if (grant.provider === 'credit_system' && grant.metadata?.creditTransactionId) {
        await tx
          .update(creditTransactions)
          .set({ bookingId: newBooking.id })
          .where(eq(creditTransactions.id, grant.metadata.creditTransactionId as string));
      }

      // Increment session counter
      await tx
        .update(classSessions)
        .set({ bookedCount: classSession.bookedCount + 1, updatedAt: new Date() })
        .where(eq(classSessions.id, sessionId));

      return newBooking;
    });

    revalidatePath('/book');
    revalidatePath('/');

    // Fire-and-forget — email failure must never roll back a successful booking
    Promise.resolve().then(async () => {
      try {
        const [[userRow], [sessionRow]] = await Promise.all([
          db.select({ email: users.email, name: users.name })
            .from(users).where(eq(users.id, userId)).limit(1),
          db.select({
              startsAt: classSessions.startsAt,
              endsAt: classSessions.endsAt,
              title: classTemplates.name,
              location: classTemplates.location,
            })
            .from(classSessions)
            .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
            .where(eq(classSessions.id, sessionId)).limit(1),
        ]);
        if (userRow?.email && sessionRow) {
          const classDate = sessionRow.startsAt.toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: STUDIO_TIMEZONE,
          });
          const classTime = sessionRow.startsAt.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', timeZone: STUDIO_TIMEZONE,
          });
          await sendBookingConfirmationEmail(
            userRow.email,
            userRow.name ?? 'there',
            sessionRow.title,
            classDate,
            classTime,
            sessionRow.startsAt,
            sessionRow.endsAt,
            booking.id,
            sessionRow.location ?? undefined,
          );
        }
      } catch (err) {
        logger.warn({ err }, 'Booking confirmation email failed');
      }
    }).catch(() => {});

    // Fire-and-forget Google Calendar sync (updates attendee list in description).
    // Lazy import keeps googleapis out of the booking hot path's bundle graph.
    (async () => {
      try {
        const { updateAttendeesInDescription } = await import(
          '@/modules/calendar/services/calendar-sync.service'
        );
        await updateAttendeesInDescription(sessionId, studioId);
      } catch (err) {
        logger.warn({ err }, 'Booking GCal sync failed');
      }
    })();

    return { success: true, data: booking as Booking };
  } catch (err) {
    if (err instanceof EntitlementError) {
      return { success: false, error: err.message, code: 'INSUFFICIENT_CREDITS' };
    }
    if (err instanceof BookingError) {
      return { success: false, error: err.message, code: err.code };
    }
    logger.error({ err }, 'createBookingAction failed');
    return { success: false, error: 'Failed to create booking.', code: 'DB_ERROR' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class BookingError extends Error {
  constructor(
    message: string,
    public readonly code: ServiceErrorCode,
  ) {
    super(message);
    this.name = 'BookingError';
  }
}
