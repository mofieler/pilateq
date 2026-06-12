/**
 * I18n React Provider
 *
 * Wraps the app tree and provides the active locale + messages to all
 * Client Components via React Context.
 *
 * In the root layout, use <I18nProvider> inside <StudioConfigProvider>
 * so that the studio's default locale is available during initialization.
 */

'use client';

import React, { createContext, useMemo } from 'react';
import type { Messages, Locale } from './types';

export interface I18nContextValue {
  locale: Locale;
  messages: Messages;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}

export function I18nProvider({ locale, messages, children }: I18nProviderProps) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
