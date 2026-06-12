import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { db } from '@/db';
import { creditPurchases, creditPackages, users } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

// Error codes for better maintainability
const ERROR_CODES = {
  UNAUTHORIZED: 401,
  SERVER_ERROR: 500,
} as const;

type PurchaseRow = {
  id: string;
  invoiceNumber: string | null;
  creditsAmount: number;
  priceCents: number;
  currency: string;
  paymentDueDate: Date | null;
  paidAt: Date | null;
  paymentStatus: string;
  createdAt: Date;
  updatedAt: Date;
  packageName: string | null;
  adminNotes: string | null;
  packageId: string | null;
};

function transformPurchaseData(purchase: PurchaseRow) {
  const now = new Date();
  const isPaid = purchase.paymentStatus === 'paid';
  const isOverdue = !isPaid && purchase.paymentDueDate
    ? new Date(purchase.paymentDueDate) < now
    : false;

  const daysUntilDue = purchase.paymentDueDate && !isPaid
    ? Math.ceil((new Date(purchase.paymentDueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : undefined;

  return {
    id: purchase.id,
    invoiceNumber: purchase.invoiceNumber,
    creditsAmount: purchase.creditsAmount,
    priceCents: purchase.priceCents,
    currency: purchase.currency || 'eur',
    paymentDueDate: purchase.paymentDueDate,
    daysUntilDue,
    isOverdue,
    status: isPaid ? 'paid' : (isOverdue ? 'overdue' : 'open'),
    createdAt: purchase.createdAt.toISOString(),
    paidAt: purchase.paidAt?.toISOString(),
    // adminNotes stores the plan name for membership purchases (packageId is null)
    packageName: purchase.packageName ?? purchase.adminNotes ?? undefined,
    itemType: purchase.packageId === null && purchase.adminNotes ? 'membership' : 'package',
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      console.warn('Unauthorized bills access attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: ERROR_CODES.UNAUTHORIZED }
      );
    }

    const userId = session.user.id;
    const studioId = session.user.studioId;

    if (!studioId) {
      return NextResponse.json(
        { error: 'No studio context available' },
        { status: ERROR_CODES.UNAUTHORIZED }
      );
    }

    // Fetch all credit purchases for the user scoped to their studio.
    const purchases = await db
      .select({
        id: creditPurchases.id,
        invoiceNumber: creditPurchases.invoiceNumber,
        creditsAmount: creditPurchases.creditsAmount,
        priceCents: creditPurchases.priceCents,
        currency: creditPurchases.currency,
        paymentDueDate: creditPurchases.paymentDueDate,
        paidAt: creditPurchases.paidAt,
        paymentStatus: creditPurchases.paymentStatus,
        createdAt: creditPurchases.createdAt,
        updatedAt: creditPurchases.updatedAt,
        packageName: creditPackages.name,
        adminNotes: creditPurchases.adminNotes,
        packageId: creditPurchases.packageId,
      })
      .from(creditPurchases)
      .leftJoin(creditPackages, eq(creditPurchases.packageId, creditPackages.id))
      .where(
        and(
          eq(creditPurchases.userId, userId),
          eq(creditPurchases.studioId, studioId),
        )
      )
      .orderBy(desc(creditPurchases.createdAt));

    // Transform data to match frontend expectations
    const bills = purchases.map(transformPurchaseData);

    return NextResponse.json({
      success: true,
      bills,
    });
  } catch (error) {
    console.error('Bills API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: ERROR_CODES.SERVER_ERROR }
    );
  }
}
