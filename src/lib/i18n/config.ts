/**
 * i18n Configuration
 *
 * THE ONE FILE to change when modifying locale behavior:
 *   - Add/remove supported languages
 *   - Change fallback rules
 *   - Adjust locale detection priority
 *
 * This config is intentionally separate from runtime StudioConfig so that
 * the i18n engine itself has no dependency on the DB. Studio-specific
 * overrides (e.g. a studio that only supports 'de') are applied at the
 * consumer layer, not here.
 */

import type { Locale } from './types';

// ---------------------------------------------------------------------------
// Core settings
// ---------------------------------------------------------------------------

/** Languages the app can render. Add a new locale here + one translation file. */
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'de', 'es'] as const;

/** Fallback chain: if a key is missing in the requested locale, try these in order. */
export const LOCALE_FALLBACKS: Readonly<Record<Locale, Locale>> = {
  en: 'en',
  de: 'en', // German falls back to English
  es: 'en', // Spanish falls back to English
  fr: 'en', // French falls back to English
  it: 'en', // Italian falls back to English
  nl: 'en', // Dutch falls back to English
} as const;

/** Default when no locale can be detected. */
export const DEFAULT_LOCALE: Locale = 'en';

/** Human-readable labels for the language switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  nl: 'Nederlands',
};

/** BCP 47 tags for Intl.DateTimeFormat / Intl.NumberFormat. */
export const LOCALE_BCP47: Record<Locale, string> = {
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
  it: 'it-IT',
  nl: 'nl-NL',
};

/** Currency defaults per locale (ISO 4217). */
export const LOCALE_CURRENCY: Record<Locale, string> = {
  en: 'USD',
  de: 'EUR',
  es: 'EUR',
  fr: 'EUR',
  it: 'EUR',
  nl: 'EUR',
};

// ---------------------------------------------------------------------------
// Detection priority
// ---------------------------------------------------------------------------

export interface LocaleDetectionOptions {
  /** Studio-configured default (from StudioConfig.defaultLocale). */
  studioLocale?: Locale;
  /** User preference stored in cookie. */
  cookieLocale?: Locale;
  /** Accept-Language header. */
  headerLocale?: Locale;
  /** Explicit override (e.g. query param ?locale=de). */
  explicitLocale?: Locale;
}

/**
 * Resolve the effective locale using the following priority:
 *   1. Explicit override (query param, user click)
 *   2. User cookie preference
 *   3. Accept-Language header (first match in SUPPORTED_LOCALES)
 *   4. Studio-configured default
 *   5. Global DEFAULT_LOCALE
 */
export function resolveLocale(options: LocaleDetectionOptions): Locale {
  if (options.explicitLocale && isSupportedLocale(options.explicitLocale)) {
    return options.explicitLocale;
  }
  if (options.cookieLocale && isSupportedLocale(options.cookieLocale)) {
    return options.cookieLocale;
  }
  if (options.headerLocale && isSupportedLocale(options.headerLocale)) {
    return options.headerLocale;
  }
  if (options.studioLocale && isSupportedLocale(options.studioLocale)) {
    return options.studioLocale;
  }
  return DEFAULT_LOCALE;
}

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Cookie / storage helpers
// ---------------------------------------------------------------------------

export const LOCALE_COOKIE_NAME = 'pilatesos_locale';

export function localeCookieValue(locale: Locale): string {
  // 400 days = max cookie lifetime per RFC
  return `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=34560000; SameSite=Lax; Secure`;
}
