import type { PaymentProviderPlugin } from '../types';

export const cashPlugin: PaymentProviderPlugin = {
  key: 'cash',
  type: 'payment',
  displayName: 'Cash',
  description: 'Students pay with cash at the studio.',
  availableGlobally: true,

  isAvailable(config) {
    return config.paymentProviders.some((p) => p.provider === 'cash' && p.enabled);
  },

  async createPayment(ctx, input) {
    return {
      id: `cash-${Date.now()}`,
      amountCents: input.amountCents,
      currency: input.currency,
      status: 'pending' as const,
      providerMetadata: { requiresManualConfirmation: true },
    };
  },
};
