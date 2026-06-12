import { NextResponse } from 'next/server';
import { db } from '@/db';
import { creditPurchases, creditPackages, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { generateInvoicePDF, InvoiceIdentityIncompleteError, InvoicePDFError } from '@/lib/invoice/invoice.generator';
import { getStudioConfig } from '@/lib/studio/server';
import { requireStudioId } from '@/lib/studio/studio-context';
import { addDays } from 'date-fns';
import { getLogger } from '@/lib/logger';

/**
 * GET /api/purchases/[id]/invoice
 * Streams the regenerated PDF invoice for a given credit purchase.
 * Available to both the purchaser and admins.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const studioId = await requireStudioId();

  // Fetch purchase + joined data needed to render the PDF
  const [row] = await db
    .select({
      id:             creditPurchases.id,
      userId:         creditPurchases.userId,
      invoiceNumber:  creditPurchases.invoiceNumber,
      invoiceIssuedAt: creditPurchases.invoiceIssuedAt,
      paymentDueDate: creditPurchases.paymentDueDate,
      paymentStatus:  creditPurchases.paymentStatus,
      priceCents:     creditPurchases.priceCents,
      currency:       creditPurchases.currency,
      creditsAmount:  creditPurchases.creditsAmount,
      creditType:     creditPurchases.creditType,
      paymentMethod:  creditPurchases.paymentMethod,
      packageName:    creditPackages.name,
      adminNotes:     creditPurchases.adminNotes,
      customerId:     users.id,
      customerName:   users.name,
      customerEmail:  users.email,
    })
    .from(creditPurchases)
    .leftJoin(creditPackages, and(eq(creditPurchases.packageId, creditPackages.id), eq(creditPackages.studioId, studioId)))
    .leftJoin(users, and(eq(creditPurchases.userId, users.id), eq(users.studioId, studioId), isNull(users.deletedAt)))
    .where(and(eq(creditPurchases.id, id), eq(creditPurchases.studioId, studioId)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
  }

  // Security check: Only the owner of the purchase OR an admin can download it
  if (row.userId !== session.user.id && session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!row.invoiceNumber) {
    return NextResponse.json(
      { error: 'No invoice number on record — this purchase pre-dates the invoicing system.' },
      { status: 422 },
    );
  }

  const invoiceDate = row.invoiceIssuedAt ?? new Date();
  const dueDate     = row.paymentDueDate  ?? addDays(invoiceDate, 14);

  try {
    const studioConfig = await getStudioConfig();
    const pdfBuffer = await generateInvoicePDF({
      invoiceNumber:   row.invoiceNumber,
      invoiceDate,
      dueDate,
      customerId:      row.customerId,
      customerName:    row.customerName  ?? 'Customer',
      customerEmail:   row.customerEmail ?? '',
      customerAddress: null,
      packageName:     row.packageName   ?? row.adminNotes ?? 'Credit Package',
      creditsAmount:   row.creditsAmount,
      creditType:      row.creditType,
      priceCents:      row.priceCents,
      currency:        row.currency,
      paymentMethod:   row.paymentMethod,
      paymentStatus:   row.paymentStatus,
    }, studioConfig);

    return new Response(new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice-${row.invoiceNumber}.pdf"`,
        'Content-Length':      String(pdfBuffer.byteLength),
        'Cache-Control':       'no-store',
      },
    });
  } catch (error) {
    const logger = getLogger('purchase-invoice-route');
    logger.error({ err: error, purchaseId: id, invoiceNumber: row.invoiceNumber }, 'Failed to render invoice PDF');
    if (error instanceof InvoiceIdentityIncompleteError) {
      return NextResponse.json(
        { error: 'Studio identity is incomplete. Please complete the studio settings before generating invoices.' },
        { status: 400 },
      );
    }
    const status = error instanceof InvoicePDFError ? 503 : 500;
    return NextResponse.json(
      { error: 'PDF temporarily unavailable. Please try again later.' },
      { status },
    );
  }
}
