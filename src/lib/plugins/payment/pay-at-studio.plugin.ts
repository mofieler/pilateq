/**
 * Pay-at-studio / bank transfer payment provider plugin.
 *
 * Maps to the existing manual confirmation flow. Students "purchase" and
 * pay later in person or by transfer; admins mark invoices as paid.
 */

import type { PaymentProviderPlugin } from '../types';

export const payAtStudioPlugin: PaymentProviderPlugin = {
  key: 'pay_at_studio',
  type: 'payment',
  displayName: 'Pay at Studio',
  description: 'Students pay in person at the studio or via bank transfer.',
  availableGlobally: true,

  isAvailable(config) {
    return config.paymentProviders.some((p) => p.provider === 'pay_at_studio' && p.enabled);
  },

  async createPayment(ctx, input) {
    return {
      id: `pay-at-studio-${Date.now()}`,
      amountCents: input.amountCents,
      currency: input.currency,
      status: 'pending' as const,
      providerMetadata: { requiresManualConfirmation: true },
    };
  },
};
