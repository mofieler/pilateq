/**
 * i18n Public API
 *
 * Import everything i18n-related from here.
 */

// Types
export type { Locale, Messages, MessageDomain } from './types';
export type { ClientTranslator } from './client';
export type { ServerLocaleContext, Translator } from './server';

// Config
export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  LOCALE_BCP47,
  LOCALE_CURRENCY,
  LOCALE_COOKIE_NAME,
  resolveLocale,
  isSupportedLocale,
  localeCookieValue,
} from './config';

// Server-side
export {
  createTranslator,
  resolveServerLocale,
  getTranslator,
  getLocaleContext,
} from './server';

// Client-side
export {
  useTranslator,
  useLocale,
  useI18nContext,
} from './client';

// Provider
export { I18nProvider, I18nContext } from './provider';
export type { I18nContextValue } from './provider';

// Messages
export { loadMessages, hasMessages, getAvailableLocales } from './messages';

// Interpolation
export { interpolate } from './interpolate';
export type { InterpolationValues } from './interpolate';

// Actions
export { changeLocaleAction } from './actions';
