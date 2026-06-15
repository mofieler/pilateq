'use client';

import { useStudioConfig } from '../studio.config.provider';
import type { StudioBookingRulesConfig } from '../studio.config.schema';

/**
 * Access the configured booking rules (timezone, cancellation window, mercy uses, …).
 */
export function useBookingRules(): StudioBookingRulesConfig {
  const config = useStudioConfig();
  return config.bookingRules;
}

/**
 * Convenience hook for a single booking rule value.
 */
export function useBookingRule<K extends keyof StudioBookingRulesConfig>(
  key: K,
): StudioBookingRulesConfig[K] {
  const rules = useBookingRules();
  return rules[key];
}
