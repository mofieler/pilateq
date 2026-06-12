import { NextResponse } from 'next/server';
import { db } from '@/db';
import { creditPurchases, creditPackages, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { addDays } from 'date-fns';
import { getStudioConfigForHostname } from '@/lib/studio/server';
import { getPluginByKey } from '@/lib/plugins/registry';
import { creditService } from '@/modules/billing/services/credit.service';
import {
  generateInvoiceNumber,
  getInvoicePrefix,
} from '@/modules/billing/services/invoiceNumber.service';
import { generateInvoicePDF, InvoiceIdentityIncompleteError } from '@/lib/invoice/invoice.generator';
import { sendPurchaseConfirmationWithInvoice } from '@/lib/email/resend';
import { handleApiError } from '@/lib/security/error-sanitizer';
import { getLogger } from '@/lib/logger';

const logger = getLogger('stripe-webhook');

/**
 * Stripe webhook endpoint.
 *
 * Listens for checkout.session.completed events and fulfills purchases:
 * 1. Creates or updates the credit_purchases row.
 * 2. Grants credits via creditService.
 * 3. Sends invoice confirmation email.
 */
export async function POST(request: Request) {
  try {
    const hostname = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost';
    const { config: studioConfig } = await getStudioConfigForHostname(hostname);

    const stripePlugin = getPluginByKey('stripe');
    if (!stripePlugin || stripePlugin.type !== 'payment') {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 400 });
    }

    const intent = stripePlugin.handleWebhook
      ? await stripePlugin.handleWebhook({ studioConfig, studioId: studioConfig.id ?? '' }, request)
      : null;

    if (!intent) {
      return NextResponse.json({ received: true });
    }

    const metadata = (intent.providerMetadata?.metadata ?? {}) as Record<string, string>;
    const userId = metadata.userId;
    const packageId = metadata.packageId;

    if (!userId || !packageId) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    const [package_] = await db
      .select()
      .from(creditPackages)
      .where(and(eq(creditPackages.id, packageId), eq(creditPackages.studioId, studioConfig.id ?? '')))
      .limit(1);

    if (!package_) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    const dueDate = addDays(new Date(), studioConfig.financial.refundPolicyDays);

    // Idempotency: check for existing paid purchase with this Stripe session.
    const [existing] = await db
      .select()
      .from(creditPurchases)
      .where(and(
        eq(creditPurchases.studioId, studioConfig.id ?? ''),
        eq(creditPurchases.stripeSessionId, intent.providerMetadata?.sessionId as string),
      ))
      .limit(1);

    if (existing?.paymentStatus === 'paid') {
      return NextResponse.json({ received: true, id: existing.id });
    }

    const result = await db.transaction(async (tx) => {
      const prefix = getInvoicePrefix(studioConfig);
      const invNumber = await generateInvoiceNumber(tx, studioConfig.id ?? '', prefix);
      const now = new Date();

      let purchaseId: string;
      if (existing) {
        await tx
          .update(creditPurchases)
          .set({
            paymentStatus: 'paid',
            paidAt: now,
            stripePaymentIntentId: intent.providerMetadata?.paymentIntentId as string,
          })
          .where(eq(creditPurchases.id, existing.id));
        purchaseId = existing.id;
      } else {
        const [newPurchase] = await tx
          .insert(creditPurchases)
          .values({
            studioId: studioConfig.id ?? '',
            userId,
            packageId,
            creditsAmount: package_.creditsAmount,
            creditType: package_.creditType,
            priceCents: intent.amountCents,
            currency: intent.currency,
            paymentMethod: 'stripe',
            paymentStatus: 'paid',
            paidAt: now,
            paymentDueDate: dueDate,
            invoiceNumber: invNumber,
            invoiceIssuedAt: now,
            stripeSessionId: intent.providerMetadata?.sessionId as string,
            stripePaymentIntentId: intent.providerMetadata?.paymentIntentId as string,
          })
          .returning();
        purchaseId = newPurchase.id;
      }

      const expiresAt = addDays(now, package_.validityDays);

      await creditService.addPurchase(tx, {
        studioId: studioConfig.id ?? '',
        userId,
        creditType: package_.creditType as any,
        amount: package_.creditsAmount,
        purchaseId,
        expiresAt,
        description: `Stripe purchase: ${package_.creditsAmount} ${package_.creditType} credits`,
      });

      return { purchaseId, invoiceNumber: existing?.invoiceNumber ?? invNumber };
    });

    // Read balance after the transaction commits so the ledger grant is visible.
    const newBalance = await creditService.getBalance(
      studioConfig.id ?? '',
      userId,
      package_.creditType as any,
    );

    // Fire-and-forget email confirmation.
    Promise.resolve().then(async () => {
      try {
        const [userRow] = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(and(eq(users.id, userId), isNull(users.deletedAt)))
          .limit(1);

        if (!userRow?.email) return;

        const pdfBuffer = await generateInvoicePDF({
          invoiceNumber: result.invoiceNumber,
          invoiceDate: new Date(),
          dueDate,
          customerId: userId,
          customerName: userRow.name ?? 'Customer',
          customerEmail: userRow.email,
          customerAddress: null,
          packageName: package_.name,
          creditsAmount: package_.creditsAmount,
          creditType: package_.creditType,
          priceCents: intent.amountCents,
          currency: intent.currency,
          paymentMethod: 'stripe',
          paymentStatus: 'paid',
        }, studioConfig);

        await sendPurchaseConfirmationWithInvoice(
          userRow.email,
          userRow.name ?? 'there',
          package_.name,
          package_.creditsAmount,
          package_.creditType,
          intent.amountCents,
          intent.currency,
          package_.validityDays,
          result.invoiceNumber,
          dueDate,
          pdfBuffer,
        );
      } catch (err) {
        if (err instanceof InvoiceIdentityIncompleteError) {
          logger.warn({ err }, 'Invoice not sent: studio identity incomplete');
        } else {
          logger.warn({ err }, 'Failed to send invoice');
        }
      }
    }).catch(() => {});

    return NextResponse.json({ received: true, purchaseId: result.purchaseId });
  } catch (error) {
    logger.error({ err: error }, 'Webhook handler failed');
    const errorResponse = handleApiError(error, 'stripe-webhook');
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
