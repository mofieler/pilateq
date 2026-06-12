'use client';

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import type { StudioConfig } from './studio.config.schema';

const StudioConfigContext = createContext<StudioConfig | null>(null);

export interface StudioConfigProviderProps {
  children: ReactNode;
  config: StudioConfig;
}

/**
 * Provides the active StudioConfig to client components.
 * The root layout should fetch the config on the server and pass it down.
 */
export function StudioConfigProvider({ children, config }: StudioConfigProviderProps) {
  return (
    <StudioConfigContext.Provider value={config}>
      {children}
    </StudioConfigContext.Provider>
  );
}

/**
 * Hook to access StudioConfig in client components.
 * Throws if used outside of StudioConfigProvider.
 */
export function useStudioConfig(): StudioConfig {
  const ctx = useContext(StudioConfigContext);
  if (!ctx) {
    throw new Error('useStudioConfig must be used within a StudioConfigProvider');
  }
  return ctx;
}
