/**
 * Language Switcher
 *
 * Highend boutique UI — minimal, clean, no emojis.
 * Uses Lucide icons and a simple dropdown for locale selection.
 */

'use client';

import { useState, useTransition } from 'react';
import { Globe, Check } from 'lucide-react';
import { changeLocaleAction } from '@/lib/i18n';
import { LOCALE_LABELS, SUPPORTED_LOCALES } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

interface LanguageSwitcherProps {
  currentLocale: Locale;
  variant?: 'minimal' | 'full';
}

export function LanguageSwitcher({ currentLocale, variant = 'minimal' }: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>(currentLocale);
  const [isPending, startTransition] = useTransition();

  async function handleSelect(newLocale: Locale) {
    if (newLocale === locale) {
      setIsOpen(false);
      return;
    }

    startTransition(async () => {
      await changeLocaleAction(newLocale);
      setLocale(newLocale);
      setIsOpen(false);
      // Force a full reload so the server renders the new locale
      window.location.reload();
    });
  }

  if (SUPPORTED_LOCALES.length <= 1) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#4e2b22] hover:bg-[#f5f0ec] transition-colors disabled:opacity-50"
        aria-label="Change language"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe className="w-4 h-4" />
        {variant === 'full' && <span>{LOCALE_LABELS[locale]}</span>}
        <span className="text-xs uppercase tracking-wider">{locale}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <ul
            className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-[#e8ddd4] py-1 z-50 overflow-hidden"
            role="listbox"
            aria-label="Select language"
          >
            {SUPPORTED_LOCALES.map((loc) => (
              <li key={loc}>
                <button
                  onClick={() => handleSelect(loc)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                    loc === locale
                      ? 'bg-[#faf7f4] text-[#4e2b22] font-medium'
                      : 'text-[#5a4a42] hover:bg-[#f5f0ec]'
                  }`}
                  role="option"
                  aria-selected={loc === locale}
                >
                  <span>{LOCALE_LABELS[loc]}</span>
                  {loc === locale && <Check className="w-4 h-4 text-[#4e2b22]" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
