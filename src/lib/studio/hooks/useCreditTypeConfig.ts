'use client';

import { useMemo } from 'react';
import { useStudioConfig } from '../studio.config.provider';
import type { CreditType } from '@/lib/config/class-types';

/**
 * Returns the studio's override config for a given credit type.
 */
export function useCreditTypeConfig(creditType: CreditType) {
  const config = useStudioConfig();
  return config.creditTypes?.[creditType];
}

/**
 * Returns all credit types that are enabled in the studio config.
 */
export function useEnabledCreditTypes(): CreditType[] {
  const config = useStudioConfig();
  return useMemo(
    () =>
      (Object.keys(config.creditTypes ?? {}) as CreditType[]).filter(
        (key) => config.creditTypes?.[key]?.enabled !== false,
      ),
    [config.creditTypes],
  );
}

/**
 * Check whether a credit type is enabled.
 */
export function useIsCreditTypeEnabled(creditType: CreditType): boolean {
  const config = useCreditTypeConfig(creditType);
  return config?.enabled !== false;
}
