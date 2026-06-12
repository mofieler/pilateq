'use server';

import { z } from 'zod';
import { db } from '@/db';
import { creditPurchases, users, creditPackages } from '@/db/schema';
import { and, eq, gte, lt, sql, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { requireStudioId } from '@/lib/studio/studio-context';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthlyRevenue {
  month: number;
  monthLabel: string;
  revenueCents: number;
  outstandingCents: number;
  invoiceCount: number;
  paidCount: number;
}

export interface InvoiceRegistryEntry {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date | null;
  clientName: string | null;
  clientEmail: string | null;
  packageName: string | null;
  priceCents: number;
  currency: string;
  paymentStatus: string;
  paidAt: Date | null;
}

export interface TaxSummary {
  year: number;
  totalRevenueCents: number;
  totalOutstandingCents: number;
  totalOverdueCents: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  monthlyBreakdown: MonthlyRevenue[];
  invoiceRegistry: InvoiceRegistryEntry[];
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const taxSummarySchema = z.object({
  year: z.number().int().min(2020).max(2100),
});

// ─── Action ───────────────────────────────────────────────────────────────────

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export async function getTaxSummaryAction(
  year: number,
): Promise<{ success: boolean; error?: string; data?: TaxSummary }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = taxSummarySchema.safeParse({ year });
  if (!parsed.success) {
    return { success: false, error: 'Invalid year' };
  }

  const studioId = await requireStudioId();

  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
  const yearEnd   = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  // Monthly aggregation — one row per month
  const monthlyRows = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${creditPurchases.createdAt})::int`.mapWith(Number),
      revenueCents: sql<number>`
        SUM(CASE WHEN ${creditPurchases.paymentStatus} = 'paid' THEN ${creditPurchases.priceCents} ELSE 0 END)
      `.mapWith(Number),
      outstandingCents: sql<number>`
        SUM(CASE WHEN ${creditPurchases.paymentStatus} IN ('pending', 'overdue') THEN ${creditPurchases.priceCents} ELSE 0 END)
      `.mapWith(Number),
      invoiceCount: sql<number>`COUNT(${creditPurchases.invoiceNumber})`.mapWith(Number),
      paidCount: sql<number>`
        SUM(CASE WHEN ${creditPurchases.paymentStatus} = 'paid' THEN 1 ELSE 0 END)
      `.mapWith(Number),
    })
    .from(creditPurchases)
    .where(
      and(
        eq(creditPurchases.studioId, studioId),
        gte(creditPurchases.createdAt, yearStart),
        lt(creditPurchases.createdAt, yearEnd),
      ),
    )
    .groupBy(sql`EXTRACT(MONTH FROM ${creditPurchases.createdAt})`);

  // Build a full 12-month array with zeros for months without data
  const monthMap = new Map(monthlyRows.map((r) => [r.month, r]));
  const monthlyBreakdown: MonthlyRevenue[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const row = monthMap.get(m);
    return {
      month: m,
      monthLabel: MONTH_LABELS[i],
      revenueCents: row?.revenueCents ?? 0,
      outstandingCents: row?.outstandingCents ?? 0,
      invoiceCount: row?.invoiceCount ?? 0,
      paidCount: row?.paidCount ?? 0,
    };
  });

  // Invoice registry — all with invoice numbers, ordered by invoice date
  const registryRows = await db
    .select({
      id: creditPurchases.id,
      invoiceNumber: creditPurchases.invoiceNumber,
      invoiceDate: creditPurchases.invoiceIssuedAt,
      dueDate: creditPurchases.paymentDueDate,
      clientName: users.name,
      clientEmail: users.email,
      packageName: creditPackages.name,
      priceCents: creditPurchases.priceCents,
      currency: creditPurchases.currency,
      paymentStatus: creditPurchases.paymentStatus,
      paidAt: creditPurchases.paidAt,
      createdAt: creditPurchases.createdAt,
    })
    .from(creditPurchases)
    .leftJoin(users, and(eq(creditPurchases.userId, users.id), eq(users.studioId, studioId), isNull(users.deletedAt)))
    .leftJoin(creditPackages, and(eq(creditPurchases.packageId, creditPackages.id), eq(creditPackages.studioId, studioId)))
    .where(
      and(
        eq(creditPurchases.studioId, studioId),
        gte(creditPurchases.createdAt, yearStart),
        lt(creditPurchases.createdAt, yearEnd),
        sql`${creditPurchases.invoiceNumber} IS NOT NULL`,
      ),
    )
    .orderBy(sql`COALESCE(${creditPurchases.invoiceIssuedAt}, ${creditPurchases.createdAt}) ASC`);

  const invoiceRegistry: InvoiceRegistryEntry[] = registryRows.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoiceNumber!,
    invoiceDate: r.invoiceDate ?? r.createdAt,
    dueDate: r.dueDate,
    clientName: r.clientName,
    clientEmail: r.clientEmail,
    packageName: r.packageName,
    priceCents: r.priceCents,
    currency: r.currency,
    paymentStatus: r.paymentStatus,
    paidAt: r.paidAt,
  }));

  // Totals
  const totalRevenueCents = monthlyBreakdown.reduce((s, m) => s + m.revenueCents, 0);
  const totalOutstandingCents = monthlyBreakdown.reduce((s, m) => s + m.outstandingCents, 0);

  const [overdueRow] = await db
    .select({
      overdueCents: sql<number>`
        SUM(CASE WHEN ${creditPurchases.paymentStatus} = 'overdue' THEN ${creditPurchases.priceCents} ELSE 0 END)
      `.mapWith(Number),
    })
    .from(creditPurchases)
    .where(
      and(
        eq(creditPurchases.studioId, studioId),
        gte(creditPurchases.createdAt, yearStart),
        lt(creditPurchases.createdAt, yearEnd),
      ),
    );

  const totalOverdueCents = overdueRow?.overdueCents ?? 0;
  const invoiceCount = invoiceRegistry.length;
  const paidInvoiceCount = invoiceRegistry.filter((r) => r.paymentStatus === 'paid').length;

  return {
    success: true,
    data: {
      year,
      totalRevenueCents,
      totalOutstandingCents,
      totalOverdueCents,
      invoiceCount,
      paidInvoiceCount,
      monthlyBreakdown,
      invoiceRegistry,
    },
  };
}
