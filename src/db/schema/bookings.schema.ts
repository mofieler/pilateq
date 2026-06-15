import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { bookingStatusEnum, cancellationTypeEnum, creditTypeEnum } from './enums';
import { users } from './users.schema';
import { classSessions } from './classes.schema';
import { studios } from './studios.schema';

// ---------------------------------------------------------------------------
// Access grant stored on the booking row.
//
// Phase 4 decouples bookings from the credit ledger. The grant records which
// access provider covered the class and the provider-specific reference needed
// to release the entitlement on cancellation.
// ---------------------------------------------------------------------------

export interface BookingAccessGrant {
  /** Provider-specific grant id (credit transaction id, check-in id, etc.). */
  grantId: string;
  /** Provider key that issued the grant. */
  provider: string;
  /** Human-readable label for receipts and admin UI. */
  label: string;
  /** Number of entitlements consumed (usually 1 for a class). */
  quantityConsumed: number;
  /** Provider-specific metadata to support refunds/cancellation. */
  metadata?: Record<string, unknown>;
}

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    // [FIX-3] RESTRICT — booking records are financial. Silent deletion via user cascade is prohibited.
    // Use soft-delete on users; this FK blocks any hard-delete attempt at the DB level.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // SET NULL — when a cancelled session is hard-deleted, booking records survive
    // with sessionId = NULL. The credit_transactions table is the authoritative audit trail.
    sessionId: uuid('session_id')
      .references(() => classSessions.id, { onDelete: 'set null' }),
    status: bookingStatusEnum('status').notNull().default('confirmed'),
    cancellationType: cancellationTypeEnum('cancellation_type'),
    mercyApplied: boolean('mercy_applied').notNull().default(false),
    creditsSpent: integer('credits_spent').notNull(),
    creditType: creditTypeEnum('credit_type').notNull(),

    // Phase 4 — Access Entitlement Service
    accessProvider: varchar('access_provider', { length: 40 }),
    accessGrant: jsonb('access_grant').$type<BookingAccessGrant | null>(),

    // [FIX-2] withTimezone: true
    bookedAt: timestamp('booked_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
    cancellationReason: text('cancellation_reason'),

    // Optimistic locking — prevents concurrent cancellation/booking races.
    version: integer('version').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // One booking per user per session (scoped to studio)
    uniqueBooking: uniqueIndex('bookings_studio_user_session_unique_idx').on(table.studioId, table.userId, table.sessionId),
    studioIdIdx: index('bookings_studio_id_idx').on(table.studioId),
    userIdIdx: index('bookings_user_id_idx').on(table.userId),
    sessionIdIdx: index('bookings_session_id_idx').on(table.sessionId),
    statusIdx: index('bookings_status_idx').on(table.status),
    // Tenant-scoped status lookups for studio dashboards
    studioStatusIdx: index('bookings_studio_status_idx').on(table.studioId, table.status),
    // For dashboard queries: "my upcoming confirmed bookings"
    userStatusIdx: index('bookings_user_status_idx').on(table.userId, table.status),
    // Composite for session student lookups
    sessionStatusIdx: index('bookings_session_status_idx').on(table.sessionId, table.status),
    // For statistics aggregation by status + time range
    statusCreatedAtIdx: index('bookings_status_created_at_idx').on(table.status, table.createdAt),
    // For ordering students by booking time
    bookedAtIdx: index('bookings_booked_at_idx').on(table.bookedAt),
    // For lookups by access provider during reconciliation
    accessProviderIdx: index('bookings_access_provider_idx').on(table.accessProvider),
    creditsSpentPositive: check('bookings_credits_spent_positive', sql`${table.creditsSpent} > 0`),
    versionNonNeg: check('bookings_version_nonneg', sql`${table.version} >= 0`),
  }),
);
