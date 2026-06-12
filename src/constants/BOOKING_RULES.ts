/**
 * Booking Rules Constants
 * Centralized configuration for business rules
 */

export const CANCELLATION_WINDOW_HOURS = 24;

/** Hard cutoff: cancellation is completely blocked within this many hours of class start.
 *  Users must contact admin directly. */
export const CANCELLATION_CUTOFF_HOURS = 3;

export const WAITLIST_ACCEPTANCE_WINDOW_MINUTES = 15;

export const MAX_BOOKINGS_PER_USER_PER_CLASS = 1;

export const MAX_WAITLIST_SIZE_PER_CLASS = 10;

export const CREDIT_EXPIRY_DAYS = 365;

// Replaces the lifetime FIRST_TIME_MERCY_AVAILABLE flag.
// Each user gets up to 3 "mercy" refunds per calendar month for cancellations
// inside the 24h window. Counter resets on the 1st of each month (Europe/Berlin).
export const MERCY_USES_PER_MONTH = 3;

export const STUDIO_TIMEZONE = 'Europe/Berlin';

/** Maximum number of classes that can run simultaneously in the studio.
 *  For a single-room studio, this is 1. Set higher if multi-room support is added. */
export const STUDIO_MAX_CONCURRENT_CLASSES = 1;

/** When true, the scheduling system enforces that only one class can run
 *  at any given time, regardless of instructor. This blocks creating or
 *  rescheduling a session if another non-cancelled session overlaps the slot. */
export const STUDIO_SINGLE_CLASS_MODE = true;

export const WELCOME_JOURNEY_OFFER_EXPIRY_HOURS = 48;
export const WELCOME_JOURNEY_EXPIRY_WARNING_WINDOW_HOURS = 2;
export const WELCOME_JOURNEY_URGENCY_SOON_HOURS = 24;
export const WELCOME_JOURNEY_URGENCY_CRITICAL_HOURS = 6;

export const WELCOME_JOURNEY_REQUEST_STATUS = {
  pending: 'pending',
  slotsOffered: 'slots_offered',
  rejected: 'rejected',
  expired: 'expired',
  booked: 'booked',
  attended: 'attended',
} as const;

// (Removed 2026-05-18) GROUP_FALLBACK_CLASS_TYPES — the fallback was a stopgap
// for the four-wallet system. With the unified 'pass' wallet, every group
// class draws from the same bucket, so no fallback set is needed. Cost is
// controlled by classTemplates.creditCost.
