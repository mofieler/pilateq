'use client';

import { useStudioConfig } from '../studio.config.provider';
import type { BusinessModel } from '../studio.config.schema';

/**
 * Check if a specific business model is enabled for the current studio.
 */
export function useBusinessModel(model: BusinessModel): boolean {
  const config = useStudioConfig();
  return config.enabledBusinessModels.includes(model);
}

/**
 * Get the list of enabled business models.
 */
export function useEnabledBusinessModels(): BusinessModel[] {
  const config = useStudioConfig();
  return config.enabledBusinessModels;
}
