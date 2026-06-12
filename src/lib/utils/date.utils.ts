import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { STUDIO_TIMEZONE } from '@/constants/BOOKING_RULES';

const STUDIO_TZ = STUDIO_TIMEZONE;

// ─── Safe date coercion (defensive against JSON-serialised strings & nulls) ───

function toSafeDate(input: unknown): Date | null {
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === 'string') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ─── Studio-timezone-aware formatters (deterministic on SSR + client) ──────────

/**
 * Format a Date in the studio's timezone with a date-fns pattern.
 * Use this anywhere a class time/date is rendered. Never use `format()` from
 * date-fns directly on DB timestamps — that uses the process timezone (UTC in
 * the Coolify container) and produces 14:30 instead of 16:30.
 *
 * Accepts Date, ISO string, or timestamp number to survive unstable_cache
 * JSON round-trips.
 */
export function formatStudio(input: unknown, pattern: string): string {
  const d = toSafeDate(input);
  if (!d) return '—';
  return formatInTimeZone(d, STUDIO_TZ, pattern);
}

export function formatStudioDate(input: unknown): string {
  const d = toSafeDate(input);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: STUDIO_TZ,
  });
}

export function formatStudioTime(input: unknown): string {
  const d = toSafeDate(input);
  if (!d) return '—';
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
    timeZone: STUDIO_TZ,
  });
}

export function formatStudioDateShort(input: unknown): string {
  const d = toSafeDate(input);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    timeZone: STUDIO_TZ,
  });
}

export function formatStudioDateWeekday(input: unknown): string {
  const d = toSafeDate(input);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: STUDIO_TZ,
  });
}

// Returns the Y-M-D string for `d` as observed in the studio's timezone.
// Used to compare calendar days across timezones without going through Date math.
export function studioYmd(input: unknown): string {
  const d = toSafeDate(input);
  if (!d) return '1970-01-01';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: STUDIO_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${day}`;
}

/** Start of the current studio day as a UTC Date. */
export function startOfStudioDay(now: Date = new Date()): Date {
  const ymd = studioYmd(now);
  return fromZonedTime(`${ymd}T00:00:00`, STUDIO_TZ);
}

/** True if `a` and `b` are the same calendar day in the studio timezone. */
export function isStudioSameDay(a: unknown, b: unknown): boolean {
  return studioYmd(a) === studioYmd(b);
}

/** True if `d` is today in the studio timezone. */
export function isStudioToday(d: unknown, now: Date = new Date()): boolean {
  return studioYmd(d) === studioYmd(now);
}

/** True if `d` falls in the current studio calendar week (Mon-Sun). */
export function isStudioThisWeek(d: unknown, now: Date = new Date()): boolean {
  return studioMondayYmd(d) === studioMondayYmd(now);
}

function studioMondayYmd(d: unknown): string {
  const safe = toSafeDate(d);
  if (!safe) return '1970-01-01';
  let currentDate = fromZonedTime(`${studioYmd(safe)}T12:00:00`, STUDIO_TZ);
  let dow = parseInt(formatInTimeZone(currentDate, STUDIO_TZ, 'i'), 10); // 1=Mon
  while (dow !== 1) {
    currentDate.setUTCDate(currentDate.getUTCDate() - 1);
    dow = parseInt(formatInTimeZone(currentDate, STUDIO_TZ, 'i'), 10);
  }
  return studioYmd(currentDate);
}

// "Today" / "Tomorrow" / weekday+date label evaluated in the studio's timezone.
export function formatStudioRelativeDay(d: unknown, now: Date = new Date()): string {
  const safe = toSafeDate(d);
  if (!safe) return '—';
  const target = studioYmd(safe);
  const today = studioYmd(now);
  const tomorrow = studioYmd(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (target === today) return 'Today';
  if (target === tomorrow) return 'Tomorrow';
  return safe.toLocaleDateString('en-GB', {
    weekday: 'long', month: 'long', day: 'numeric',
    timeZone: STUDIO_TZ,
  });
}
