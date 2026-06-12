/**
 * Client-side i18n
 *
 * Use `useTranslator()` in Client Components.
 * Reads the locale from the React Context provided by <I18nProvider>.
 *
 * Example:
 *   const t = useTranslator();
 *   return <button>{t('action.save')}</button>;
 */

'use client';

import { useContext, useCallback } from 'react';
import { I18nContext } from './provider';
import { interpolate, type InterpolationValues } from './interpolate';
import type { Messages, Locale } from './types';

export type ClientTranslator = (key: keyof Messages, values?: InterpolationValues) => string;

export function useTranslator(): ClientTranslator {
  const ctx = useContext(I18nContext);

  return useCallback(
    (key, values) => {
      const messages = ctx?.messages;
      if (!messages) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[i18n] useTranslator called outside I18nProvider');
        }
        return String(key);
      }

      const template = messages[key];
      if (!template) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[i18n] Missing key "${String(key)}" for locale "${ctx.locale}"`);
        }
        return String(key);
      }

      return interpolate(template, values);
    },
    [ctx?.messages, ctx?.locale],
  );
}

export function useLocale(): Locale {
  const ctx = useContext(I18nContext);
  return ctx?.locale ?? 'en';
}

export function useI18nContext() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('[i18n] useI18nContext must be used within <I18nProvider>');
  }
  return ctx;
}
