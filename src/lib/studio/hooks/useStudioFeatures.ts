'use client';

import { useStudioConfig } from '../studio.config.provider';
import type { StudioFeaturesConfig } from '../studio.config.schema';

export type FeatureKey = keyof StudioFeaturesConfig;

/**
 * Check whether a studio-level feature (e.g. waitlist, duoBooking, googleCalendarSync)
 * is enabled. Defaults to true for unknown/missing keys so the UI stays permissive.
 */
export function useStudioFeatureFlag(key: FeatureKey): boolean {
  const config = useStudioConfig();
  return config.features?.[key] ?? true;
}

/**
 * Returns the whole studio features object.
 */
export function useStudioFeatures(): StudioFeaturesConfig {
  const config = useStudioConfig();
  return config.features;
}
