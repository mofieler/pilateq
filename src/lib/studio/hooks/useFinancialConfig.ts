'use client';

import { useStudioConfig } from '../studio.config.provider';
import type { StudioFinancialConfig } from '../studio.config.schema';

/**
 * Access the configured financial settings (currency, tax rate, refund policy, …).
 */
export function useFinancialConfig(): StudioFinancialConfig {
  const config = useStudioConfig();
  return config.financial;
}

/**
 * Convenience hook for a single financial config value.
 */
export function useFinancialValue<K extends keyof StudioFinancialConfig>(
  key: K,
): StudioFinancialConfig[K] {
  const financial = useFinancialConfig();
  return financial[key];
}

/**
 * Format a price in cents using the studio's configured currency.
 */
export function useFormatPrice(): (cents: number, currency?: string) => string {
  const financial = useFinancialConfig();
  return (cents: number, currency?: string) =>
    new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: (currency ?? financial.currency).toUpperCase(),
    }).format(cents / 100);
}
