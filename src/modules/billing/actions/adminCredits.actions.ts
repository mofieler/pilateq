'use server';

import { z } from 'zod';
import { db } from '@/db';
import { creditTransactions, users } from '@/db/schema';
import type { CreditType } from '@/db/schema';
import { eq, and, isNull, desc, lt, sql, or, gt } from 'drizzle-orm';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

import { auth } from '@/lib/auth/auth';
import { handleApiError } from '@/lib/security/error-sanitizer';
import { auditHelpers } from '@/lib/security/audit-system';
import { creditService } from '@/modules/billing/services/credit.service';
import { requireStudioId } from '@/lib/studio/studio-context';
import { verifyUserStudio } from '@/lib/security/tenant-guard';
import { getLogger } from '@/lib/logger';
import { sendCreditAssignmentEmail } from '@/lib/email/billing.emails';

const adjustSchema = z.object({
  userId: z.string().uuid(),
  creditType: z.enum(['pass', 'mat_pass', 'reformer_pass', 'session']),
  amountDelta: z.number().int().refine((n) => n !== 0, 'Amount must not be zero'),
  reason: z.string().min(3).max(500),
});

// ─── Admin Credit Overview ───────────────────────────────────────────────────

export async function getAdminUserCreditOverviewAction(
  limit = APP_CONFIG.DEFAULT_PAGE_SIZE,
  offset = 0,
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false as const, error: 'Unauthorized' };
  }

  try {
    const studioId = await requireStudioId();
    const cappedLimit = Math.min(Math.max(limit, 1), APP_CONFIG.MAX_PAGE_SIZE);

    const activeUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(and(eq(users.studioId, studioId), isNull(users.deletedAt), eq(users.role, 'student')))
      .orderBy(users.name)
      .limit(cappedLimit)
      .offset(Math.max(offset, 0));

    const userIds = activeUsers.map((u) => u.id);
    if (userIds.length === 0) {
      return { success: true as const, data: activeUsers.map((u) => ({ ...u, balances: [] })) };
    }

    // Compute balances from the single ledger, excluding expired credits.
    const now = new Date();
    const balanceRows = await db
      .select({
        userId: creditTransactions.userId,
        creditType: creditTransactions.creditType,
        total: sql<number>`COALESCE(SUM(${creditTransactions.amount}), 0)::int`,
      })
      .from(creditTransactions)
      .where(and(
        sql`${creditTransactions.userId} = ANY(${userIds})`,
        or(isNull(creditTransactions.expiresAt), gt(creditTransactions.expiresAt, now)),
      ))
      .groupBy(creditTransactions.userId, creditTransactions.creditType);

    const balancesByUser: Record<string, Array<{ id: string; creditType: string; balance: number; expiresAt: null; updatedAt: Date }>> = {};
    for (const row of balanceRows) {
      if (!balancesByUser[row.userId]) balancesByUser[row.userId] = [];
      balancesByUser[row.userId].push({
        id: `${row.userId}-${row.creditType}`,
        creditType: row.creditType,
        balance: row.total,
        expiresAt: null,
        updatedAt: new Date(),
      });
    }

    const result = activeUsers.map((u) => ({
      ...u,
      balances: balancesByUser[u.id] ?? [],
    }));

    return { success: true as const, data: result };
  } catch (error) {
    const e = handleApiError(error, 'admin-credit-overview');
    return { success: false as const, error: e.error };
  }
}

// ─── User Transaction History ─────────────────────────────────────────────────

export async function getUserCreditTransactionsAction(userId: string, cursor?: Date) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false as const, error: 'Unauthorized' };
  }

  const userIdParsed = z.string().uuid().safeParse(userId);
  if (!userIdParsed.success) {
    return { success: false as const, error: 'Invalid user ID', code: 'VALIDATION_ERROR' };
  }

  try {
    const studioId = await requireStudioId();
    const userBelongs = await verifyUserStudio(userId, studioId);
    if (!userBelongs) {
      return { success: false as const, error: 'User not found', code: 'NOT_FOUND' };
    }

    const { data, nextCursor } = await creditService.getTransactionHistory(studioId, userId, {
      limit: 20,
      cursor,
    });

    return { success: true as const, data, nextCursor };
  } catch (error) {
    const e = handleApiError(error, 'user-transactions');
    return { success: false as const, error: e.error };
  }
}

// ─── Manual Credit Adjustment ─────────────────────────────────────────────────

export async function adjustUserCreditsAction(input: z.infer<typeof adjustSchema>) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false as const, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: 'Invalid input', code: 'VALIDATION_ERROR' };
  }

  const { userId, creditType, amountDelta, reason } = parsed.data;

  try {
    const studioId = await requireStudioId();
    const userBelongs = await verifyUserStudio(userId, studioId);
    if (!userBelongs) {
      return { success: false as const, error: 'User not found', code: 'NOT_FOUND' };
    }

    const result = await db.transaction(async (tx) => {
      const transaction = await creditService.addAdjustment(tx, {
        studioId,
        userId,
        creditType: creditType as CreditType,
        amount: amountDelta,
        adminId: session.user.id,
        description: `Admin adjustment: ${reason}`,
      });

      const newBalance = await creditService.getBalance(studioId, userId, creditType as CreditType);

      return { newBalance, transactionId: transaction.id };
    });

    await auditHelpers.logAdminAction(
      session.user.id,
      'manual_credit_adjustment',
      'credit_balance',
      userId,
      { creditType, amountDelta, reason, newBalance: result.newBalance },
    );

    // Notify user via email (fire-and-forget)
    Promise.resolve().then(async () => {
      try {
        const [[userRow], [adminRow]] = await Promise.all([
          db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1),
          db.select({ name: users.name }).from(users).where(eq(users.id, session.user.id)).limit(1),
        ]);
        if (userRow?.email) {
          await sendCreditAssignmentEmail(
            userRow.email,
            userRow.name ?? 'there',
            adminRow?.name ?? 'An admin',
            amountDelta,
            creditType,
            result.newBalance,
            reason,
          );
        }
      } catch (err) {
        getLogger('admin-credits').warn({ err }, 'Failed to send credit assignment email');
      }
    }).catch(() => {});

    return { success: true as const, data: result };
  } catch (error) {
    const e = handleApiError(error, 'adjust-credits');
    return { success: false as const, error: e.error, code: 'ERROR' };
  }
}
