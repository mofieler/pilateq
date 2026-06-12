/**
 * Stripe payment provider plugin.
 *
 * Creates Checkout Sessions for credit/package purchases and handles
 * Stripe webhook events to mark purchases as paid and grant credits.
 */

import Stripe from 'stripe';
import type { PaymentProviderPlugin, PaymentIntent, CreatePaymentInput } from '../types';
import type { StudioConfig } from '@/lib/studio';

function getStripeClient(config: StudioConfig): Stripe {
  const provider = config.paymentProviders.find((p) => p.provider === 'stripe');
  const secretKey = provider?.credentials?.secretKey;
  if (!secretKey) {
    throw new Error('Stripe secret key is not configured');
  }
  return new Stripe(secretKey, {
    apiVersion: Stripe.API_VERSION, // Pin to the SDK's bundled API version.
    typescript: true,
  });
}

export const stripePlugin: PaymentProviderPlugin = {
  key: 'stripe',
  type: 'payment',
  displayName: 'Stripe',
  description: 'Accept credit and debit card payments securely via Stripe.',
  availableGlobally: true,

  isAvailable(config) {
    const provider = config.paymentProviders.find((p) => p.provider === 'stripe');
    return provider?.enabled === true && !!provider.credentials?.secretKey;
  },

  async createPayment(ctx, input) {
    const stripe = getStripeClient(ctx.studioConfig);
    const provider = ctx.studioConfig.paymentProviders.find((p) => p.provider === 'stripe');
    const publishableKey = provider?.credentials?.publishableKey;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            product_data: { name: input.description },
            unit_amount: input.amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail,
      metadata: input.metadata,
    });

    if (!session.url) {
      throw new Error('Stripe checkout session did not return a redirect URL');
    }

    return {
      id: session.id,
      redirectUrl: session.url,
      amountCents: input.amountCents,
      currency: input.currency,
      status: 'pending',
      providerMetadata: {
        publishableKey,
        clientSecret: session.client_secret,
      },
    } as const;
  },

  async refund(ctx, paymentId, amountCents) {
    const stripe = getStripeClient(ctx.studioConfig);
    const refund = await stripe.refunds.create({
      payment_intent: paymentId,
      amount: amountCents,
    });

    return {
      id: refund.id,
      amountCents: refund.amount ?? 0,
      currency: (refund.currency ?? ctx.studioConfig.financial.currency).toLowerCase(),
      status: refund.status === 'succeeded' ? 'paid' : 'pending',
      providerMetadata: { stripeRefundId: refund.id },
    };
  },

  async handleWebhook(ctx, request) {
    const provider = ctx.studioConfig.paymentProviders.find((p) => p.provider === 'stripe');
    const secretKey = provider?.credentials?.secretKey;
    const webhookSecret = provider?.credentials?.webhookSecret;

    if (!secretKey || !webhookSecret) {
      return null;
    }

    const stripe = getStripeClient(ctx.studioConfig);
    const payload = await request.text();
    const signature = request.headers.get('stripe-signature') ?? '';

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch {
      return null;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        id: session.payment_intent as string,
        amountCents: session.amount_total ?? 0,
        currency: (session.currency ?? ctx.studioConfig.financial.currency).toLowerCase(),
        status: 'paid' as const,
        providerMetadata: {
          sessionId: session.id,
          paymentIntentId: session.payment_intent,
          metadata: session.metadata,
        },
      };
    }

    return null;
  },
};
