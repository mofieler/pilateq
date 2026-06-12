/**
 * Payment Orchestrator
 *
 * Centralizes all payment flows behind the plugin registry.
 * The credit-purchase API and future checkout flows should call this service
 * instead of hardcoding payment provider logic.
 *
 * Design goals:
 * - One place to add a new payment provider.
 * - Consistent error handling, audit logging, and idempotency.
 * - Provider-agnostic return type for the UI.
 */

import { getEnabledPaymentPlugins, getPluginByKey } from '@/lib/plugins';
import type { StudioConfig } from '@/lib/studio';
import { logSecurityEvent } from '@/lib/security/audit-logger';

export interface CreateCheckoutInput {
  userId: string;
  amountCents: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export type CheckoutResult =
  | { type: 'redirect'; redirectUrl: string; providerPaymentId: string }
  | { type: 'manual'; providerPaymentId: string; instructions: string }
  | { type: 'error'; message: string };

export class PaymentOrchestrator {
  constructor(private readonly studioConfig: StudioConfig) {}

  /**
   * List enabled payment providers for the current studio.
   */
  listProviders() {
    return getEnabledPaymentPlugins(this.studioConfig).map((plugin) => ({
      key: plugin.key,
      displayName: plugin.displayName,
      description: plugin.description,
      requiresOnlinePayment: plugin.key === 'stripe' || plugin.key === 'paypal',
      manualConfirmation: plugin.key === 'pay_at_studio' || plugin.key === 'bank_transfer' || plugin.key === 'cash',
    }));
  }

  /**
   * Start a checkout for the given provider.
   */
  async createCheckout(
    providerKey: string,
    input: CreateCheckoutInput
  ): Promise<CheckoutResult> {
    const plugin = getPluginByKey(providerKey);
    if (!plugin || plugin.type !== 'payment') {
      return { type: 'error', message: 'Unknown payment provider' };
    }

    if (!plugin.isAvailable(this.studioConfig)) {
      return { type: 'error', message: 'Payment provider is not available' };
    }

    await logSecurityEvent({
      userId: input.userId,
      action: 'INSERT',
      resource: 'payment_checkout',
      details: { provider: providerKey, amountCents: input.amountCents, currency: input.currency },
    });

    const result = await plugin.createPayment(
      {
        studioConfig: this.studioConfig,
        studioId: this.studioConfig.id ?? '',
        userId: input.userId,
      },
      {
        amountCents: input.amountCents,
        currency: input.currency,
        description: input.description,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        customerEmail: input.customerEmail,
        metadata: input.metadata,
      }
    );

    if (result.redirectUrl) {
      return {
        type: 'redirect',
        redirectUrl: result.redirectUrl,
        providerPaymentId: result.id,
      };
    }

    return {
      type: 'manual',
      providerPaymentId: result.id,
      instructions: 'Please complete payment at the studio or via bank transfer.',
    };
  }
}
