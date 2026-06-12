import { db } from '@/db';
import { auth } from '@/lib/auth/auth';
import { bookings, users, classSessions, classTemplates, waitlistEntries, instructors, cancellationMercyUses, duoInvites, welcomeJourneyRequests, creditPurchases, creditPackages } from '@/db/schema';
import type { Booking } from '@/db/schema';
import { eq, and, inArray, isNull, or, sql, gte, lt, ne } from 'drizzle-orm';
import { sendBookingCancellationEmail, sendClassCancelledByAdminEmail, sendInstructorCancellationNotificationEmail, sendDuoPartnerCancelledEmail } from '@/lib/email/resend';
import { addHours } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { creditService } from '@/modules/billing/services/credit.service';
import type { ServiceResult, ServiceErrorCode } from '@/modules/billing/services/credit.service';
import { CANCELLATION_WINDOW_HOURS, CANCELLATION_CUTOFF_HOURS, MERCY_USES_PER_MONTH, STUDIO_TIMEZONE } from '@/constants/BOOKING_RULES';
import { releaseAccessGrant } from '@/modules/access/entitlement.service';
import { getStudioConfigContext } from '@/lib/studio/server';
import type { AccessGrant } from '@/lib/plugins/types';
import { getLogger } from '@/lib/logger';
import { isWithinCancellationWindow, isSelfCancellationBlocked } from '@/lib/utils/booking.utils';

const logger = getLogger('cancellation');

// Transaction client type for composing mercy checks inside other transactions
type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Per-calendar-month mercy-use count. Resets on the 1st of each month (Berlin).
// Uses a sargable range query on the (user_id, used_at) index.
async function countMercyUsesThisMonth(
  client: TxClient | typeof db,
  userId: string,
): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const monthEnd   = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

  const [row] = await client
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(cancellationMercyUses)
    .where(
      and(
        eq(cancellationMercyUses.userId, userId),
        gte(cancellationMercyUses.usedAt, monthStart),
        lt(cancellationMercyUses.usedAt, monthEnd),
      ),
    );
  return row?.count ?? 0;
}

export type { ServiceResult, ServiceErrorCode };

// ─────────────────────────────────────────────────────────────────────────────


// ─── Result Types ─────────────────────────────────────────────────────────────

export type CancellationResult = {
  booking: Booking;
  refundIssued: boolean;
  mercyApplied: boolean;
  creditsRefunded: number;
  // Remaining mercy uses for the canceller this calendar month AFTER this cancel.
  // Equals MERCY_USES_PER_MONTH when no mercy was used (≥24h cancel).
  mercyUsesLeftAfter: number;
  mercyUsesLimit: number;
  message: string;
};

export type InstructorCancellationResult = {
  sessionId: string;
  totalBookingsCancelled: number;
  totalCreditsRefunded: number;
  affectedUserIds: string[];
};

class SessionCancellationError extends Error {
  constructor(message: string, public readonly code: ServiceErrorCode) {
    super(message);
    this.name = 'SessionCancellationError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Access release helper (Phase 4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Release the access entitlement held by a booking.
 *
 * Modern bookings store the access provider + grant on the row. Legacy bookings
 * fall back to the direct credit refund path.
 */
async function releaseBookingAccess(
  tx: TxClient,
  booking: Booking,
  description: string,
  purchaseId?: string,
): Promise<{ refundIssued: true; creditsRefunded: number }> {
  if (!booking.accessProvider) {
    await creditService.refund(tx, {
      studioId: booking.studioId,
      userId: booking.userId,
      creditType: booking.creditType,
      amount: booking.creditsSpent,
      bookingId: booking.id,
      description,
    });
    return { refundIssued: true, creditsRefunded: booking.creditsSpent };
  }

  const studioCtx = await getStudioConfigContext();
  const storedGrant = booking.accessGrant as AccessGrant | null;
  if (!storedGrant) {
    throw new SessionCancellationError('Booking is missing access grant metadata.', 'INVALID_STATE');
  }

  const grant: AccessGrant = {
    ...storedGrant,
    metadata: { ...storedGrant.metadata, bookingId: booking.id },
  };

  await releaseAccessGrant(
    {
      studioConfig: studioCtx.config,
      studioId: studioCtx.config.id ?? 'legacy',
      userId: booking.userId,
      tx,
    },
    grant,
  );

  const creditsRefunded = booking.accessProvider === 'credit_system' ? booking.creditsSpent : 0;
  return { refundIssued: true, creditsRefunded };
}

// ─────────────────────────────────────────────────────────────────────────────
// CANCELLATION SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export const cancellationService = {
  /**
   * Cancel a single booking initiated by a student or admin.
   *
   * Rules applied in order:
   *  1. >24h before class  → full refund, no penalty.
   *  2. <24h, first time   → First-Time Mercy grace; full refund, flag used.
   *  3. <24h, mercy used   → no refund; credits forfeited.
   *
   * creditService.refund is called INSIDE the transaction so the
   * balance update and booking status change are a single atomic operation.
   */
  async cancel(
    bookingId: string,
    requestingUserId: string,
    reason?: string,
  ): Promise<ServiceResult<CancellationResult>> {
    // ── 1. Authorization ────────────────────────────────────────────────────
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, requestingUserId), isNull(users.deletedAt)))
      .limit(1);

    if (!requestingUser?.studioId) {
      return { success: false, error: 'Not authorized.', code: 'UNAUTHORIZED' };
    }

    // ── 2. Fetch booking scoped to the requesting user's studio ─────────────
    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.studioId, requestingUser.studioId)))
      .limit(1);

    if (!booking) {
      return { success: false, error: 'Booking not found.', code: 'NOT_FOUND' };
    }

    // Tenant isolation: the booking and the requesting user must belong to the same studio.
    if (requestingUser.studioId !== booking.studioId) {
      return { success: false, error: 'Not authorized.', code: 'UNAUTHORIZED' };
    }

    const isOwner = booking.userId === requestingUserId;
    const isAdmin = requestingUser?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return { success: false, error: 'Not authorized.', code: 'UNAUTHORIZED' };
    }

    // ── 3. State validation ─────────────────────────────────────────────────
    if (booking.status === 'cancelled') {
      return { success: false, error: 'Booking is already cancelled.', code: 'ALREADY_CANCELLED' };
    }

    // ── 4. Fetch class session ──────────────────────────────────────────────
    const [session] = await db
      .select()
      .from(classSessions)
      .where(
        and(
          eq(classSessions.id, booking.sessionId!),
          eq(classSessions.studioId, booking.studioId),
        ),
      )
      .limit(1);

    if (!session) {
      return { success: false, error: 'Session not found.', code: 'NOT_FOUND' };
    }

    // ── 5. Fetch student for mercy check ────────────────────────────────────
    const [student] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, booking.userId), eq(users.studioId, booking.studioId), isNull(users.deletedAt)))
      .limit(1);

    if (!student) {
      return { success: false, error: 'Student not found.', code: 'NOT_FOUND' };
    }

    // ── 6. Apply cancellation rule engine ───────────────────────────────────
    const now = new Date();

    // Block cancellation of classes that have already started or passed.
    if (session.startsAt <= now) {
      return { success: false, error: 'This class has already started or passed and cannot be cancelled.', code: 'INVALID_STATE' };
    }

    // Hard cutoff: within 3 hours of class start, users cannot self-cancel.
    // They must contact the admin directly. Admins can still cancel.
    if (!isAdmin && isSelfCancellationBlocked(session.startsAt, now)) {
      return {
        success: false,
        error: `Cancellation is closed — the class starts in less than ${CANCELLATION_CUTOFF_HOURS} hours. Please contact the studio directly to cancel.`,
        code: 'OUTSIDE_CANCELLATION_WINDOW',
      };
    }

    const hoursUntilClass = Math.floor((session.startsAt.getTime() - now.getTime()) / (60 * 60 * 1000));
    const isWithinWindow = isWithinCancellationWindow(session.startsAt, now);

    // Grace window: if the class was rescheduled AFTER this student booked,
    // they get CANCELLATION_WINDOW_HOURS from the reschedule announcement to cancel
    // for free — even if the class is less than 24 hours away. The grace is
    // ALWAYS bounded by class start: once the class begins, no cancellation is
    // possible (also enforced by the early return above on session.startsAt).
    const rescheduledGraceFree =
      session.rescheduledAt !== null &&
      session.rescheduledAt > booking.bookedAt &&
      now < addHours(session.rescheduledAt, CANCELLATION_WINDOW_HOURS) &&
      now < session.startsAt;

    let refundIssued = false;
    let mercyApplied = false;
    let creditsRefunded = 0;
    let mercyUsesLeftAfter = MERCY_USES_PER_MONTH;

    if (rescheduledGraceFree) {
      refundIssued = true;
      logger.info({ userId: student.id, bookingId, rescheduledAt: session.rescheduledAt }, 'Reschedule grace cancellation applied');
    } else if (!isWithinWindow || isAdmin) {
      refundIssued = true;
    }
    // Inside-24h decisions (mercy or loss) happen INSIDE the transaction so the
    // count + insert are race-safe under concurrent cancels by the same user.

    // ── 7. Atomic DB transaction ────────────────────────────────────────────
    let duoPartnerDetails: { email: string | null; name: string | null; bookingId: string } | null = null;

    try {
      const updatedBooking = await db.transaction(async (tx) => {
        // Re-read booking under lock — prevents double-refund if two cancel
        // requests race (e.g. user + admin simultaneously). Without this, both
        // could read 'confirmed' outside the tx and both issue a refund.
        const [locked] = await tx
          .select({ status: bookings.status })
          .from(bookings)
          .where(eq(bookings.id, bookingId))
          .for('update')
          .limit(1);

        if (locked?.status === 'cancelled') {
          throw new SessionCancellationError('Booking already cancelled.', 'ALREADY_CANCELLED');
        }

        // If late cancellation (not refundIssued yet), evaluate mercy now.
        // Lock the user row so two parallel late-cancels by the same user
        // serialize and only the right number of mercy slots get consumed.
        if (isWithinWindow && !rescheduledGraceFree && !refundIssued) {
          await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, booking.userId))
            .for('update')
            .limit(1);

          const usedThisMonth = await countMercyUsesThisMonth(tx, booking.userId);

          if (usedThisMonth < MERCY_USES_PER_MONTH) {
            mercyApplied = true;
            refundIssued = true;
            mercyUsesLeftAfter = MERCY_USES_PER_MONTH - usedThisMonth - 1;
            await tx.insert(cancellationMercyUses).values({
              studioId: booking.studioId,
              userId: booking.userId,
              bookingId: booking.id,
            });
            logger.info({
              userId: student.id, bookingId, hoursUntilClass,
              usedThisMonth, mercyUsesLeftAfter,
            }, 'Monthly mercy applied');
          } else {
            mercyUsesLeftAfter = 0;
            logger.info({
              userId: student.id, bookingId, hoursUntilClass,
              limit: MERCY_USES_PER_MONTH,
            }, 'Mercy quota exhausted — credits forfeited');
          }
        }

        // Check if this session is a Welcome Journey session
        const [sessionWithTemplate] = await tx
          .select({
            isWelcomeJourney: classTemplates.isWelcomeJourney,
          })
          .from(classSessions)
          .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
          .where(
            and(
              eq(classSessions.id, booking.sessionId!),
              eq(classSessions.studioId, booking.studioId),
            ),
          )
          .limit(1);

        const isWelcomeJourney = sessionWithTemplate?.isWelcomeJourney ?? false;

        let welcomePurchaseId: string | undefined;
        if (isWelcomeJourney) {
          // Reset the welcome request status to 'cancelled' so they can request again
          await tx
            .update(welcomeJourneyRequests)
            .set({ status: 'cancelled', updatedAt: now })
            .where(
              and(
                eq(welcomeJourneyRequests.userId, booking.userId),
                eq(welcomeJourneyRequests.studioId, booking.studioId),
                eq(welcomeJourneyRequests.status, 'booked'),
              ),
            );

          // Find their Welcome Journey package purchase
          const [welcomePurchase] = await tx
            .select({ id: creditPurchases.id })
            .from(creditPurchases)
            .innerJoin(creditPackages, eq(creditPurchases.packageId, creditPackages.id))
            .where(
              and(
                eq(creditPurchases.userId, booking.userId),
                eq(creditPurchases.studioId, booking.studioId),
                eq(creditPackages.studioId, booking.studioId),
                eq(creditPackages.name, 'Welcome Journey'),
                ne(creditPurchases.paymentStatus, 'cancelled'),
              ),
            )
            .limit(1);

          if (welcomePurchase) {
            welcomePurchaseId = welcomePurchase.id;
          }
        }

        const [result] = await tx
          .update(bookings)
          .set({
            status: 'cancelled',
            cancellationType: isAdmin ? 'admin_cancelled' : 'user_cancelled',
            mercyApplied,
            cancelledAt: now,
            cancellationReason: reason ?? null,
            updatedAt: now,
          })
          .where(eq(bookings.id, bookingId))
          .returning();

        await tx
          .update(classSessions)
          .set({ bookedCount: sql`${classSessions.bookedCount} - 1`, updatedAt: now })
          .where(eq(classSessions.id, session.id));

        if (refundIssued) {
          const refundResult = await releaseBookingAccess(
            tx,
            booking,
            mercyApplied
              ? `Refund: Late cancellation mercy (${mercyUsesLeftAfter}/${MERCY_USES_PER_MONTH} left this month)`
              : 'Refund: Cancellation within policy window',
            welcomePurchaseId,
          );
          creditsRefunded = refundResult.creditsRefunded;
        }

        // ── Duo symmetric cancellation ──────────────────────────────────────
        // If this booking is part of an accepted duo, the partner's booking
        // must be cancelled with the SAME refund outcome (fairness). The
        // canceller's mercy is consumed once; the partner is not charged
        // a separate mercy slot.
        const [duo] = await tx
          .select()
          .from(duoInvites)
          .where(
            and(
              eq(duoInvites.status, 'accepted'),
              or(
                eq(duoInvites.organizerBookingId, booking.id),
                eq(duoInvites.partnerBookingId, booking.id),
              ),
            ),
          )
          .for('update')
          .limit(1);

        if (duo) {
          const partnerBookingId =
            duo.organizerBookingId === booking.id
              ? duo.partnerBookingId
              : duo.organizerBookingId;

          if (partnerBookingId) {
            // We deliberately do NOT take FOR UPDATE on the partner booking.
            // The duoInvites row is already locked, which serializes all duo
            // cancellation paths. Taking a second booking lock here creates a
            // deadlock risk when both partners cancel simultaneously.
            const [partnerBooking] = await tx
              .select()
              .from(bookings)
              .where(eq(bookings.id, partnerBookingId))
              .limit(1);

            // Skip if partner booking was already cancelled (idempotent)
            if (partnerBooking && partnerBooking.status !== 'cancelled') {
              const [partnerUser] = await tx
                .select({ name: users.name, email: users.email })
                .from(users)
                .where(eq(users.id, partnerBooking.userId))
                .limit(1);

              duoPartnerDetails = {
                email: partnerUser?.email ?? null,
                name: partnerUser?.name ?? null,
                bookingId: partnerBooking.id,
              };

              await tx
                .update(bookings)
                .set({
                  status: 'cancelled',
                  cancellationType: isAdmin ? 'admin_cancelled' : 'user_cancelled',
                  mercyApplied: false, // partner does not consume their own mercy
                  cancelledAt: now,
                  cancellationReason: `Duo partner cancelled: ${reason ?? 'no reason given'}`,
                  updatedAt: now,
                })
                .where(eq(bookings.id, partnerBookingId));

              await tx
                .update(classSessions)
                .set({ bookedCount: sql`${classSessions.bookedCount} - 1`, updatedAt: now })
                .where(eq(classSessions.id, partnerBooking.sessionId!));

              // Same outcome for the partner: refund if the canceller got a
              // refund, otherwise let the credits forfeit too. Mercy is not
              // re-evaluated for the partner.
              if (refundIssued) {
                await releaseBookingAccess(
                  tx,
                  partnerBooking,
                  'Refund: Duo partner cancelled the shared session',
                );
              }

              // Mark the invite as cancelled so it can't be re-confirmed
              await tx
                .update(duoInvites)
                .set({ status: 'cancelled', updatedAt: now })
                .where(eq(duoInvites.id, duo.id));

              logger.info({
                cancellerBookingId: booking.id,
                partnerBookingId,
                refundIssued,
              }, 'Duo partner booking cancelled symmetrically');
            }
          }
        }

        return result;
      });

      logger.info({ bookingId, refundIssued, mercyApplied, creditsRefunded }, 'Booking cancelled');

      // ── 8. Fire-and-forget side effects (outside transaction) ─────────────
      Promise.resolve().then(async () => {
        try {
          const [tmpl] = await db
            .select({ name: classTemplates.name, location: classTemplates.location })
            .from(classTemplates)
            .where(eq(classTemplates.id, session.templateId!))
            .limit(1);
          const classDate = session.startsAt.toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: STUDIO_TIMEZONE,
          });
          const classTime = session.startsAt.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', timeZone: STUDIO_TIMEZONE,
          });

          // Student cancellation confirmation
          await sendBookingCancellationEmail(
            student.email!,
            student.name ?? 'there',
            tmpl?.name ?? 'your class',
            classDate,
            classTime,
            refundIssued,
            session.startsAt,
            session.endsAt,
            booking.id,
            tmpl?.location ?? undefined,
          );

          // Duo Partner cancellation notification
          if (duoPartnerDetails && duoPartnerDetails.email) {
            await sendDuoPartnerCancelledEmail(
              duoPartnerDetails.email,
              duoPartnerDetails.name ?? 'there',
              isAdmin ? 'The studio' : (student.name ?? 'Your partner'),
              tmpl?.name ?? 'your duo class',
              classDate,
              classTime,
              refundIssued,
            );
          }

          // Instructor notification — always sent regardless of refund outcome
          if (session.instructorId) {
            const [instructorRow] = await db
              .select({ email: users.email, name: users.name })
              .from(instructors)
              .innerJoin(users, and(eq(instructors.userId, users.id), isNull(users.deletedAt)))
              .where(and(eq(instructors.id, session.instructorId), eq(instructors.studioId, booking.studioId)))
              .limit(1);

            if (instructorRow?.email) {
              await sendInstructorCancellationNotificationEmail(
                instructorRow.email,
                instructorRow.name ?? 'Instructor',
                student.name ?? 'A student',
                tmpl?.name ?? 'the class',
                classDate,
                classTime,
                refundIssued,
              );

              // Instructor notification for partner cancellation
              if (duoPartnerDetails) {
                await sendInstructorCancellationNotificationEmail(
                  instructorRow.email,
                  instructorRow.name ?? 'Instructor',
                  duoPartnerDetails.name ?? 'Duo partner',
                  tmpl?.name ?? 'the class',
                  classDate,
                  classTime,
                  refundIssued,
                );
              }
            }
          }
        } catch (err) {
          logger.warn({ err }, 'Cancellation email failed');
        }
      }).catch(() => {});

      revalidatePath('/book');
      revalidatePath('/');

      // Fire-and-forget Google Calendar sync (refresh attendee list).
      (async () => {
        try {
          const { updateAttendeesInDescription } = await import(
            '@/modules/calendar/services/calendar-sync.service'
          );
          if (booking.sessionId) await updateAttendeesInDescription(booking.sessionId, booking.studioId);
        } catch (err) {
          logger.warn({ err }, 'Cancel GCal sync failed');
        }
      })();

      return {
        success: true,
        data: {
          booking: updatedBooking as Booking,
          refundIssued,
          mercyApplied,
          creditsRefunded,
          mercyUsesLeftAfter,
          mercyUsesLimit: MERCY_USES_PER_MONTH,
          message: rescheduledGraceFree
            ? 'Booking cancelled. Full refund issued — the class was rescheduled after you booked.'
            : mercyApplied
              ? `Booking cancelled. Late-cancellation mercy applied — credits refunded. ${mercyUsesLeftAfter} of ${MERCY_USES_PER_MONTH} mercy uses left this month.`
              : refundIssued
                ? 'Booking cancelled. Credits have been refunded.'
                : `Booking cancelled. Credits forfeited — no mercy uses left this month (limit ${MERCY_USES_PER_MONTH}).`,
        },
      };
    } catch (err) {
      if (err instanceof SessionCancellationError) {
        return { success: false, error: err.message, code: err.code };
      }
      logger.error({ err, bookingId }, 'Cancellation transaction failed');
      return {
        success: false,
        error: 'An error occurred while cancelling your booking.',
        code: 'DB_ERROR',
      };
    }
  },

  /**
   * Instructor or admin cancels an entire class session.
   * ALL confirmed bookings are cancelled and fully refunded atomically.
   * All waitlist entries for the session are also cancelled.
   */
  async cancelSessionByInstructor(
    sessionId: string,
    cancelledByUserId: string,
    adminStudioId: string,
    reason: string,
  ): Promise<ServiceResult<InstructorCancellationResult>> {
    try {
      const result = await db.transaction(async (tx) => {
        // Lock the session row first so no new bookings can be inserted or
        // status-flipped while we cancel. The createBooking action also takes
        // FOR UPDATE on this row, so the two paths serialize cleanly.
        const [sessionWithTemplate] = await tx
          .select({
            session: classSessions,
            isWelcomeJourney: classTemplates.isWelcomeJourney,
          })
          .from(classSessions)
          .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
          .where(and(eq(classSessions.id, sessionId), eq(classSessions.studioId, adminStudioId)))
          .for('update')
          .limit(1);

        if (!sessionWithTemplate) {
          throw new SessionCancellationError('Session not found.', 'NOT_FOUND');
        }
        const { session, isWelcomeJourney } = sessionWithTemplate;
        if (session.studioId !== adminStudioId) {
          throw new SessionCancellationError('Session not found.', 'NOT_FOUND');
        }
        if (session.status === 'cancelled') {
          throw new SessionCancellationError('Session already cancelled.', 'ALREADY_CANCELLED');
        }

        // Fetch confirmed bookings INSIDE the locked tx — anything that raced
        // ahead of us is now visible and gets refunded along with the rest.
        const confirmedBookings = await tx
          .select()
          .from(bookings)
          .where(
            and(
              eq(bookings.sessionId, sessionId),
              eq(bookings.studioId, adminStudioId),
              eq(bookings.status, 'confirmed'),
            ),
          );

        await tx
          .update(classSessions)
          .set({
            status: 'cancelled',
            cancellationReason: reason,
            cancelledAt: new Date(),
            cancelledBy: cancelledByUserId,
            updatedAt: new Date(),
          })
          .where(eq(classSessions.id, sessionId));

        const affectedUserIds: string[] = [];
        let totalCreditsRefunded = 0;
        const cancelledBookingIds: string[] = [];

        // Batch welcome-journey side effects once per session instead of N+1 per booking.
        const welcomePurchaseByUserId = new Map<string, string>();
        if (isWelcomeJourney && confirmedBookings.length > 0) {
          const bookingUserIds = [...new Set(confirmedBookings.map((b) => b.userId))];

          await tx
            .update(welcomeJourneyRequests)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(
              and(
                inArray(welcomeJourneyRequests.userId, bookingUserIds),
                eq(welcomeJourneyRequests.status, 'booked'),
              ),
            );

          const welcomePurchases = await tx
            .select({ id: creditPurchases.id, userId: creditPurchases.userId })
            .from(creditPurchases)
            .innerJoin(creditPackages, eq(creditPurchases.packageId, creditPackages.id))
            .where(
              and(
                inArray(creditPurchases.userId, bookingUserIds),
                eq(creditPackages.name, 'Welcome Journey'),
                ne(creditPurchases.paymentStatus, 'cancelled'),
              ),
            );

          for (const purchase of welcomePurchases) {
            if (!welcomePurchaseByUserId.has(purchase.userId)) {
              welcomePurchaseByUserId.set(purchase.userId, purchase.id);
            }
          }
        }

        for (const booking of confirmedBookings) {
          await tx
            .update(bookings)
            .set({
              status: 'cancelled',
              cancellationType: 'instructor_cancelled',
              cancelledAt: new Date(),
              cancellationReason: `Class cancelled by instructor: ${reason}`,
              updatedAt: new Date(),
            })
            .where(eq(bookings.id, booking.id));

          const welcomePurchaseId = isWelcomeJourney
            ? welcomePurchaseByUserId.get(booking.userId)
            : undefined;

          const refundResult = await releaseBookingAccess(
            tx,
            booking,
            `Refund: Class cancelled by instructor — "${reason}"`,
            welcomePurchaseId,
          );

          affectedUserIds.push(booking.userId);
          totalCreditsRefunded += refundResult.creditsRefunded;
          cancelledBookingIds.push(booking.id);
        }

        // Cancel any duo invites tied to bookings in this session
        if (cancelledBookingIds.length > 0) {
          await tx
            .update(duoInvites)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(
              and(
                eq(duoInvites.status, 'accepted'),
                or(
                  inArray(duoInvites.organizerBookingId, cancelledBookingIds),
                  inArray(duoInvites.partnerBookingId, cancelledBookingIds),
                ),
              ),
            );
        }

        // Always cancel all waitlist entries for the session
        await tx
          .update(waitlistEntries)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(waitlistEntries.sessionId, sessionId));

        return {
          totalBookingsCancelled: confirmedBookings.length,
          totalCreditsRefunded,
          affectedUserIds,
        };
      });

      logger.info({
        sessionId,
        cancelledByUserId,
        totalBookingsCancelled: result.totalBookingsCancelled,
        totalCreditsRefunded: result.totalCreditsRefunded,
      }, 'Session cancelled by instructor');

      // Fire-and-forget emails to all affected students
      Promise.resolve().then(async () => {
        try {
          if (result.affectedUserIds.length === 0) return;
          const [sessionRow, affectedUsers] = await Promise.all([
            db.select({
              startsAt: classSessions.startsAt,
              endsAt: classSessions.endsAt,
              title: classTemplates.name,
              location: classTemplates.location,
            })
              .from(classSessions)
              .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
              .where(eq(classSessions.id, sessionId))
              .limit(1)
              .then((rows) => rows[0]),
            db.select({ id: users.id, email: users.email, name: users.name })
              .from(users)
              .where(and(inArray(users.id, result.affectedUserIds), isNull(users.deletedAt))),
          ]);
          if (!sessionRow) return;
          const classDate = sessionRow.startsAt.toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: STUDIO_TIMEZONE,
          });
          const classTime = sessionRow.startsAt.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', timeZone: STUDIO_TIMEZONE,
          });
          await Promise.allSettled(
            affectedUsers
              .filter((u) => u.email)
              .map((u) =>
                sendClassCancelledByAdminEmail(
                  u.email!,
                  u.name ?? 'there',
                  sessionRow.title,
                  classDate,
                  classTime,
                  reason,
                  sessionRow.startsAt,
                  sessionRow.endsAt,
                  sessionId,
                  sessionRow.location ?? undefined,
                ),
              ),
          );
        } catch (err) {
          logger.warn({ err }, 'Class cancellation emails failed');
        }
      }).catch(() => {});

      revalidatePath('/book');
      revalidatePath('/admin/classes');

      // Fire-and-forget Google Calendar — delete the event since the class is cancelled.
      (async () => {
        try {
          const { deleteEvent } = await import(
            '@/modules/calendar/services/calendar-sync.service'
          );
          await deleteEvent(sessionId, adminStudioId);
        } catch (err) {
          logger.warn({ err }, 'Session cancellation GCal delete failed');
        }
      })();

      return {
        success: true,
        data: {
          sessionId,
          totalBookingsCancelled: result.totalBookingsCancelled,
          totalCreditsRefunded: result.totalCreditsRefunded,
          affectedUserIds: result.affectedUserIds,
        },
      };
    } catch (err) {
      if (err instanceof SessionCancellationError) {
        return { success: false, error: err.message, code: err.code };
      }
      logger.error({ err, sessionId }, 'Session cancellation transaction failed');
      return { success: false, error: 'Failed to cancel session.', code: 'DB_ERROR' };
    }
  },

  /**
   * Read-only check: would a cancellation be penalty-free right now?
   * Use this to drive UI state (e.g. show "free cancellation" badge,
   * mercy-uses-left counter, "last mercy" warning).
   */
  async checkCancellationPolicy(bookingId: string): Promise<{
    isWithinWindow: boolean;
    hoursRemaining: number;
    mercyUsesLeft: number;
    mercyUsesLimit: number;
    isLastMercy: boolean;
    wouldReceiveRefund: boolean;
  }> {
    const session = await auth();
    const studioId = session?.user?.studioId;

    const [row] = await db
      .select({ booking: bookings, session: classSessions })
      .from(bookings)
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .where(and(eq(bookings.id, bookingId), eq(bookings.studioId, studioId ?? '')))
      .limit(1);

    if (!row) throw new Error('Booking not found');
    if (studioId && row.booking.studioId !== studioId) {
      throw new Error('Booking not found');
    }

    const now = new Date();
    const hoursRemaining = Math.floor((row.session.startsAt.getTime() - now.getTime()) / (60 * 60 * 1000));
    const isWithinWindow = isWithinCancellationWindow(row.session.startsAt, now);
    const usedThisMonth = await countMercyUsesThisMonth(db, row.booking.userId);
    const mercyUsesLeft = Math.max(0, MERCY_USES_PER_MONTH - usedThisMonth);
    const isLastMercy = isWithinWindow && mercyUsesLeft === 1;

    return {
      isWithinWindow,
      hoursRemaining,
      mercyUsesLeft,
      mercyUsesLimit: MERCY_USES_PER_MONTH,
      isLastMercy,
      wouldReceiveRefund: !isWithinWindow || mercyUsesLeft > 0,
    };
  },

  /**
   * Read-only: current mercy quota status for a user (regardless of any
   * specific booking). Used by the dashboard and policy banner pre-fetch.
   */
  async getMercyContext(userId: string): Promise<{
    mercyUsesLeft: number;
    mercyUsesLimit: number;
    usedThisMonth: number;
  }> {
    const usedThisMonth = await countMercyUsesThisMonth(db, userId);
    return {
      mercyUsesLeft: Math.max(0, MERCY_USES_PER_MONTH - usedThisMonth),
      mercyUsesLimit: MERCY_USES_PER_MONTH,
      usedThisMonth,
    };
  },
};
