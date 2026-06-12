import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { db } from '@/db';
import { creditPackages } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getStudioConfig } from '@/lib/studio/server';
import { PaymentOrchestrator } from '@/modules/billing/services/paymentOrchestrator.service';
import { purchaseRateLimiter } from '@/lib/security/rate-limiter';
import { handleApiError } from '@/lib/security/error-sanitizer';
import { getLogger } from '@/lib/logger';

const logger = getLogger('stripe-checkout');
import { z } from 'zod';

const bodySchema = z.object({
  packageId: z.string().uuid(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

/**
 * Create a Stripe Checkout Session for a credit package purchase.
 *
 * The client is redirected to Stripe; after payment the Stripe webhook
 * marks the purchase as paid and grants credits.
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = await purchaseRateLimiter(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'X-RateLimit-Reset': rateLimitResult.resetTime?.toString() || '' },
      },
    );
  }

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.format() }, { status: 400 });
    }

    const { packageId, successUrl, cancelUrl } = parsed.data;
    const userId = session.user.id;

    const studioConfig = await getStudioConfig();

    const [package_] = await db
      .select()
      .from(creditPackages)
      .where(and(eq(creditPackages.id, packageId), eq(creditPackages.studioId, studioConfig.id ?? '')))
      .limit(1);
    if (!package_) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }
    const orchestrator = new PaymentOrchestrator(studioConfig);

    const result = await orchestrator.createCheckout('stripe', {
      userId,
      amountCents: package_.priceCents,
      currency: package_.currency,
      description: `${package_.name} — ${package_.creditsAmount} credits`,
      successUrl,
      cancelUrl,
      customerEmail: session.user.email,
      metadata: {
        userId,
        packageId,
        studioId: studioConfig.id ?? '',
      },
    });

    if (result.type === 'redirect') {
      return NextResponse.json({ redirectUrl: result.redirectUrl, sessionId: result.providerPaymentId });
    }

    if (result.type === 'error') {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    if (result.type === 'manual') {
      return NextResponse.json({ providerPaymentId: result.providerPaymentId, instructions: result.instructions });
    }

    return NextResponse.json({ error: 'Unexpected payment result' }, { status: 500 });
  } catch (error) {
    logger.error({ err: error }, 'Checkout handler failed');
    const errorResponse = handleApiError(error, 'stripe-checkout');
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
