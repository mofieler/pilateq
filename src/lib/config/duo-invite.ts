/**
 * Duo invite configuration — single source of truth for invite
 * expiry logic and business rules.
 */

/** Invites expire at most this many hours before the class starts. */
export const DUO_INVITE_CUTOFF_HOURS_BEFORE_CLASS = 2;

/** Invites never last longer than this many hours from creation. */
export const DUO_INVITE_MAX_LIFETIME_HOURS = 48;
