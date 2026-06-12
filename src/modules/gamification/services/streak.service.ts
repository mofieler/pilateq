/**
 * Smart Streak Calculation Service
 *
 * Instead of rigid calendar-week counting, this streak adapts to each user's
 * personal rhythm. We detect their median interval between classes and grant a
 * generous grace period (1.5× their rhythm, min 7 days, max 14 days).
 *
 * A streak stays alive as long as the gap between any two consecutive attended
 * classes is within the grace period. The streak number counts the distinct
 * calendar weeks (Mon–Sun) covered by that chain.
 *
 * This feels fair for Pilates clients who typically come 1–3× per week but
 * occasionally miss a week due to travel, illness, or life.
 */

import { db } from '@/db';
import { bookings, classSessions } from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { startOfWeek, differenceInCalendarDays, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { STUDIO_TIMEZONE } from '@/constants/BOOKING_RULES';
import { toZonedTime } from 'date-fns-tz';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  lastAttendedWeek: Date | null;
  weeklyBreakdown: Array<{
    weekStart: Date;
    weekLabel: string;
    attended: boolean;
    classCount: number;
  }>;
  /** Median days between classes from user's history (default 7). */
  personalRhythmDays: number;
  /** How many days of grace the user gets (7–14). */
  graceDays: number;
  /** Days since the most recent attended class (null if never). */
  daysSinceLastClass: number | null;
  /** How many days left before streak breaks (null if already broken or no history). */
  graceRemaining: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  return startOfWeek(date, { locale: de });
}

function formatWeekLabel(monday: Date): string {
  return format(monday, 'd');
}

function median(values: number[]): number {
  if (values.length === 0) return 7;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function computeGraceDays(personalRhythmDays: number): number {
  return Math.min(Math.max(Math.round(personalRhythmDays * 1.5), 7), 14);
}

function buildRecentChain(
  classes: Date[],
  graceDays: number,
): Date[] {
  if (classes.length === 0) return [];
  const sorted = [...classes].sort((a, b) => b.getTime() - a.getTime());
  const chain: Date[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const gap = differenceInCalendarDays(chain[chain.length - 1], sorted[i]);
    if (gap <= graceDays) {
      chain.push(sorted[i]);
    } else {
      break;
    }
  }
  return chain;
}

function buildLongestChain(classes: Date[], graceDays: number): Date[] {
  if (classes.length === 0) return [];
  const sorted = [...classes].sort((a, b) => a.getTime() - b.getTime());
  let best: Date[] = [];
  let current: Date[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (
      current.length === 0 ||
      differenceInCalendarDays(sorted[i], current[current.length - 1]) <= graceDays
    ) {
      current.push(sorted[i]);
    } else {
      if (current.length > best.length) best = current;
      current = [sorted[i]];
    }
  }
  if (current.length > best.length) best = current;

  return best;
}

function countDistinctWeeks(dates: Date[]): number {
  const weeks = new Set<string>();
  for (const d of dates) weeks.add(getMonday(d).toISOString());
  return weeks.size;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getUserStreak(userId: string): Promise<StreakResult> {
  const now = new Date();
  const studioNow = toZonedTime(now, STUDIO_TIMEZONE);
  const currentWeekMonday = getMonday(studioNow);

  // Look back 52 weeks max for performance
  const earliestMonday = new Date(
    currentWeekMonday.getTime() - 52 * 7 * 24 * 60 * 60 * 1000,
  );

  // Fetch all attended bookings in the last 52 weeks
  const rows = await db
    .select({ startsAt: classSessions.startsAt })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .where(
      and(
        eq(bookings.userId, userId),
        eq(bookings.status, 'attended'),
        gte(classSessions.startsAt, earliestMonday),
      ),
    );

  const dates = rows.map((r) => new Date(r.startsAt)).sort((a, b) => a.getTime() - b.getTime());

  // Personal rhythm: median gap between consecutive classes (need ≥3 classes for a reliable signal)
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    gaps.push(differenceInCalendarDays(dates[i], dates[i - 1]));
  }
  const personalRhythmDays = dates.length >= 3 ? median(gaps) : 7;
  const graceDays = computeGraceDays(personalRhythmDays);

  // Build the current streak chain (from most recent backward)
  const recentChain = buildRecentChain(dates, graceDays);
  const currentStreak = countDistinctWeeks(recentChain);

  // Build the longest streak chain (any point in history)
  const longestChain = buildLongestChain(dates, graceDays);
  const longestStreak = countDistinctWeeks(longestChain);

  // Days since last class & grace remaining
  const mostRecentDate = dates.length > 0 ? dates[dates.length - 1] : null;
  const daysSinceLastClass = mostRecentDate
    ? differenceInCalendarDays(studioNow, mostRecentDate)
    : null;

  let graceRemaining: number | null = null;
  if (daysSinceLastClass !== null) {
    const remaining = graceDays - daysSinceLastClass;
    graceRemaining = remaining > 0 ? remaining : 0;
  }

  // Last attended week
  const lastAttendedWeek = mostRecentDate ? getMonday(mostRecentDate) : null;

  // Weekly breakdown for the sparkline (last 8 calendar weeks)
  const weekCounts = new Map<string, number>();
  for (const d of dates) {
    const monday = getMonday(d);
    const key = monday.toISOString();
    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
  }

  const weeklyBreakdown: StreakResult['weeklyBreakdown'] = [];
  for (let i = 7; i >= 0; i--) {
    const monday = new Date(
      currentWeekMonday.getTime() - i * 7 * 24 * 60 * 60 * 1000,
    );
    const key = monday.toISOString();
    const count = weekCounts.get(key) ?? 0;
    weeklyBreakdown.push({
      weekStart: monday,
      weekLabel: formatWeekLabel(monday),
      attended: count > 0,
      classCount: count,
    });
  }

  return {
    currentStreak,
    longestStreak,
    lastAttendedWeek,
    weeklyBreakdown,
    personalRhythmDays,
    graceDays,
    daysSinceLastClass,
    graceRemaining,
  };
}
