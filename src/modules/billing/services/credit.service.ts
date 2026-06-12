/**
 * Simplified Credit Service
 *
 * Single-ledger architecture: creditTransactions is the ONLY source of truth.
 * Balance is computed dynamically via SUM(amount).
 *
 * Core principle: every credit movement is one immutable row in credit_transactions.
 * No derived caches, no FIFO lots, no separate adjustment table.
 *
 * Multi-tenancy: every function requires studioId. Tenant isolation is enforced
 * at the query level — no cross-studio data leakage possible.
 *
 * Expiry semantics:
 * - credit_transactions.expires_at is optional; NULL means the credits never expire.
 * - Positive credit rows (purchase, adjustment, membership_grant) may carry an expiry.
 * - Balance queries always filter out rows where expires_at <= NOW().
 * - Debit/refund/adjustment deduction checks run against the non-expired balance.
 * - The ledger is immutable: expiry is implemented by exclusion, not deletion.
 */

import { db } from '@/db';
import { creditTransactions } from '@/db/schema';
import type { CreditTransaction, CreditType } from '@/db/schema';
import { eq, and, desc, sql, or, isNull, isNotNull, gt } from 'drizzle-orm';

// ─── Shared Result Types ──────────────────────────────────────────────────────

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: ServiceErrorCode };

export type ServiceErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'INSUFFICIENT_CREDITS'
  | 'INVALID_STATE'
  | 'DUPLICATE_PAYMENT'
  | 'DB_ERROR'
  | 'RATE_LIMITED'
  | 'OVERDUE_BILLS'
  | 'WELCOME_REQUIRED'
  | 'WAIVER_REQUIRED'
  | 'CLASS_FULL'
  | 'BOOKING_ALREADY_EXISTS'
  | 'ALREADY_CANCELLED'
  | 'OUTSIDE_CANCELLATION_WINDOW'
  | 'WAITLIST_FULL'
  | 'ALREADY_ON_WAITLIST'
  | 'OFFER_EXPIRED';

// ─── Param Types ──────────────────────────────────────────────────────────────

export type CreditDebitParams = {
  studioId: string;
  userId: string;
  creditType: CreditType;
  amount: number;
  bookingId?: string;
  description?: string;
};

export type CreditRefundParams = {
  studioId: string;
  userId: string;
  creditType: CreditType;
  amount: number;
  bookingId: string;
  description: string;
};

export type CreditAddParams = {
  studioId: string;
  userId: string;
  creditType: CreditType;
  amount: number;
  purchaseId?: string;
  expiresAt?: Date;
  description?: string;
};

export type CreditAdjustmentParams = {
  studioId: string;
  userId: string;
  creditType: CreditType;
  amount: number; // positive = add, negative = deduct
  adminId?: string;
  expiresAt?: Date;
  description: string;
};

export type CreditMembershipGrantParams = {
  studioId: string;
  userId: string;
  creditType: CreditType;
  amount: number;
  membershipId: string;
  expiresAt?: Date;
  description: string;
};

export type PaginatedTransactionHistory = {
  data: CreditTransaction[];
  nextCursor: Date | null;
};

export type BalanceWithExpiry = {
  balance: number;
  expiresAt: Date | null;
};

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ─── Advisory Locking ─────────────────────────────────────────────────────────

/**
 * Acquire a transaction-scoped advisory lock keyed by (studioId, userId, creditType).
 *
 * This serializes all credit mutations for a specific user/credit-type pair,
 * preventing concurrent debits from double-spending the same balance. The lock
 * is automatically released at transaction commit/rollback.
 */
async function acquireCreditLock(
  tx: TxClient,
  studioId: string,
  userId: string,
  creditType: CreditType,
): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${'credits:' + studioId + ':' + userId + ':' + creditType}, 0))`,
  );
}


// ─── Custom Errors ────────────────────────────────────────────────────────────

export class InsufficientCreditsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientCreditsError';
  }
}

// ─── Balance Queries ──────────────────────────────────────────────────────────

/**
 * Build the WHERE clause that excludes expired ledger rows.
 * All balance reads must use this predicate to ensure expired credits are not
 * counted towards spendable balance.
 */
function nonExpiredBalanceConditions(
  studioId: string,
  userId: string,
  creditType: CreditType,
) {
  const now = new Date();
  return and(
    eq(creditTransactions.studioId, studioId),
    eq(creditTransactions.userId, userId),
    eq(creditTransactions.creditType, creditType),
    or(isNull(creditTransactions.expiresAt), gt(creditTransactions.expiresAt, now)),
  );
}

/**
 * Get the current balance for a user and credit type.
 * Computes SUM(amount) from the immutable ledger, scoped to studio, excluding
 * any rows that have already expired.
 */
export async function getBalance(
  studioId: string,
  userId: string,
  creditType: CreditType,
  tx?: TxClient,
): Promise<number> {
  const client = tx ?? db;
  const [row] = await client
    .select({ total: sql<number>`COALESCE(SUM(${creditTransactions.amount}), 0)::int` })
    .from(creditTransactions)
    .where(nonExpiredBalanceConditions(studioId, userId, creditType));
  return row?.total ?? 0;
}

/**
 * Get the current balance plus the nearest future expiry date for a user and
 * credit type. The expiry returned is the earliest expires_at among non-expired
 * credit-add rows for this type. Returns null when no such expiry exists.
 */
export async function getBalanceWithExpiry(
  studioId: string,
  userId: string,
  creditType: CreditType,
  tx?: TxClient,
): Promise<BalanceWithExpiry> {
  const client = tx ?? db;
  const now = new Date();

  const [balanceRow] = await client
    .select({ total: sql<number>`COALESCE(SUM(${creditTransactions.amount}), 0)::int` })
    .from(creditTransactions)
    .where(nonExpiredBalanceConditions(studioId, userId, creditType));

  const [expiryRow] = await client
    .select({ nearest: sql<Date | null>`MIN(${creditTransactions.expiresAt})` })
    .from(creditTransactions)
    .where(and(
      eq(creditTransactions.studioId, studioId),
      eq(creditTransactions.userId, userId),
      eq(creditTransactions.creditType, creditType),
      gt(creditTransactions.amount, 0),
      isNotNull(creditTransactions.expiresAt),
      gt(creditTransactions.expiresAt, now),
    ));

  return {
    balance: balanceRow?.total ?? 0,
    expiresAt: expiryRow?.nearest ?? null,
  };
}

/**
 * Get all balances for a user across all credit types.
 * Scoped to studio. Excludes expired rows.
 */
export async function getAllBalances(
  studioId: string,
  userId: string,
): Promise<Record<CreditType, number>> {
  const now = new Date();
  const rows = await db
    .select({
      creditType: creditTransactions.creditType,
      total: sql<number>`COALESCE(SUM(${creditTransactions.amount}), 0)::int`,
    })
    .from(creditTransactions)
    .where(and(
      eq(creditTransactions.studioId, studioId),
      eq(creditTransactions.userId, userId),
      or(isNull(creditTransactions.expiresAt), gt(creditTransactions.expiresAt, now)),
    ))
    .groupBy(creditTransactions.creditType);

  const balances = { pass: 0, mat_pass: 0, reformer_pass: 0, session: 0 } as Record<CreditType, number>;
  for (const row of rows) {
    balances[row.creditType] = row.total;
  }
  return balances;
}

/**
 * Check if a user has sufficient credits for a given type and amount.
 * Scoped to studio.
 */
export async function hasSufficientCredits(
  studioId: string,
  userId: string,
  creditType: CreditType,
  amount: number,
): Promise<boolean> {
  const balance = await getBalance(studioId, userId, creditType);
  return balance >= amount;
}

// ─── Debit ────────────────────────────────────────────────────────────────────

/**
 * Debit credits from a user's balance.
 * Throws InsufficientCreditsError if the balance is too low.
 */
export async function debit(
  tx: TxClient,
  params: CreditDebitParams,
): Promise<CreditTransaction> {
  await acquireCreditLock(tx, params.studioId, params.userId, params.creditType);

  // Verify balance under lock, excluding expired credits
  const [row] = await tx
    .select({ total: sql<number>`COALESCE(SUM(${creditTransactions.amount}), 0)::int` })
    .from(creditTransactions)
    .where(nonExpiredBalanceConditions(params.studioId, params.userId, params.creditType));

  const balance = row?.total ?? 0;
  if (balance < params.amount) {
    throw new InsufficientCreditsError(
      `Insufficient credits: need ${params.amount}, have ${balance}`,
    );
  }

  const [transaction] = await tx
    .insert(creditTransactions)
    .values({
      studioId: params.studioId,
      userId: params.userId,
      creditType: params.creditType,
      type: 'debit',
      amount: -params.amount,
      description: params.description ?? `Debit: ${params.amount} ${params.creditType}`,
      bookingId: params.bookingId,
    })
    .returning();

  return transaction;
}

// ─── Refund ───────────────────────────────────────────────────────────────────

/**
 * Refund credits to a user's balance.
 */
export async function refund(
  tx: TxClient,
  params: CreditRefundParams,
): Promise<CreditTransaction> {
  await acquireCreditLock(tx, params.studioId, params.userId, params.creditType);

  const [transaction] = await tx
    .insert(creditTransactions)
    .values({
      studioId: params.studioId,
      userId: params.userId,
      creditType: params.creditType,
      type: 'refund',
      amount: params.amount,
      description: params.description,
      bookingId: params.bookingId,
    })
    .returning();

  return transaction;
}

// ─── Add Purchase Credits ─────────────────────────────────────────────────────

/**
 * Add credits from a purchase.
 * Idempotent: checks for existing transaction with the same purchaseId.
 */
export async function addPurchase(
  tx: TxClient,
  params: CreditAddParams,
): Promise<CreditTransaction> {
  await acquireCreditLock(tx, params.studioId, params.userId, params.creditType);

  // Idempotency guard
  if (params.purchaseId) {
    const [existing] = await tx
      .select({ id: creditTransactions.id })
      .from(creditTransactions)
      .where(and(
        eq(creditTransactions.studioId, params.studioId),
        eq(creditTransactions.purchaseId, params.purchaseId),
        eq(creditTransactions.type, 'purchase'),
      ))
      .limit(1);
    if (existing) {
      throw new Error('Duplicate credit purchase');
    }
  }

  const [transaction] = await tx
    .insert(creditTransactions)
    .values({
      studioId: params.studioId,
      userId: params.userId,
      creditType: params.creditType,
      type: 'purchase',
      amount: params.amount,
      description: params.description ?? `Purchase: ${params.amount} ${params.creditType}`,
      purchaseId: params.purchaseId,
      expiresAt: params.expiresAt ?? null,
    })
    .returning();

  return transaction;
}

// ─── Admin Adjustment ─────────────────────────────────────────────────────────

/**
 * Add or deduct credits via admin adjustment.
 * Positive amount = add credits. Negative amount = deduct credits.
 */
export async function addAdjustment(
  tx: TxClient,
  params: CreditAdjustmentParams,
): Promise<CreditTransaction> {
  await acquireCreditLock(tx, params.studioId, params.userId, params.creditType);

  if (params.amount < 0) {
    // Verify balance before deduction, excluding expired credits
    const [row] = await tx
      .select({ total: sql<number>`COALESCE(SUM(${creditTransactions.amount}), 0)::int` })
      .from(creditTransactions)
      .where(nonExpiredBalanceConditions(params.studioId, params.userId, params.creditType));
    const balance = row?.total ?? 0;
    if (balance < Math.abs(params.amount)) {
      throw new InsufficientCreditsError(
        `Cannot deduct ${Math.abs(params.amount)}: user only has ${balance}`,
      );
    }
  }

  const [transaction] = await tx
    .insert(creditTransactions)
    .values({
      studioId: params.studioId,
      userId: params.userId,
      creditType: params.creditType,
      type: 'adjustment',
      amount: params.amount,
      description: params.description,
      processedBy: params.adminId,
      expiresAt: params.expiresAt ?? null,
    })
    .returning();

  return transaction;
}

// ─── Membership Grant ─────────────────────────────────────────────────────────

/**
 * Add credits from a membership weekly grant.
 */
export async function addMembershipGrant(
  tx: TxClient,
  params: CreditMembershipGrantParams,
): Promise<CreditTransaction> {
  await acquireCreditLock(tx, params.studioId, params.userId, params.creditType);

  const [transaction] = await tx
    .insert(creditTransactions)
    .values({
      studioId: params.studioId,
      userId: params.userId,
      creditType: params.creditType,
      type: 'membership_grant',
      amount: params.amount,
      description: params.description,
      membershipId: params.membershipId,
      expiresAt: params.expiresAt ?? null,
    })
    .returning();

  return transaction;
}

// ─── Transaction History ──────────────────────────────────────────────────────

/**
 * Get paginated transaction history for a user.
 * Scoped to studio.
 */
export async function getTransactionHistory(
  studioId: string,
  userId: string,
  options: { limit?: number; cursor?: Date; creditType?: CreditType } = {},
): Promise<PaginatedTransactionHistory> {
  const limit = options.limit ?? 20;

  const conditions = [
    eq(creditTransactions.studioId, studioId),
    eq(creditTransactions.userId, userId),
  ];
  if (options.creditType) {
    conditions.push(eq(creditTransactions.creditType, options.creditType));
  }
  if (options.cursor) {
    conditions.push(sql`${creditTransactions.createdAt} < ${options.cursor}`);
  }

  const data = await db
    .select()
    .from(creditTransactions)
    .where(and(...conditions))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit + 1);

  const hasMore = data.length > limit;
  const rows = hasMore ? data.slice(0, limit) : data;
  const nextCursor = hasMore ? rows[rows.length - 1]?.createdAt ?? null : null;

  return { data: rows as CreditTransaction[], nextCursor };
}

// ─── Public Service Object ────────────────────────────────────────────────────

export const creditService = {
  getBalance,
  getBalanceWithExpiry,
  getAllBalances,
  hasSufficientCredits,
  debit,
  refund,
  addPurchase,
  addAdjustment,
  addMembershipGrant,
  getTransactionHistory,
};
