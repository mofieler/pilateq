/**
 * Message Loader
 *
 * THE ONE FILE to change when adding a new language:
 *   1. Create `src/lib/i18n/messages/{locale}.ts`
 *   2. Import it here and add to the registry.
 *   3. Add the locale to `SUPPORTED_LOCALES` in `config.ts`.
 */

import type { Locale, Messages } from '../types';
import en from './en';
import de from './de';
import es from './es';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const messageRegistry: Record<Locale, Messages> = {
  en,
  de,
  es,
  fr: en,
  it: en,
  nl: en,
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export function loadMessages(locale: Locale): Messages {
  const messages = messageRegistry[locale];
  if (!messages) {
    throw new Error(`[i18n] Messages for locale "${locale}" not found. Did you register it in messages/index.ts?`);
  }
  return messages;
}

export function hasMessages(locale: string): locale is Locale {
  return locale in messageRegistry;
}

export function getAvailableLocales(): Locale[] {
  return Object.keys(messageRegistry) as Locale[];
}
