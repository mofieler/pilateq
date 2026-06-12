import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { instructors } from './instructors.schema';
import { studios } from './studios.schema';

// Stores per-user Google Calendar OAuth tokens + selected calendar.
// One row per user — a user reconnects rather than creating a second row.
// Tokens are AES-256-GCM encrypted at rest (see src/lib/calendar/token-crypto.ts).
//
// [FIX-3] userId references users with RESTRICT — a user with an active calendar
// connection must not be hard-deleted. Soft-delete (deletedAt) on users is fine;
// the connection row is then ignored by sync because we filter joined users for
// isNull(deletedAt) before pulling/pushing.
export const calendarConnections = pgTable(
  'calendar_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    provider: varchar('provider', { length: 32 }).notNull().default('google'),

    googleAccountEmail: varchar('google_account_email', { length: 255 }).notNull(),

    // Encrypted token blobs ("iv:tag:ciphertext" base64).
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    // [FIX-2] withTimezone: true
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true, mode: 'date' }).notNull(),

    // Null until the user picks one of their accessible calendars.
    selectedCalendarId: text('selected_calendar_id'),
    selectedCalendarName: varchar('selected_calendar_name', { length: 255 }),

    syncEnabled: boolean('sync_enabled').notNull().default(true),

    // [FIX-2] withTimezone: true
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true, mode: 'date' }),
    lastSyncError: text('last_sync_error'),
    // Google's opaque syncToken — pass back for incremental sync.
    lastPullSyncToken: text('last_pull_sync_token'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    studioUserUnique: uniqueIndex('calendar_connections_studio_user_unique').on(table.studioId, table.userId),
    syncEnabledIdx: index('calendar_connections_sync_enabled_idx').on(table.syncEnabled),
  }),
);

// Mirrors external Google Calendar events that block instructor availability.
// Populated by the pull-sync worker. NOT financial — cascade on connection delete is safe.
//
// [FIX-3] connectionId cascades — when a user disconnects, their blocks are irrelevant.
// instructorId is SET NULL — block survives if the instructor record is deleted,
// since startsAt/endsAt may still inform admin reporting.
export const externalCalendarBlocks = pgTable(
  'external_calendar_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => calendarConnections.id, { onDelete: 'cascade' }),
    instructorId: uuid('instructor_id').references(() => instructors.id, { onDelete: 'set null' }),

    googleEventId: text('google_event_id').notNull(),
    summary: varchar('summary', { length: 500 }),

    // [FIX-2] withTimezone: true
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    eventUnique: uniqueIndex('external_blocks_event_unique').on(
      table.studioId,
      table.connectionId,
      table.googleEventId,
    ),
    timeIdx: index('external_blocks_time_idx').on(table.startsAt, table.endsAt),
    instructorIdx: index('external_blocks_instructor_idx').on(table.instructorId),
  }),
);
