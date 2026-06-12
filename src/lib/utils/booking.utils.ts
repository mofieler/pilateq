import { CANCELLATION_WINDOW_HOURS, CANCELLATION_CUTOFF_HOURS } from '@/constants/BOOKING_RULES';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

/**
 * Precise minutes remaining until a class starts.
 * Negative if the class has already started.
 */
export function minutesUntilStart(startsAt: Date, now: Date = new Date()): number {
  return (startsAt.getTime() - now.getTime()) / MS_PER_MINUTE;
}

/**
 * Precise hours remaining until a class starts, rounded down to the minute.
 * Negative if the class has already started.
 */
export function hoursUntilStart(startsAt: Date, now: Date = new Date()): number {
  return Math.floor((startsAt.getTime() - now.getTime()) / MS_PER_MINUTE) / 60;
}

/**
 * True when the class starts within the late-cancellation window
 * (currently < 24 hours from now).
 */
export function isWithinCancellationWindow(startsAt: Date, now: Date = new Date()): boolean {
  const msRemaining = startsAt.getTime() - now.getTime();
  return msRemaining > 0 && msRemaining < CANCELLATION_WINDOW_HOURS * MS_PER_HOUR;
}

/**
 * True when self-cancellation is completely blocked because the class
 * starts within the hard cutoff window (currently < 3 hours from now),
 * or has already started/passed.
 */
export function isSelfCancellationBlocked(startsAt: Date, now: Date = new Date()): boolean {
  const msRemaining = startsAt.getTime() - now.getTime();
  return msRemaining < CANCELLATION_CUTOFF_HOURS * MS_PER_HOUR;
}
