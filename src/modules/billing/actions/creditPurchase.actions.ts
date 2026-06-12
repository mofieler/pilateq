'use server';

import { z } from 'zod';
import { db } from '@/db';
import { creditPurchases, users, creditPackages, invoiceReminders } from '@/db/schema';
import type { CreditPurchase } from '@/db/schema';
import { eq, sql, count, max, isNull, and } from 'drizzle-orm';
import { requireAdmin, ActionAuthError } from '@/lib/auth/action-auth';
import { auditHelpers } from '@/lib/security/audit-system';
import { handleApiError } from '@/lib/security/error-sanitizer';
import { creditService } from '@/modules/billing/services/credit.service';
import {
  generateInvoiceNumber,
  getInvoicePrefix,
} from '@/modules/billing/services/invoiceNumber.service';
import { addDays } from 'date-fns';
import { getStudioConfig } from '@/lib/studio/server';
import { FINANCIAL_CONFIG, CREDIT_PACK_CATEGORIES } from '@/lib/config/financial-config';
import { ActionResult } from '@/lib/types/action.types';
import { getLogger } from '@/lib/logger';

const logger = getLogger('credit-purchase-actions');

async function verifyTargetUserStudio(userId: string, studioId: string): Promise<boolean> {
  const [target] = await db
    .select({ studioId: users.studioId })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  return target?.studioId === studioId;
}

// Types
interface CreditPurchaseUpdate {
  paymentStatus: 'pending' | 'paid' | 'failed' | 'cancelled' | 'overdue';
  adminNotes?: string | null;
  paidAt?: Date;
}

type CreditPurchaseRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userAvatarUrl: string | null;
  packageName: string | null;
  creditsAmount: number;
  creditType: string;
  priceCents: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentDueDate: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  adminNotes: string | null;
  invoiceNumber: string | null;
  invoiceIssuedAt: Date | null;
  reminderCount: number;
  lastReminderAt: Date | null;
};

type PurchaseStats = {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  totalRevenue: number;
  outstanding: number;
};

type CreditPurchaseErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'INVALID_INPUT'
  | 'DB_ERROR'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN_ERROR';

// Validation schemas
const updatePurchaseSchema = z.object({
  purchaseId: z.string().uuid(),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'cancelled', 'overdue']),
  adminNotes: z.string().optional(),
});

const createManualPurchaseSchema = z.object({
  userId: z.string().uuid(),
  packageId: z.string().uuid().optional(),
  creditsAmount: z.number().int().positive(),
  creditType: z.enum(['pass', 'mat_pass', 'reformer_pass', 'session']),
  priceCents: z.number().int().min(0),
  currency: z.string().length(3).default('eur'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'pay_at_studio', 'stripe']),
  paymentStatus: z.enum(['pending', 'paid']),
  paidAt: z.string().datetime().optional().nullable(),
  paymentDueDate: z.string().datetime().optional().nullable(),
  validityWeeks: z.number().int().min(1).max(156).optional(),
  adminNotes: z.string().max(500).optional(),
  generateInvoice: z.boolean().default(true),
});

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

// Get all credit purchases with user details
export async function getAllCreditPurchasesAction(): Promise<
  ActionResult<CreditPurchaseRow[], CreditPurchaseErrorCode>
> {
  const auth = await requireAdminContext();
  if ('success' in auth) return auth;
  const { studioId } = auth;

  try {
    // Subquery: reminder count + last sent date per purchase
    const reminderStats = db
      .select({
        purchaseId: invoiceReminders.purchaseId,
        reminderCount: count(invoiceReminders.id).as('reminder_count'),
        lastReminderAt: max(invoiceReminders.createdAt).as('last_reminder_at'),
      })
      .from(invoiceReminders)
      .groupBy(invoiceReminders.purchaseId)
      .as('reminder_stats');

    const purchases = await db
      .select({
        id: creditPurchases.id,
        userId: creditPurchases.userId,
        userName: users.name,
        userEmail: users.email,
        userAvatarUrl: users.avatarUrl,
        packageName: creditPackages.name,
        creditsAmount: creditPurchases.creditsAmount,
        creditType: creditPurchases.creditType,
        priceCents: creditPurchases.priceCents,
        currency: creditPurchases.currency,
        paymentMethod: creditPurchases.paymentMethod,
        paymentStatus: creditPurchases.paymentStatus,
        paymentDueDate: creditPurchases.paymentDueDate,
        paidAt: creditPurchases.paidAt,
        createdAt: creditPurchases.createdAt,
        adminNotes: creditPurchases.adminNotes,
        invoiceNumber: creditPurchases.invoiceNumber,
        invoiceIssuedAt: creditPurchases.invoiceIssuedAt,
        reminderCount: sql<number>`COALESCE(${reminderStats.reminderCount}, 0)`.mapWith(Number),
        lastReminderAt: reminderStats.lastReminderAt,
      })
      .from(creditPurchases)
      .leftJoin(users, and(eq(creditPurchases.userId, users.id), isNull(users.deletedAt)))
      .leftJoin(creditPackages, eq(creditPurchases.packageId, creditPackages.id))
      .leftJoin(reminderStats, eq(creditPurchases.id, reminderStats.purchaseId))
      .where(eq(creditPurchases.studioId, studioId))
      .orderBy(sql`${creditPurchases.createdAt} DESC`);

    return { success: true, data: purchases as CreditPurchaseRow[] };
  } catch (error) {
    logger.error({ err: error }, 'getAllCreditPurchasesAction failed');
    const errorResponse = handleApiError(error, 'get-purchases');
    return { success: false, error: errorResponse.error, code: errorResponse.code as CreditPurchaseErrorCode };
  }
}

// Update credit purchase status and add credits if marked as paid
export async function updateCreditPurchaseAction(
  input: z.infer<typeof updatePurchaseSchema>,
): Promise<ActionResult<CreditPurchase, CreditPurchaseErrorCode>> {
  const auth = await requireAdminContext();
  if ('success' in auth) return auth;
  const { userId: adminId, studioId } = auth;

  const parsed = updatePurchaseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', code: 'INVALID_STATE' };
  }

  const { purchaseId, paymentStatus, adminNotes } = parsed.data;

  try {
    // Get current purchase details first for audit logging
    const [currentPurchase] = await db
      .select()
      .from(creditPurchases)
      .where(and(
        eq(creditPurchases.id, purchaseId),
        eq(creditPurchases.studioId, studioId)
      ));

    if (!currentPurchase) {
      return { success: false, error: 'Purchase not found', code: 'NOT_FOUND' };
    }

    const userBelongs = await verifyTargetUserStudio(currentPurchase.userId, studioId);
    if (!userBelongs) {
      return { success: false, error: 'Purchase not found', code: 'NOT_FOUND' };
    }

    // Only allow status changes from pending/overdue to paid
    if (paymentStatus === 'paid' && !['pending', 'overdue'].includes(currentPurchase.paymentStatus)) {
      return { success: false, error: 'Can only mark pending or overdue purchases as paid', code: 'INVALID_STATE' };
    }

    const shouldGrantCredits = paymentStatus === 'paid' && !currentPurchase.creditsGrantedAt;

    // Resolve package validity for expiry computation.
    let purchaseExpiresAt: Date | undefined = undefined;
    if (shouldGrantCredits) {
      const paidAt = new Date();
      if (currentPurchase.packageId) {
        const [pkg] = await db
          .select({ validityDays: creditPackages.validityDays, creditType: creditPackages.creditType })
          .from(creditPackages)
          .where(and(eq(creditPackages.id, currentPurchase.packageId), eq(creditPackages.studioId, studioId)))
          .limit(1);
        const validityDays = pkg?.validityDays ?? CREDIT_PACK_CATEGORIES[(pkg?.creditType ?? currentPurchase.creditType) === 'session' ? 'session' : 'credit'].defaultValidityDays;
        purchaseExpiresAt = addDays(paidAt, validityDays);
      } else {
        const validityDays = CREDIT_PACK_CATEGORIES[currentPurchase.creditType === 'session' ? 'session' : 'credit'].defaultValidityDays;
        purchaseExpiresAt = addDays(paidAt, validityDays);
      }
    }

    const [updatedPurchase] = await db.transaction(async (tx) => {
      if (shouldGrantCredits) {
        await creditService.addPurchase(tx, {
          studioId,
          userId: currentPurchase.userId,
          creditType: currentPurchase.creditType,
          amount: currentPurchase.creditsAmount,
          purchaseId: currentPurchase.id,
          expiresAt: purchaseExpiresAt,
          description: `Purchase marked as paid: ${currentPurchase.creditsAmount} ${currentPurchase.creditType} credits${currentPurchase.invoiceNumber ? ` (${currentPurchase.invoiceNumber})` : ''}`,
        });
      }

      const [updated] = await tx
        .update(creditPurchases)
        .set({
          paymentStatus,
          adminNotes: adminNotes || currentPurchase.adminNotes,
          ...(paymentStatus === 'paid' ? { paidAt: new Date() } : {}),
          ...(shouldGrantCredits ? { creditsGrantedAt: new Date() } : {}),
        })
        .where(and(
          eq(creditPurchases.id, purchaseId),
          eq(creditPurchases.studioId, studioId)
        ))
        .returning();

      return [updated];
    });

    // Log admin action
    await auditHelpers.logAdminAction(
      adminId,
      `update_purchase_status_${paymentStatus}`,
      'credit_purchase',
      purchaseId,
      {
        previousStatus: currentPurchase.paymentStatus,
        newStatus: paymentStatus,
        adminNotes,
        creditsGranted: shouldGrantCredits,
      }
    );

    return { success: true, data: updatedPurchase };
  } catch (error) {
    await auditHelpers.logAdminAction(
      adminId,
      'update_purchase_status_failed',
      'credit_purchase',
      purchaseId,
      {
        paymentStatus,
        adminNotes,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      false
    );

    logger.error({ err: error }, 'updateCreditPurchaseAction failed');
    const errorResponse = handleApiError(error, 'update-purchase');
    return { success: false, error: errorResponse.error, code: errorResponse.code as CreditPurchaseErrorCode };
  }
}

// Create a manual purchase (admin-initiated)
export async function createManualPurchaseAction(
  input: z.infer<typeof createManualPurchaseSchema>,
): Promise<ActionResult<{ purchase: CreditPurchase; newBalance: number; invoiceNumber: string | null }, CreditPurchaseErrorCode>> {
  const auth = await requireAdminContext();
  if ('success' in auth) return auth;
  const { userId: adminId, studioId } = auth;

  const parsed = createManualPurchaseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input: ' + parsed.error.message, code: 'INVALID_INPUT' };
  }

  const {
    userId,
    packageId,
    creditsAmount,
    creditType,
    priceCents,
    currency,
    paymentMethod,
    paymentStatus,
    paidAt,
    paymentDueDate,
    validityWeeks,
    adminNotes,
    generateInvoice,
  } = parsed.data;

  try {
    // Verify user exists
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return { success: false, error: 'User not found', code: 'NOT_FOUND' };
    }

    const userBelongs = await verifyTargetUserStudio(userId, studioId);
    if (!userBelongs) {
      return { success: false, error: 'User not found', code: 'NOT_FOUND' };
    }

    // If packageId provided, verify it exists and belongs to the admin's studio
    let pkg: typeof creditPackages.$inferSelect | null = null;
    if (packageId) {
      const [found] = await db
        .select()
        .from(creditPackages)
        .where(and(eq(creditPackages.id, packageId), eq(creditPackages.studioId, studioId)))
        .limit(1);
      if (!found) {
        return { success: false, error: 'Package not found', code: 'NOT_FOUND' };
      }
      pkg = found;
    }

    const now = new Date();
    const dueDate = paymentStatus === 'pending'
      ? (paymentDueDate ? new Date(paymentDueDate) : addDays(now, FINANCIAL_CONFIG.refundPolicyDays))
      : null;
    const paidDate = paymentStatus === 'paid' && paidAt ? new Date(paidAt) : (paymentStatus === 'paid' ? now : null);

    // Determine validity. Explicit validityWeeks overrides package validityDays.
    const validityDays = validityWeeks
      ? validityWeeks * 7
      : pkg
        ? pkg.validityDays
        : CREDIT_PACK_CATEGORIES[creditType === 'session' ? 'session' : 'credit'].defaultValidityDays;
    const expiresAt = paidDate ? addDays(paidDate, validityDays) : null;

    // Atomic transaction: create purchase + grant credits
    const result = await db.transaction(async (tx) => {
      // Generate invoice number if requested
      let invNumber: string | null = null;
      if (generateInvoice) {
        const studioConfig = await getStudioConfig();
        const prefix = getInvoicePrefix(studioConfig);
        invNumber = await generateInvoiceNumber(tx, studioId, prefix);
      }

      const shouldGrantCredits = paymentStatus === 'paid';

      // Create purchase record
      const [newPurchase] = await tx
        .insert(creditPurchases)
        .values({
          studioId,
          userId,
          packageId: pkg?.id ?? null,
          creditsAmount,
          creditType,
          priceCents,
          currency,
          paymentMethod,
          paymentStatus,
          paymentDueDate: dueDate,
          paidAt: paidDate,
          invoiceNumber: invNumber,
          invoiceIssuedAt: generateInvoice ? now : null,
          creditsGrantedAt: shouldGrantCredits ? now : null,
          adminNotes: adminNotes ?? null,
        })
        .returning();

      // Grant credits immediately only when the purchase is paid.
      // Pending purchases will be granted later via updateCreditPurchaseAction.
      if (shouldGrantCredits) {
        await creditService.addPurchase(tx, {
          studioId,
          userId,
          creditType,
          amount: creditsAmount,
          purchaseId: newPurchase.id,
          expiresAt: expiresAt ?? undefined,
          description: `Manual purchase by admin: ${creditsAmount} ${creditType} credits${invNumber ? ` (${invNumber})` : ''}`,
        });
      }

      return { purchase: newPurchase, invoiceNumber: invNumber };
    });

    // Read balance after the transaction commits so the new credit grant is visible.
    const balance = await creditService.getBalance(studioId, userId, creditType);

    // Log admin action
    await auditHelpers.logAdminAction(
      adminId,
      'create_manual_purchase',
      'credit_purchase',
      result.purchase.id,
      {
        userId,
        packageId: pkg?.id ?? null,
        creditsAmount,
        creditType,
        priceCents,
        paymentMethod,
        paymentStatus,
        invoiceNumber: result.invoiceNumber,
        adminNotes,
      }
    );

    return {
      success: true,
      data: {
        purchase: result.purchase,
        newBalance: balance,
        invoiceNumber: result.invoiceNumber,
      },
    };
  } catch (error) {
    await auditHelpers.logAdminAction(
      adminId,
      'create_manual_purchase_failed',
      'credit_purchase',
      undefined,
      {
        userId,
        packageId: packageId ?? null,
        creditsAmount,
        creditType,
        priceCents,
        paymentMethod,
        paymentStatus,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      false
    );

    logger.error({ err: error }, 'createManualPurchaseAction failed');
    const errorResponse = handleApiError(error, 'create-manual-purchase');
    return { success: false, error: errorResponse.error, code: errorResponse.code as CreditPurchaseErrorCode };
  }
}

// Get purchase statistics
export async function getPurchaseStatsAction(): Promise<ActionResult<PurchaseStats, CreditPurchaseErrorCode>> {
  const auth = await requireAdminContext();
  if ('success' in auth) return auth;
  const { studioId } = auth;

  try {
    // Reference Drizzle columns so the generated SQL uses real snake_case
    // names (payment_status, price_cents). The previous version embedded
    // camelCase identifiers literally and threw "column ... does not exist"
    // at runtime.
    const stats = await db
      .select({
        total: sql<number>`COUNT(*)`.mapWith(Number),
        paid: sql<number>`SUM(CASE WHEN ${creditPurchases.paymentStatus} = 'paid' THEN 1 ELSE 0 END)`.mapWith(Number),
        pending: sql<number>`SUM(CASE WHEN ${creditPurchases.paymentStatus} = 'pending' THEN 1 ELSE 0 END)`.mapWith(Number),
        overdue: sql<number>`SUM(CASE WHEN ${creditPurchases.paymentStatus} = 'overdue' THEN 1 ELSE 0 END)`.mapWith(Number),
        totalRevenue: sql<number>`SUM(CASE WHEN ${creditPurchases.paymentStatus} = 'paid' THEN ${creditPurchases.priceCents} ELSE 0 END)`.mapWith(Number),
        outstanding: sql<number>`SUM(CASE WHEN ${creditPurchases.paymentStatus} IN ('pending','overdue') THEN ${creditPurchases.priceCents} ELSE 0 END)`.mapWith(Number),
      })
      .from(creditPurchases)
      .where(eq(creditPurchases.studioId, studioId));

    return { success: true, data: stats[0] as PurchaseStats };
  } catch (error) {
    logger.error({ err: error }, 'getPurchaseStatsAction failed');
    const errorResponse = handleApiError(error, 'get-stats');
    return { success: false, error: errorResponse.error, code: errorResponse.code as CreditPurchaseErrorCode };
  }
}
