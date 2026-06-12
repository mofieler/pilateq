/**
 * i18n Server Actions
 *
 * `changeLocaleAction` — called when the user selects a different language.
 * Sets a cookie and revalidates the page so the server renders in the new locale.
 */

'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isSupportedLocale, LOCALE_COOKIE_NAME } from './config';
import type { Locale } from './types';

export async function changeLocaleAction(locale: string): Promise<{ success: boolean; locale: Locale }> {
  if (!isSupportedLocale(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 400,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  revalidatePath('/', 'layout');

  return { success: true, locale };
}
