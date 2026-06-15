'use client';

import { useStudioConfig } from '../studio.config.provider';
import type { StudioIdentityConfig } from '../studio.config.schema';

/**
 * Access studio identity data (name, address, contact, tax info, …).
 */
export function useStudioIdentity(): StudioIdentityConfig {
  const config = useStudioConfig();
  return config.identity;
}
