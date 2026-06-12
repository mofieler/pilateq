import type { PaymentProviderPlugin } from '../types';

export const bankTransferPlugin: PaymentProviderPlugin = {
  key: 'bank_transfer',
  type: 'payment',
  displayName: 'Bank Transfer',
  description: 'Students transfer the amount to the studio bank account.',
  availableGlobally: true,

  isAvailable(config) {
    return config.paymentProviders.some((p) => p.provider === 'bank_transfer' && p.enabled);
  },

  async createPayment(ctx, input) {
    return {
      id: `bank-transfer-${Date.now()}`,
      amountCents: input.amountCents,
      currency: input.currency,
      status: 'pending' as const,
      providerMetadata: { requiresManualConfirmation: true },
    };
  },
};
