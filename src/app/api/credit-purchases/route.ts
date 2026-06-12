import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { creditPurchases, creditPackages, users } from '@/db/schema';
import { eq, and, isNull, ne } from 'drizzle-orm';
import { addDays } from 'date-fns';
import { requireUserOwnership } from '@/lib/auth/api-auth';
import { purchaseRateLimiter } from '@/lib/security/rate-limiter';
import { logSecurityEvent } from '@/lib/security/audit-logger';
import { handleApiError } from '@/lib/security/error-sanitizer';
import { generateInvoicePDF, InvoiceIdentityIncompleteError } from '@/lib/invoice/invoice.generator';
import { getStudioConfig } from '@/lib/studio/server';
import { sendPurchaseConfirmationWithInvoice } from '@/lib/email/resend';
import { getUserBillingStatus } from '@/modules/billing/services/billingStatus.service';
import { creditService } from '@/modules/billing/services/credit.service';
import {
  generateInvoiceNumber,
  getInvoicePrefix,
} from '@/modules/billing/services/invoiceNumber.service';
import { hasCompletedWelcome } from '@/lib/welcome';
import { FINANCIAL_CONFIG } from '@/lib/config/financial-config';
import { getLogger } from '@/lib/logger';

const logger = getLogger('credit-purchases');

const purchaseSchema = z.object({
  packageId: z.string().uuid(),
  userId: z.string().uuid(),
  paymentMethod: z.enum(['pay_at_studio']),
  acceptedTerms: z.literal(true),
  acceptedWithdrawal: z.literal(true),
  idempotencyKey: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  logger.info('Received purchase request');

  const rateLimitResult = await purchaseRateLimiter(request);
  if (!rateLimitResult.success) {
    logger.warn('Rate limit exceeded');
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'X-RateLimit-Reset': rateLimitResult.resetTime?.toString() || '' },
      },
    );
  }

  try {
    const body = await request.json();
    const parsed = purchaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { packageId, userId, paymentMethod, acceptedTerms, idempotencyKey } = parsed.data;

    const authResult = await requireUserOwnership(request, userId);
    if (authResult instanceof NextResponse) {
      logger.warn('Auth failed');
      return authResult;
    }
    const session = authResult;
    const studioId = session.user.studioId;

    await logSecurityEvent({
      userId: session.user.id,
      action: 'credit_purchase_attempt',
      resource: 'credit_purchase',
      details: { packageId, paymentMethod, acceptedTerms },
    });

    // Only pay-at-studio is allowed here — Stripe must go through the webhook
    if (paymentMethod !== 'pay_at_studio') {
      logger.warn({ paymentMethod }, 'Invalid payment method');
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    const [package_] = await db
      .select()
      .from(creditPackages)
      .where(and(eq(creditPackages.id, packageId), eq(creditPackages.studioId, studioId ?? '')));

    if (!package_) {
      logger.warn({ packageId }, 'Package not found');
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    if (!package_.studioId) {
      logger.error({ packageId }, 'Package missing studio association');
      return NextResponse.json(
        { error: 'Package is missing studio association' },
        { status: 500 },
      );
    }
    const effectiveStudioId = studioId ?? package_.studioId;

    // Welcome Journey gate: new clients can buy any package because credits
    // work for yoga classes too (yoga does not require Welcome Journey).
    // We only block duplicate Welcome Journey purchases.
    const isWelcomePackage = package_.name === 'Welcome Journey';

    if (isWelcomePackage) {
      const welcomed = await hasCompletedWelcome(userId);
      const [existingPurchase] = await db
        .select({ id: creditPurchases.id })
        .from(creditPurchases)
        .innerJoin(creditPackages, eq(creditPurchases.packageId, creditPackages.id))
        .where(
          and(
            eq(creditPurchases.userId, userId),
            eq(creditPurchases.studioId, effectiveStudioId),
            eq(creditPackages.studioId, effectiveStudioId),
            eq(creditPackages.name, 'Welcome Journey'),
            ne(creditPurchases.paymentStatus, 'cancelled'),
          ),
        )
        .limit(1);

      if (existingPurchase) {
        logger.warn('Welcome Journey already purchased');
        return NextResponse.json(
          {
            error: 'You have already purchased the Welcome Journey package. It can only be purchased once per student.',
            code: 'WELCOME_JOURNEY_ALREADY_PURCHASED',
          },
          { status: 400 },
        );
      }

      if (welcomed) {
        logger.warn('Welcome Journey already completed');
        return NextResponse.json(
          {
            error: 'You have already completed your Welcome Journey.',
            code: 'WELCOME_JOURNEY_ALREADY_COMPLETED',
          },
          { status: 400 },
        );
      }
    }

    const dueDate = addDays(new Date(), FINANCIAL_CONFIG.refundPolicyDays);

    // Block new purchases while the user has overdue invoices.
    // Same guard runs in createBookingAction — both must use billingStatus.service
    // so the policy stays in one place.
    const billing = await getUserBillingStatus(userId, effectiveStudioId);
    if (billing.blockActions) {
      logger.warn('Blocked due to overdue bills');
      return NextResponse.json(
        {
          error:
            'You have overdue invoices. Please settle them at the studio or via bank transfer before purchasing more credits.',
          code: 'OVERDUE_BILLS',
          overdueCount: billing.overdueBills.length,
        },
        { status: 402 }, // 402 Payment Required
      );
    }

    // Idempotency: if a purchase with the same key already exists for this user,
    // return it instead of creating a duplicate invoice.
    if (idempotencyKey) {
      const [existingByKey] = await db
        .select()
        .from(creditPurchases)
        .where(
          and(
            eq(creditPurchases.idempotencyKey, idempotencyKey),
            eq(creditPurchases.userId, userId),
            eq(creditPurchases.studioId, effectiveStudioId),
          ),
        )
        .limit(1);

      if (existingByKey) {
        logger.info({ purchaseId: existingByKey.id }, 'Returning existing purchase by idempotency key');
        const existingBalance = await creditService.getBalance(
          effectiveStudioId,
          userId,
          existingByKey.creditType,
        );
        return NextResponse.json({
          success: true,
          purchase: existingByKey,
          newBalance: existingBalance,
          invoiceNumber: existingByKey.invoiceNumber,
          dueDate: existingByKey.paymentDueDate?.toISOString() ?? dueDate.toISOString(),
        });
      }
    }

    // Atomic: generate invoice number + create purchase.
    // Credits are NOT granted for pay-at-studio purchases until an admin marks
    // them as paid (see updateCreditPurchaseAction).
    let purchase: typeof creditPurchases.$inferSelect;
    let invoiceNumber: string;
    try {
      ({ purchase, invoiceNumber } = await db.transaction(async (tx) => {
        const studioConfig = await getStudioConfig();
        const prefix = getInvoicePrefix(studioConfig);
        const invNumber = await generateInvoiceNumber(tx, effectiveStudioId, prefix);
        const now = new Date();

        const [newPurchase] = await tx
          .insert(creditPurchases)
          .values({
            userId,
            packageId,
            creditsAmount: package_.creditsAmount,
            creditType: package_.creditType,
            priceCents: package_.priceCents,
            currency: package_.currency,
            studioId: effectiveStudioId,
            paymentMethod,
            paymentStatus: 'pending',
            paymentDueDate: dueDate,
            paidAt: null,
            invoiceNumber: invNumber,
            invoiceIssuedAt: now,
            idempotencyKey: idempotencyKey ?? null,
            // creditsGrantedAt intentionally left null — credits are granted only
            // when an admin marks the purchase as paid.
          })
          .returning();

        return { purchase: newPurchase, invoiceNumber: invNumber };
      }));
    } catch (txError) {
      logger.error({ err: txError }, 'Transaction failed');
      return NextResponse.json(
        {
          error: 'Transaction failed. Please try again later.',
          code: 'TX_ERROR',
        },
        { status: 500 },
      );
    }

    // Read balance after the transaction commits so it reflects the actual ledger.
    // For pay-at-studio purchases credits are NOT granted yet, so this is the
    // current balance before payment confirmation.
    const currentBalance = await creditService.getBalance(effectiveStudioId, userId, package_.creditType);

    // Fire-and-forget: generate PDF invoice and send confirmation email
    Promise.resolve().then(async () => {
      try {
        const [userRow] = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(and(eq(users.id, userId), isNull(users.deletedAt)))
          .limit(1);

        if (!userRow?.email) return;

        const studioConfig = await getStudioConfig();
        const pdfBuffer = await generateInvoicePDF({
          invoiceNumber,
          invoiceDate:     new Date(),
          dueDate,
          customerId:      userId,
          customerName:    userRow.name ?? 'Customer',
          customerEmail:   userRow.email,
          customerAddress: null,
          packageName:     package_.name,
          creditsAmount:   package_.creditsAmount,
          creditType:      package_.creditType,
          priceCents:      package_.priceCents,
          currency:        package_.currency,
          paymentMethod:   'pay_at_studio',
          paymentStatus:   'pending',
        }, studioConfig);

        await sendPurchaseConfirmationWithInvoice(
          userRow.email,
          userRow.name ?? 'there',
          package_.name,
          package_.creditsAmount,
          package_.creditType,
          package_.priceCents,
          package_.currency,
          package_.validityDays,
          invoiceNumber,
          dueDate,
          pdfBuffer,
        );
      } catch (err) {
        if (err instanceof InvoiceIdentityIncompleteError) {
          logger.warn({ err }, 'Invoice not sent: studio identity incomplete');
        } else {
          logger.warn({ err }, 'Failed to generate/send invoice');
        }
      }
    }).catch(() => {});

    logger.info({ invoiceNumber, currentBalance }, 'Purchase successful');
    return NextResponse.json({
      success: true,
      purchase,
      currentBalance,
      invoiceNumber,
      dueDate: dueDate.toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Unexpected error');
    const errorResponse = handleApiError(error, 'credit-purchase');
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
