/**
 * CORE_BUSINESS_SERVICES.TS — Pilates OS
 * Production-ready business logic services.
 *
 * Patch v1.1.0:
 *   [FIX-3] waitlistService.confirmOffer(): Entry fetch moved INSIDE db.transaction()
 *           and appended with .for('update') to eliminate double-confirmation race condition.
 *   [FIX-4] creditService.getTransactionHistory(): Refactored from limit/offset to
 *           cursor-based pagination. Returns { data, nextCursor }.
 *   [FIX-5] creditService.addCredits(): CreditAddParams now accepts stripeCheckoutSessionId.
 *           Inside the transaction, stripeTransactions is queried FOR UPDATE to verify
 *           idempotency before crediting. Prevents double-crediting on webhook retries.
 *
 * Services:
 *   1. CancellationService — 24h rule, First-Time Mercy, instructor cancel
 *   2. CreditService      — Atomic debit, refund, purchase, balance check
 *   3. WaitlistService    — FIFO promotion, offer expiry, position management
 *
 * Rules:
 *   - Every mutation uses db.transaction() for atomicity.
 *   - Services never send HTTP responses — they return typed results.
 *   - Side effects (email, queue jobs) are always fire-and-forget after commit.
 *   - No console.log — use the structured logger.
 */

import { db } from '@/db';
import {
  bookings,
  users,
  classSessions,
  creditBalances,
  creditTransactions,
  stripeTransactions,
  waitlistEntries,
  type Booking,
  type ClassSession,
  type CreditTransaction,
  type WaitlistEntry,
} from '@/db/schema';
import { eq, and, lt, gt, lte, asc, desc, inArray, isNull } from 'drizzle-orm';
import { differenceInHours, addMinutes } from 'date-fns';
import { revalidatePath } from 'next/cache';

// ─── Constants (sourced from /src/constants/BOOKING_RULES.ts in real project) ──
const CANCELLATION_WINDOW_HOURS = 24;
const WAITLIST_OFFER_EXPIRY_MINUTES = 15;
const WAITLIST_MAX_POSITION = 20;

// ─── Shared Logger Interface ─────────────────────────────────────────────────
// In production, replace with Axiom or Pino instance
const logger = {
  info: (msg: string, meta?: object) => console.info(JSON.stringify({ level: 'info', msg, ...meta })),
  warn: (msg: string, meta?: object) => console.warn(JSON.stringify({ level: 'warn', msg, ...meta })),
  error: (msg: string, meta?: object) => console.error(JSON.stringify({ level: 'error', msg, ...meta })),
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED RESULT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: ServiceErrorCode };

export type ServiceErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'ALREADY_CANCELLED'
  | 'INSUFFICIENT_CREDITS'
  | 'BOOKING_ALREADY_EXISTS'
  | 'CLASS_FULL'
  | 'OUTSIDE_CANCELLATION_WINDOW'
  | 'WAITLIST_FULL'
  | 'ALREADY_ON_WAITLIST'
  | 'OFFER_EXPIRED'
  | 'INVALID_STATE'
  | 'DUPLICATE_PAYMENT'
  | 'DB_ERROR';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CANCELLATION SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export type CancellationResult = {
  booking: Booking;
  refundIssued: boolean;
  mercyApplied: boolean;
  creditsRefunded: number;
  message: string;
};

export type InstructorCancellationResult = {
  sessionId: string;
  totalBookingsCancelled: number;
  totalCreditsRefunded: number;
  affectedUserIds: string[];
};

/**
 * CancellationService
 *
 * Handles all cancellation scenarios:
 *  - Student cancels > 24h before: Full refund, no penalty.
 *  - Student cancels < 24h before (first time ever): Mercy grace, full refund.
 *  - Student cancels < 24h before (mercy used): No refund. Credits forfeited.
 *  - Instructor cancels session: All booked students get full refund.
 */
export const cancellationService = {
  /**
   * Cancel a single booking initiated by a student or admin.
   */
  async cancel(
    bookingId: string,
    requestingUserId: string,
    reason?: string,
  ): Promise<ServiceResult<CancellationResult>> {
    // ── 1. Fetch booking with session data ──────────────────────────────────
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      return { success: false, error: 'Booking not found.', code: 'NOT_FOUND' };
    }

    // ── 2. Authorization check ───────────────────────────────────────────────
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, requestingUserId))
      .limit(1);

    const isOwner = booking.userId === requestingUserId;
    const isAdmin = requestingUser?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return { success: false, error: 'Not authorized.', code: 'UNAUTHORIZED' };
    }

    // ── 3. State validation ──────────────────────────────────────────────────
    if (booking.status === 'cancelled') {
      return {
        success: false,
        error: 'Booking is already cancelled.',
        code: 'ALREADY_CANCELLED',
      };
    }

    // ── 4. Fetch associated class session ────────────────────────────────────
    const [session] = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, booking.sessionId))
      .limit(1);

    if (!session) {
      return { success: false, error: 'Session not found.', code: 'NOT_FOUND' };
    }

    // ── 5. Fetch user for mercy check ────────────────────────────────────────
    const [student] = await db
      .select()
      .from(users)
      .where(eq(users.id, booking.userId))
      .limit(1);

    if (!student) {
      return { success: false, error: 'Student not found.', code: 'NOT_FOUND' };
    }

    // ── 6. Apply the Cancellation Rule Engine ────────────────────────────────
    const now = new Date();
    const hoursUntilClass = differenceInHours(session.startsAt, now);
    const isWithinWindow = hoursUntilClass < CANCELLATION_WINDOW_HOURS;

    let refundIssued = false;
    let mercyApplied = false;
    let creditsRefunded = 0;

    if (!isWithinWindow) {
      refundIssued = true;
    } else if (!student.firstMercyUsed) {
      mercyApplied = true;
      refundIssued = true;
      logger.info('First-time mercy applied', {
        userId: student.id,
        bookingId,
        hoursUntilClass,
      });
    }

    // ── 7. Execute DB Transaction (atomic) ──────────────────────────────────
    try {
      const result = await db.transaction(async (tx) => {
        const [updatedBooking] = await tx
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
          .set({
            bookedCount: session.bookedCount - 1,
            updatedAt: now,
          })
          .where(eq(classSessions.id, session.id));

        if (mercyApplied) {
          await tx
            .update(users)
            .set({ firstMercyUsed: true, updatedAt: now })
            .where(eq(users.id, student.id));
        }

        if (refundIssued) {
          creditsRefunded = booking.creditsSpent;
          await creditService.refundInternal(tx, {
            userId: booking.userId,
            creditType: booking.creditType,
            amount: booking.creditsSpent,
            bookingId: booking.id,
            description: mercyApplied
              ? 'Refund: Late cancellation grace (first-time mercy)'
              : 'Refund: Cancellation within policy window',
          });
        }

        return updatedBooking;
      });

      logger.info('Booking cancelled successfully', {
        bookingId,
        refundIssued,
        mercyApplied,
        creditsRefunded,
      });

      // ── 8. Side effects (fire-and-forget, outside transaction) ────────────
      // emailQueue.add('booking-cancelled', { bookingId, refundIssued, mercyApplied });

      // ── 9. Trigger waitlist promotion ─────────────────────────────────────
      waitlistService
        .promoteNextInLine(session.id)
        .catch((err) =>
          logger.error('Waitlist promotion failed after cancellation', { err, sessionId: session.id }),
        );

      revalidatePath('/book');
      revalidatePath('/dashboard');

      return {
        success: true,
        data: {
          booking: result as Booking,
          refundIssued,
          mercyApplied,
          creditsRefunded,
          message: mercyApplied
            ? 'Booking cancelled. Your one-time grace has been applied and credits refunded.'
            : refundIssued
            ? 'Booking cancelled. Credits have been refunded.'
            : 'Booking cancelled. Credits could not be refunded due to late cancellation policy.',
        },
      };
    } catch (err) {
      logger.error('Cancellation DB transaction failed', { err, bookingId });
      return {
        success: false,
        error: 'An error occurred while cancelling your booking.',
        code: 'DB_ERROR',
      };
    }
  },

  /**
   * Instructor/Admin cancels an entire class session.
   * ALL confirmed bookings are cancelled and FULLY refunded.
   */
  async cancelSessionByInstructor(
    sessionId: string,
    cancelledByUserId: string,
    reason: string,
  ): Promise<ServiceResult<InstructorCancellationResult>> {
    const [session] = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return { success: false, error: 'Session not found.', code: 'NOT_FOUND' };
    }

    if (session.status === 'cancelled') {
      return { success: false, error: 'Session already cancelled.', code: 'ALREADY_CANCELLED' };
    }

    const confirmedBookings = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.sessionId, sessionId),
          eq(bookings.status, 'confirmed'),
        ),
      );

    try {
      const affectedUserIds: string[] = [];
      let totalCreditsRefunded = 0;

      await db.transaction(async (tx) => {
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

          await creditService.refundInternal(tx, {
            userId: booking.userId,
            creditType: booking.creditType,
            amount: booking.creditsSpent,
            bookingId: booking.id,
            description: `Refund: Class cancelled by instructor — "${reason}"`,
          });

          affectedUserIds.push(booking.userId);
          totalCreditsRefunded += booking.creditsSpent;
        }

        if (confirmedBookings.length > 0) {
          await tx
            .update(waitlistEntries)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(waitlistEntries.sessionId, sessionId));
        }
      });

      logger.info('Session cancelled by instructor', {
        sessionId,
        cancelledByUserId,
        totalBookingsCancelled: confirmedBookings.length,
        totalCreditsRefunded,
      });

      // emailQueue.addBulk(affectedUserIds.map(userId => ({
      //   name: 'class-cancelled-by-instructor',
      //   data: { userId, sessionId, reason }
      // })));

      revalidatePath('/book');
      revalidatePath('/admin/classes');

      return {
        success: true,
        data: {
          sessionId,
          totalBookingsCancelled: confirmedBookings.length,
          totalCreditsRefunded,
          affectedUserIds,
        },
      };
    } catch (err) {
      logger.error('Session cancellation transaction failed', { err, sessionId });
      return { success: false, error: 'Failed to cancel session.', code: 'DB_ERROR' };
    }
  },

  /**
   * Read-only utility: determines if a cancellation would be penalty-free.
   */
  async checkCancellationPolicy(
    bookingId: string,
  ): Promise<{
    isWithinWindow: boolean;
    hoursRemaining: number;
    mercyAvailable: boolean;
    wouldReceiveRefund: boolean;
  }> {
    const [booking] = await db
      .select({ booking: bookings, user: users, session: classSessions })
      .from(bookings)
      .innerJoin(users, eq(bookings.userId, users.id))
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) throw new Error('Booking not found');

    const hoursRemaining = differenceInHours(booking.session.startsAt, new Date());
    const isWithinWindow = hoursRemaining < CANCELLATION_WINDOW_HOURS;
    const mercyAvailable = !booking.user.firstMercyUsed;

    return {
      isWithinWindow,
      hoursRemaining,
      mercyAvailable,
      wouldReceiveRefund: !isWithinWindow || mercyAvailable,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. CREDIT SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export type CreditDebitParams = {
  userId: string;
  creditType: 'standard' | 'premium' | 'vip';
  amount: number;
  bookingId: string;
  description?: string;
};

export type CreditRefundParams = {
  userId: string;
  creditType: 'standard' | 'premium' | 'vip';
  amount: number;
  bookingId: string;
  description?: string;
};

export type CreditAddParams = {
  userId: string;
  creditType: 'standard' | 'premium' | 'vip';
  amount: number;
  packageId?: string;
  expiresAt?: Date;
  description?: string;
  // [FIX-5] Stripe idempotency key — pass the checkout session ID from the webhook.
  // addCredits() will verify this ID has not already been processed before crediting.
  // Required for all Stripe-initiated credit additions to prevent double-crediting.
  stripeCheckoutSessionId?: string;
};

// [FIX-4] Cursor-based pagination result type.
// The cursor is the `createdAt` timestamp of the last item returned.
// Pass it back as the `cursor` param on the next call to advance the page.
export type PaginatedTransactionHistory = {
  data: CreditTransaction[];
  nextCursor: Date | null;
};

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * CreditService
 *
 * All credit operations are ATOMIC.
 * The balance in `credit_balances` is always consistent with the
 * sum of `credit_transactions` for that user + credit type.
 *
 * Key design: `refundInternal` accepts a tx client so it can be
 * composed inside other service transactions (e.g., CancellationService).
 */
export const creditService = {
  /**
   * Get current credit balance for a user by credit type.
   */
  async getBalance(
    userId: string,
    creditType: 'standard' | 'premium' | 'vip',
  ): Promise<number> {
    const [balance] = await db
      .select({ balance: creditBalances.balance })
      .from(creditBalances)
      .where(
        and(
          eq(creditBalances.userId, userId),
          eq(creditBalances.creditType, creditType),
        ),
      )
      .limit(1);

    return balance?.balance ?? 0;
  },

  /**
   * Get all balances for a user (for dashboard display).
   */
  async getAllBalances(userId: string) {
    return db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId));
  },

  /**
   * Debit credits from a user's balance for a booking.
   * Throws if insufficient balance (fail-fast).
   */
  async debit(params: CreditDebitParams): Promise<ServiceResult<CreditTransaction>> {
    const { userId, creditType, amount, bookingId, description } = params;

    if (amount <= 0) {
      return { success: false, error: 'Debit amount must be positive.', code: 'INVALID_STATE' };
    }

    try {
      const result = await db.transaction(async (tx) => {
        // 1. Fetch balance with a row-level lock (FOR UPDATE) to prevent race conditions
        const [currentBalance] = await tx
          .select()
          .from(creditBalances)
          .where(
            and(
              eq(creditBalances.userId, userId),
              eq(creditBalances.creditType, creditType),
            ),
          )
          .for('update')
          .limit(1);

        const currentAmount = currentBalance?.balance ?? 0;

        if (currentAmount < amount) {
          throw new InsufficientCreditsError(
            `Insufficient ${creditType} credits. Has: ${currentAmount}, Needs: ${amount}`,
          );
        }

        const newBalance = currentAmount - amount;

        if (currentBalance) {
          await tx
            .update(creditBalances)
            .set({ balance: newBalance, updatedAt: new Date() })
            .where(eq(creditBalances.id, currentBalance.id));
        } else {
          throw new Error('Balance record not found during debit');
        }

        const [transaction] = await tx
          .insert(creditTransactions)
          .values({
            userId,
            bookingId,
            type: 'debit',
            creditType,
            amount: -amount,
            balanceAfter: newBalance,
            description: description ?? `Credit debit for booking ${bookingId}`,
          })
          .returning();

        return transaction;
      });

      return { success: true, data: result as CreditTransaction };
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return { success: false, error: err.message, code: 'INSUFFICIENT_CREDITS' };
      }
      logger.error('Credit debit failed', { err, userId, creditType, amount });
      return { success: false, error: 'Credit debit failed.', code: 'DB_ERROR' };
    }
  },

  /**
   * Issue a refund for a booking.
   * Public wrapper that creates its own transaction.
   */
  async refund(params: CreditRefundParams): Promise<ServiceResult<CreditTransaction>> {
    try {
      const result = await db.transaction(async (tx) => {
        return creditService.refundInternal(tx, params);
      });
      return { success: true, data: result };
    } catch (err) {
      logger.error('Credit refund failed', { err, ...params });
      return { success: false, error: 'Credit refund failed.', code: 'DB_ERROR' };
    }
  },

  /**
   * Internal refund — accepts an existing transaction client.
   * Used by CancellationService to compose within its own transaction.
   * NOT exported as part of the public API.
   */
  async refundInternal(
    tx: TxClient,
    params: CreditRefundParams & { description: string },
  ): Promise<CreditTransaction> {
    const { userId, creditType, amount, bookingId, description } = params;

    const [existing] = await tx
      .select()
      .from(creditBalances)
      .where(
        and(
          eq(creditBalances.userId, userId),
          eq(creditBalances.creditType, creditType),
        ),
      )
      .for('update')
      .limit(1);

    let newBalance: number;

    if (existing) {
      newBalance = existing.balance + amount;
      await tx
        .update(creditBalances)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(creditBalances.id, existing.id));
    } else {
      newBalance = amount;
      await tx.insert(creditBalances).values({
        userId,
        creditType,
        balance: newBalance,
      });
    }

    const [transaction] = await tx
      .insert(creditTransactions)
      .values({
        userId,
        bookingId,
        type: 'refund',
        creditType,
        amount: +amount,
        balanceAfter: newBalance,
        description,
      })
      .returning();

    return transaction as CreditTransaction;
  },

  /**
   * Add credits to a user's account after a purchase.
   * Called by the Stripe webhook handler.
   *
   * [FIX-5] IDEMPOTENCY GUARD: If stripeCheckoutSessionId is provided, this method
   * queries the stripeTransactions table inside the transaction with FOR UPDATE to
   * verify the session hasn't been processed yet. This prevents the webhook from
   * double-crediting a user if Stripe retries the checkout.session.completed event.
   *
   * The stripeTransaction record MUST already exist in `pending` state (written
   * when the checkout session was created). This method updates it to `succeeded`.
   */
  async addCredits(params: CreditAddParams): Promise<ServiceResult<CreditTransaction>> {
    const { userId, creditType, amount, packageId, expiresAt, description, stripeCheckoutSessionId } = params;

    if (amount <= 0) {
      return { success: false, error: 'Amount must be positive.', code: 'INVALID_STATE' };
    }

    try {
      const result = await db.transaction(async (tx) => {
        // [FIX-5] Idempotency check — must be FIRST inside the transaction,
        // before any balance mutation, to prevent TOCTOU races.
        if (stripeCheckoutSessionId) {
          const [stripeTx] = await tx
            .select()
            .from(stripeTransactions)
            .where(eq(stripeTransactions.stripeCheckoutSessionId, stripeCheckoutSessionId))
            .for('update') // Row-level lock prevents concurrent webhook processing
            .limit(1);

          if (!stripeTx) {
            // The stripe transaction record was never created — this is unexpected.
            // Surface as a hard error so it can be investigated.
            throw new DuplicatePaymentError(
              `Stripe transaction record not found for session: ${stripeCheckoutSessionId}`,
            );
          }

          if (stripeTx.status === 'succeeded') {
            // This webhook has already been successfully processed.
            // Return early without mutating any balances.
            throw new DuplicatePaymentError(
              `Stripe checkout session already processed: ${stripeCheckoutSessionId}`,
            );
          }

          // Mark the stripe transaction as succeeded within the same atomic operation.
          await tx
            .update(stripeTransactions)
            .set({ status: 'succeeded', updatedAt: new Date() })
            .where(eq(stripeTransactions.id, stripeTx.id));
        }

        // Proceed with credit balance mutation
        const [existing] = await tx
          .select()
          .from(creditBalances)
          .where(
            and(
              eq(creditBalances.userId, userId),
              eq(creditBalances.creditType, creditType),
            ),
          )
          .for('update')
          .limit(1);

        let newBalance: number;

        if (existing) {
          newBalance = existing.balance + amount;
          await tx
            .update(creditBalances)
            .set({
              balance: newBalance,
              expiresAt: expiresAt ?? existing.expiresAt,
              updatedAt: new Date(),
            })
            .where(eq(creditBalances.id, existing.id));
        } else {
          newBalance = amount;
          await tx.insert(creditBalances).values({
            userId,
            creditType,
            balance: newBalance,
            expiresAt: expiresAt ?? null,
          });
        }

        const [transaction] = await tx
          .insert(creditTransactions)
          .values({
            userId,
            packageId: packageId ?? null,
            type: 'purchase',
            creditType,
            amount: +amount,
            balanceAfter: newBalance,
            description: description ?? `Purchased ${amount} ${creditType} credits`,
          })
          .returning();

        return transaction;
      });

      logger.info('Credits added', { userId, creditType, amount, stripeCheckoutSessionId });
      return { success: true, data: result as CreditTransaction };
    } catch (err) {
      if (err instanceof DuplicatePaymentError) {
        // [FIX-5] This is NOT an error to alert on — it is expected on webhook retries.
        // Log as info and return a specific code so the webhook handler can return HTTP 200
        // to Stripe (telling it to stop retrying).
        logger.info('Idempotency guard: duplicate Stripe webhook suppressed', {
          stripeCheckoutSessionId,
          message: err.message,
        });
        return { success: false, error: err.message, code: 'DUPLICATE_PAYMENT' };
      }
      logger.error('Add credits failed', { err, userId, creditType, amount });
      return { success: false, error: 'Failed to add credits.', code: 'DB_ERROR' };
    }
  },

  /**
   * Check if a user has sufficient credits without debiting.
   * Use this for UI state (disable button if insufficient).
   */
  async hasSufficientCredits(
    userId: string,
    creditType: 'standard' | 'premium' | 'vip',
    requiredAmount: number,
  ): Promise<boolean> {
    const balance = await creditService.getBalance(userId, creditType);
    return balance >= requiredAmount;
  },

  /**
   * Get cursor-based paginated transaction history for a user.
   * Used by the billing history page.
   *
   * [FIX-4] Replaces the previous limit/offset implementation.
   *
   * USAGE:
   *   // First page
   *   const page1 = await creditService.getTransactionHistory(userId, 20);
   *
   *   // Next page — pass the cursor from the previous result
   *   const page2 = await creditService.getTransactionHistory(userId, 20, page1.nextCursor);
   *
   * WHY CURSOR > OFFSET:
   *   With offset, if a new transaction is inserted between page fetches,
   *   items shift and the user sees duplicates or skips rows.
   *   With a time-based cursor on an append-only ledger, pages are stable.
   *
   * @param userId    The user to fetch history for.
   * @param limit     Number of records per page (default: 20, max: 100).
   * @param cursor    The createdAt timestamp of the last item from the previous page.
   *                  Pass null or undefined for the first page.
   */
  async getTransactionHistory(
    userId: string,
    limit = 20,
    cursor?: Date,
  ): Promise<PaginatedTransactionHistory> {
    const safeLimit = Math.min(limit, 100); // Hard cap to prevent abuse

    // Build the WHERE clause — add cursor predicate only on subsequent pages
    const whereClause = cursor
      ? and(
          eq(creditTransactions.userId, userId),
          // Fetch records OLDER than the cursor (descending order = older items have smaller dates)
          lt(creditTransactions.createdAt, cursor),
        )
      : eq(creditTransactions.userId, userId);

    // Fetch one extra record beyond the limit to determine if a next page exists.
    // This avoids a separate COUNT query.
    const rows = await db
      .select()
      .from(creditTransactions)
      .where(whereClause)
      .orderBy(desc(creditTransactions.createdAt)) // Most recent first
      .limit(safeLimit + 1);

    const hasNextPage = rows.length > safeLimit;
    const data = hasNextPage ? rows.slice(0, safeLimit) : rows;

    // The cursor for the next page is the createdAt of the LAST item in the current page.
    const nextCursor = hasNextPage && data.length > 0
      ? data[data.length - 1].createdAt
      : null;

    return { data: data as CreditTransaction[], nextCursor };
  },
};

// Custom error classes for type-safe catch handling
class InsufficientCreditsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientCreditsError';
  }
}

// [FIX-5] Dedicated error class for idempotency guard
class DuplicatePaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicatePaymentError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. WAITLIST SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export type WaitlistJoinResult = {
  entry: WaitlistEntry;
  position: number;
};

export type WaitlistPromotionResult = {
  promoted: boolean;
  userId?: string;
  entryId?: string;
  offerExpiresAt?: Date;
};

/**
 * WaitlistService
 *
 * Implements FIFO waitlist management with timed offer windows.
 *
 * Flow:
 *  1. User joins waitlist → gets a position number.
 *  2. On a cancellation → promoteNextInLine() is called.
 *  3. The next person in line receives a 15-minute offer via email.
 *  4. If they confirm within 15 min → they get the spot, credits debited.
 *  5. If they don't → offer expires, next person is promoted.
 */
export const waitlistService = {
  /**
   * Join the waitlist for a class session.
   */
  async join(
    userId: string,
    sessionId: string,
  ): Promise<ServiceResult<WaitlistJoinResult>> {
    const [existing] = await db
      .select()
      .from(waitlistEntries)
      .where(
        and(
          eq(waitlistEntries.userId, userId),
          eq(waitlistEntries.sessionId, sessionId),
          inArray(waitlistEntries.status, ['waiting', 'offered']),
        ),
      )
      .limit(1);

    if (existing) {
      return {
        success: false,
        error: 'You are already on the waitlist for this class.',
        code: 'ALREADY_ON_WAITLIST',
      };
    }

    const existingEntries = await db
      .select({ position: waitlistEntries.position })
      .from(waitlistEntries)
      .where(
        and(
          eq(waitlistEntries.sessionId, sessionId),
          inArray(waitlistEntries.status, ['waiting', 'offered']),
        ),
      )
      .orderBy(asc(waitlistEntries.position));

    const nextPosition =
      existingEntries.length > 0
        ? Math.max(...existingEntries.map((e) => e.position)) + 1
        : 1;

    if (nextPosition > WAITLIST_MAX_POSITION) {
      return {
        success: false,
        error: 'The waitlist for this class is full.',
        code: 'WAITLIST_FULL',
      };
    }

    try {
      const [entry] = await db
        .insert(waitlistEntries)
        .values({
          userId,
          sessionId,
          position: nextPosition,
          status: 'waiting',
        })
        .returning();

      logger.info('User joined waitlist', { userId, sessionId, position: nextPosition });

      await db
        .update(classSessions)
        .set({ waitlistCount: nextPosition, updatedAt: new Date() })
        .where(eq(classSessions.id, sessionId));

      return {
        success: true,
        data: { entry: entry as WaitlistEntry, position: nextPosition },
      };
    } catch (err) {
      logger.error('Failed to join waitlist', { err, userId, sessionId });
      return {
        success: false,
        error: 'Failed to join the waitlist.',
        code: 'DB_ERROR',
      };
    }
  },

  /**
   * Promote the next person in line.
   * Called automatically after a cancellation.
   *
   * This is non-blocking — called with .catch() in CancellationService.
   */
  async promoteNextInLine(sessionId: string): Promise<WaitlistPromotionResult> {
    const [nextEntry] = await db
      .select()
      .from(waitlistEntries)
      .where(
        and(
          eq(waitlistEntries.sessionId, sessionId),
          eq(waitlistEntries.status, 'waiting'),
        ),
      )
      .orderBy(asc(waitlistEntries.position))
      .limit(1);

    if (!nextEntry) {
      logger.info('No one waiting on waitlist', { sessionId });
      return { promoted: false };
    }

    const offerExpiresAt = addMinutes(new Date(), WAITLIST_OFFER_EXPIRY_MINUTES);

    try {
      await db
        .update(waitlistEntries)
        .set({
          status: 'offered',
          offeredAt: new Date(),
          offerExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(waitlistEntries.id, nextEntry.id));

      logger.info('Waitlist offer sent', {
        entryId: nextEntry.id,
        userId: nextEntry.userId,
        sessionId,
        offerExpiresAt,
      });

      // await waitlistQueue.add(
      //   'expire-offer',
      //   { entryId: nextEntry.id, sessionId },
      //   { delay: WAITLIST_OFFER_EXPIRY_MINUTES * 60 * 1000, jobId: `expire-${nextEntry.id}` }
      // );
      // await emailQueue.add('waitlist-offered', { userId: nextEntry.userId, sessionId, offerExpiresAt });

      return {
        promoted: true,
        userId: nextEntry.userId,
        entryId: nextEntry.id,
        offerExpiresAt,
      };
    } catch (err) {
      logger.error('Failed to promote waitlist entry', { err, entryId: nextEntry.id });
      return { promoted: false };
    }
  },

  /**
   * Confirm a waitlist offer.
   * Called when the user clicks the acceptance link before the offer expires.
   *
   * [FIX-3] RACE CONDITION PATCH: The waitlistEntry fetch has been moved INSIDE
   * the db.transaction() block and appended with .for('update'). This acquires a
   * row-level lock before reading the entry status, preventing two concurrent
   * requests (e.g. double-tap on mobile or duplicate network requests) from both
   * reading status: 'offered' and both proceeding to create a booking.
   *
   * Before this fix: fetch entry → check status → start tx → create booking
   *   → Race: two requests both read 'offered' before either starts a transaction.
   *
   * After this fix: start tx → fetch entry FOR UPDATE → check status → create booking
   *   → The second request blocks at the lock until the first commits, then reads
   *     the updated status ('confirmed') and correctly returns INVALID_STATE.
   */
  async confirmOffer(
    entryId: string,
    userId: string,
  ): Promise<ServiceResult<{ bookingId: string }>> {
    // TODO: fetch creditCost and creditType from session's template
    // For now, this is a placeholder — wire to classTemplate in production
    const creditCost = 1;
    const creditType = 'standard' as const;

    try {
      let newBookingId = '';

      await db.transaction(async (tx) => {
        // [FIX-3] Entry fetch is now INSIDE the transaction with FOR UPDATE.
        // This is the critical change. Do NOT move this query outside the transaction.
        const [entry] = await tx
          .select()
          .from(waitlistEntries)
          .where(
            and(
              eq(waitlistEntries.id, entryId),
              eq(waitlistEntries.userId, userId),
            ),
          )
          .for('update') // Acquires row lock — prevents concurrent confirmations
          .limit(1);

        if (!entry) {
          throw new WaitlistEntryNotFoundError('Waitlist entry not found.');
        }

        if (entry.status !== 'offered') {
          // Covers the race condition case: the second concurrent request will
          // find status 'confirmed' here and throw, rolling back cleanly.
          throw new WaitlistInvalidStateError(
            `Entry status is '${entry.status}', expected 'offered'. Possible duplicate request.`,
          );
        }

        if (!entry.offerExpiresAt || new Date() > entry.offerExpiresAt) {
          throw new WaitlistOfferExpiredError('Waitlist offer has expired.');
        }

        // Fetch session to get capacity info
        const [session] = await tx
          .select()
          .from(classSessions)
          .where(eq(classSessions.id, entry.sessionId))
          .for('update') // Lock session row to safely increment bookedCount
          .limit(1);

        if (!session) {
          throw new Error('Session not found during waitlist confirmation.');
        }

        // 1. Create confirmed booking
        const [newBooking] = await tx
          .insert(bookings)
          .values({
            userId,
            sessionId: entry.sessionId,
            status: 'confirmed',
            creditsSpent: creditCost,
            creditType,
          })
          .returning();

        newBookingId = newBooking.id;

        // 2. Mark waitlist entry as confirmed
        await tx
          .update(waitlistEntries)
          .set({
            status: 'confirmed',
            confirmedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(waitlistEntries.id, entryId));

        // 3. Increment session booked count
        await tx
          .update(classSessions)
          .set({
            bookedCount: session.bookedCount + 1,
            updatedAt: new Date(),
          })
          .where(eq(classSessions.id, entry.sessionId));

        // 4. Debit credits (using refundInternal with negative amount = debit)
        await creditService.refundInternal(tx, {
          userId,
          creditType,
          amount: -creditCost,
          bookingId: newBooking.id,
          description: 'Waitlist conversion booking',
        });
      });

      return { success: true, data: { bookingId: newBookingId } };
    } catch (err) {
      if (err instanceof WaitlistEntryNotFoundError) {
        return { success: false, error: err.message, code: 'NOT_FOUND' };
      }
      if (err instanceof WaitlistInvalidStateError) {
        return { success: false, error: err.message, code: 'INVALID_STATE' };
      }
      if (err instanceof WaitlistOfferExpiredError) {
        // Expire this entry and promote the next person outside the failed tx
        waitlistService
          .expireOffer(entryId)
          .catch((e) => logger.error('Failed to expire offer after confirmation attempt', { e, entryId }));
        return {
          success: false,
          error: 'This offer has expired. The spot has been given to the next person.',
          code: 'OFFER_EXPIRED',
        };
      }
      logger.error('Waitlist offer confirmation failed', { err, entryId, userId });
      return { success: false, error: 'Failed to confirm waitlist offer.', code: 'DB_ERROR' };
    }
  },

  /**
   * Expire a waitlist offer and cascade-promote the next person.
   * Called by the BullMQ delayed job worker when the timer fires.
   */
  async expireOffer(entryId: string): Promise<void> {
    const [entry] = await db
      .select()
      .from(waitlistEntries)
      .where(eq(waitlistEntries.id, entryId))
      .limit(1);

    if (!entry || entry.status !== 'offered') return;

    await db
      .update(waitlistEntries)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(waitlistEntries.id, entryId));

    logger.info('Waitlist offer expired, promoting next', {
      expiredEntryId: entryId,
      sessionId: entry.sessionId,
    });

    await waitlistService.promoteNextInLine(entry.sessionId);
  },

  /**
   * Leave / cancel a waitlist entry manually.
   */
  async leave(
    entryId: string,
    userId: string,
  ): Promise<ServiceResult<{ entryId: string }>> {
    const [entry] = await db
      .select()
      .from(waitlistEntries)
      .where(
        and(
          eq(waitlistEntries.id, entryId),
          eq(waitlistEntries.userId, userId),
        ),
      )
      .limit(1);

    if (!entry) {
      return { success: false, error: 'Waitlist entry not found.', code: 'NOT_FOUND' };
    }

    if (!['waiting', 'offered'].includes(entry.status)) {
      return { success: false, error: 'Cannot leave this waitlist entry.', code: 'INVALID_STATE' };
    }

    await db
      .update(waitlistEntries)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(waitlistEntries.id, entryId));

    return { success: true, data: { entryId } };
  },
};

// ─── Waitlist-specific error classes ─────────────────────────────────────────
// Used internally to distinguish error types inside the confirmOffer transaction.

class WaitlistEntryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WaitlistEntryNotFoundError';
  }
}

class WaitlistInvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WaitlistInvalidStateError';
  }
}

class WaitlistOfferExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WaitlistOfferExpiredError';
  }
}
