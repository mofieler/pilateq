/**
 * Server-side i18n
 *
 * Use `translate()` in Server Components, Server Actions, and API routes.
 * The locale is resolved from StudioConfig (with cookie/header fallback).
 *
 * Example:
 *   const t = await getTranslator();
 *   return <h1>{t('booking.title')}</h1>;
 */

import { cache } from 'react';
import { cookies } from 'next/headers';
import { loadMessages } from './messages';
import { resolveLocale, isSupportedLocale, LOCALE_COOKIE_NAME } from './config';
import type { Locale } from './types';
import { getStudioConfigContext } from '@/lib/studio/server';
import { interpolate, type InterpolationValues } from './interpolate';
import type { Messages } from './types';

// ---------------------------------------------------------------------------
// Translator function
// ---------------------------------------------------------------------------

export type Translator = (key: keyof Messages, values?: InterpolationValues) => string;

/**
 * Create a translator for the given locale.
 * This is synchronous once messages are loaded — safe for RSC render paths.
 */
export function createTranslator(locale: Locale): Translator {
  const messages = loadMessages(locale);

  return (key, values) => {
    const template = messages[key];
    if (!template) {
      // Fallback to English for missing keys (development safety)
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n] Missing key "${String(key)}" for locale "${locale}"`);
      }
      // Attempt English fallback
      try {
        const enMessages = loadMessages('en');
        const fallback = enMessages[key];
        if (fallback) return interpolate(fallback, values);
      } catch {
        // English not available — return the key itself
      }
      return String(key);
    }
    return interpolate(template, values);
  };
}

// ---------------------------------------------------------------------------
// Locale resolution for server contexts
// ---------------------------------------------------------------------------

export interface ServerLocaleContext {
  locale: Locale;
  translator: Translator;
}

/**
 * Resolve the active locale for the current request.
 * Priority:
 *   1. StudioConfig.defaultLocale
 *   2. Cookie preference
 *   3. Accept-Language header
 *   4. DEFAULT_LOCALE
 */
export async function resolveServerLocale(): Promise<Locale> {
  // 1. Studio config
  let studioLocale: Locale | undefined;
  try {
    const ctx = await getStudioConfigContext();
    if (ctx.config.defaultLocale && isSupportedLocale(ctx.config.defaultLocale)) {
      studioLocale = ctx.config.defaultLocale;
    }
  } catch {
    // Studio config not available (e.g. during build, or DB unreachable)
  }

  // 2. Cookie
  let cookieLocale: Locale | undefined;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
    if (raw && isSupportedLocale(raw)) {
      cookieLocale = raw;
    }
  } catch {
    // cookies() not available in all contexts
  }

  // 3. Accept-Language header
  let headerLocale: Locale | undefined;
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    const acceptLang = h.get('accept-language');
    if (acceptLang) {
      const preferred = acceptLang.split(',')[0]?.trim().split('-')[0];
      if (preferred && isSupportedLocale(preferred)) {
        headerLocale = preferred;
      }
    }
  } catch {
    // headers() not available
  }

  return resolveLocale({
    studioLocale,
    cookieLocale,
    headerLocale,
  });
}

// ---------------------------------------------------------------------------
// Cached translator for RSC
// ---------------------------------------------------------------------------

const buildTranslator = cache(async (): Promise<ServerLocaleContext> => {
  const locale = await resolveServerLocale();
  const translator = createTranslator(locale);
  return { locale, translator };
});

/**
 * Get the cached translator for the current request.
 * Safe to call from React Server Components and Server Actions.
 */
export async function getTranslator(): Promise<Translator> {
  const ctx = await buildTranslator();
  return ctx.translator;
}

/**
 * Get both the locale and translator.
 */
export async function getLocaleContext(): Promise<ServerLocaleContext> {
  return buildTranslator();
}
