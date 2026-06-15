'use client';

import { useStudioConfig } from '../studio.config.provider';
import type { StudioBrandingConfig } from '../studio.config.schema';

/**
 * Access studio branding (primary color, logo, app name).
 */
export function useStudioBranding(): StudioBrandingConfig {
  const config = useStudioConfig();
  return config.branding;
}

/**
 * Convenience hook: returns the effective app name.
 */
export function useAppName(): string {
  const config = useStudioConfig();
  return config.branding.appName ?? config.identity.name ?? 'PilatesOS';
}

/**
 * Convenience hook: returns the primary brand color.
 */
export function usePrimaryColor(): string {
  const branding = useStudioBranding();
  return branding.primaryColor ?? '#4e2b22';
}
