'use client';

import { useStudioConfig } from '../studio.config.provider';
import type { FeatureVisibilityConfig } from '../studio.config.schema';

export type FeatureKey = keyof FeatureVisibilityConfig;

/**
 * Check whether a dashboard/feature flag is enabled for the current studio.
 * Falls back to true if the config key is missing so the UI stays permissive
 * when a studio has not explicitly toggled visibility.
 */
export function useStudioFeature(key: FeatureKey): boolean {
  const config = useStudioConfig();
  return config.featureVisibility?.[key] ?? true;
}
