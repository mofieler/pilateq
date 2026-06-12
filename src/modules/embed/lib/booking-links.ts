import { format } from 'date-fns';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

/** Where embed clicks send users to log in and book (defaults to NEXT_PUBLIC_APP_URL). */
export function getEmbedBookingBaseUrl(): string {
  return APP_CONFIG.APP_URL.replace(/\/$/, '');
}

/**
 * Deep link: login first, then book page with the week containing this session pre-selected.
 */
export function buildEmbedSessionBookingUrl(startsAt: Date | string): string {
  const base = getEmbedBookingBaseUrl();
  const date =
    typeof startsAt === 'string'
      ? startsAt.slice(0, 10)
      : format(startsAt, 'yyyy-MM-dd');
  const callbackUrl = encodeURIComponent(`/book?date=${date}`);
  return `${base}/login?callbackUrl=${callbackUrl}`;
}

export function buildEmbedBookCtaUrl(): string {
  const base = getEmbedBookingBaseUrl();
  return `${base}/login?callbackUrl=${encodeURIComponent('/book')}`;
}
