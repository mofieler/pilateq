'use client';

import { useMemo } from 'react';
import { useStudioConfig } from '../studio.config.provider';
import type { ClassType } from '@/lib/config/class-types';

/**
 * Returns the studio's override config for a given class type, or undefined if none.
 */
export function useClassTypeConfig(classType: ClassType) {
  const config = useStudioConfig();
  return config.classTypes?.[classType];
}

/**
 * Returns all class types that are enabled in the studio config.
 */
export function useEnabledClassTypes(): ClassType[] {
  const config = useStudioConfig();
  return useMemo(
    () =>
      (Object.keys(config.classTypes ?? {}) as ClassType[]).filter(
        (key) => config.classTypes?.[key]?.enabled !== false,
      ),
    [config.classTypes],
  );
}

/**
 * Check whether a class type is enabled.
 */
export function useIsClassTypeEnabled(classType: ClassType): boolean {
  const config = useClassTypeConfig(classType);
  return config?.enabled !== false;
}
