'use client';

import { useStudioConfig } from '../studio.config.provider';
import type { AccessProvider } from '../studio.config.schema';

/**
 * Check whether an access provider (credit_system, classpass, gympass, …) is enabled.
 */
export function useAccessProvider(provider: AccessProvider): boolean {
  const config = useStudioConfig();
  return config.accessProviders.some((p) => p.provider === provider && p.enabled);
}

/**
 * All enabled access providers, ordered by priority (lower number = higher priority).
 */
export function useEnabledAccessProviders() {
  const config = useStudioConfig();
  return config.accessProviders
    .filter((p) => p.enabled)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Returns true if any external class-pass partner is enabled.
 */
export function useHasExternalAccessProviders(): boolean {
  const config = useStudioConfig();
  const external = new Set<AccessProvider>([
    'egym_wellpass',
    'urban_sports_club',
    'classpass',
    'gympass',
    'manual_class_pass',
  ]);
  return config.accessProviders.some((p) => external.has(p.provider) && p.enabled);
}
