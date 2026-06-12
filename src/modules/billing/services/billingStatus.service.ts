import { db } from '@/db';
import { creditPurchases } from '@/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { differenceInCalendarDays } from 'date-fns';

// Status of any pay-at-studio invoice that has not yet been paid.
// `overdue` is computed live from `paymentDueDate` — we do not rely on the
// `paymentStatus = 'overdue'` enum value being flipped by a cron, because:
//   • there is no such cron yet
//   • the source of truth for "is this late?" is the due date itself
// The enum value still works once an admin (or future job) sets it.
export type OpenBill = {
  id: string;
  invoiceNumber: string | null;
  packageId: string | null;
  creditsAmount: number;
  creditType: string;
  priceCents: number;
  currency: string;
  invoiceIssuedAt: Date | null;
  paymentDueDate: Date | null;
  daysUntilDue: number;       // negative = overdue
  isOverdue: boolean;
  isDueSoon: boolean;         // 0..3 days remaining and not overdue
};

export type BillingStatus = {
  openBills: OpenBill[];
  overdueBills: OpenBill[];
  dueSoonBills: OpenBill[];
  hasOpenBills: boolean;
  hasOverdueBills: boolean;
  // Hard block: user cannot purchase / book until all overdue bills are cleared.
  blockActions: boolean;
};

const OPEN_STATUSES: readonly ('pending' | 'overdue')[] = ['pending', 'overdue'] as const;

const DUE_SOON_THRESHOLD_DAYS = 3;

/**
 * Single source of truth for "does this user owe the studio money?".
 *
 * Used by:
 *  - Dashboard "Open Bills" widget
 *  - Login reminder popup
 *  - createBooking guard (block bookings while overdue)
 *  - /api/credit-purchases guard (block more purchases while overdue)
 */
export async function getUserBillingStatus(
  userId: string,
  studioId: string,
): Promise<BillingStatus> {
  const rows = await db
    .select({
      id:              creditPurchases.id,
      invoiceNumber:   creditPurchases.invoiceNumber,
      packageId:       creditPurchases.packageId,
      creditsAmount:   creditPurchases.creditsAmount,
      creditType:      creditPurchases.creditType,
      priceCents:      creditPurchases.priceCents,
      currency:        creditPurchases.currency,
      invoiceIssuedAt: creditPurchases.invoiceIssuedAt,
      paymentDueDate:  creditPurchases.paymentDueDate,
      paymentMethod:   creditPurchases.paymentMethod,
    })
    .from(creditPurchases)
    .where(
      and(
        eq(creditPurchases.userId, userId),
        eq(creditPurchases.studioId, studioId),
        eq(creditPurchases.paymentMethod, 'pay_at_studio'),
        inArray(creditPurchases.paymentStatus, OPEN_STATUSES),
      ),
    )
    .orderBy(asc(creditPurchases.paymentDueDate));

  const today = new Date();
  const openBills: OpenBill[] = rows.map((r) => {
    const days = r.paymentDueDate
      ? differenceInCalendarDays(r.paymentDueDate, today)
      : Number.POSITIVE_INFINITY;
    const isOverdue = days < 0;
    const isDueSoon = !isOverdue && days <= DUE_SOON_THRESHOLD_DAYS;
    return {
      id:              r.id,
      invoiceNumber:   r.invoiceNumber,
      packageId:       r.packageId,
      creditsAmount:   r.creditsAmount,
      creditType:      r.creditType,
      priceCents:      r.priceCents,
      currency:        r.currency,
      invoiceIssuedAt: r.invoiceIssuedAt,
      paymentDueDate:  r.paymentDueDate,
      daysUntilDue:    days,
      isOverdue,
      isDueSoon,
    };
  });

  const overdueBills = openBills.filter((b) => b.isOverdue);
  const dueSoonBills = openBills.filter((b) => b.isDueSoon);

  return {
    openBills,
    overdueBills,
    dueSoonBills,
    hasOpenBills:    openBills.length > 0,
    hasOverdueBills: overdueBills.length > 0,
    blockActions:    overdueBills.length > 0,
  };
}
