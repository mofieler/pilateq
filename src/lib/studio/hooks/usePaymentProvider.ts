'use client';

import { useStudioConfig } from '../studio.config.provider';
import type { PaymentProvider } from '../studio.config.schema';

/**
 * Check whether a payment provider is enabled for the current studio.
 */
export function usePaymentProvider(provider: PaymentProvider): boolean {
  const config = useStudioConfig();
  return config.paymentProviders.some((p) => p.provider === provider && p.enabled);
}

/**
 * Get the enabled payment providers, sorted with the primary provider first.
 */
export function useEnabledPaymentProviders() {
  const config = useStudioConfig();
  return config.paymentProviders
    .filter((p) => p.enabled)
    .sort((a, b) => (a.isPrimary ? -1 : 0) - (b.isPrimary ? -1 : 0));
}

/**
 * Get the configured default payment provider key.
 */
export function useDefaultPaymentProvider(): PaymentProvider {
  const config = useStudioConfig();
  return config.paymentOptions.defaultPaymentProvider;
}
