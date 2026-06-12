import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { studios } from './studios.schema';

export const welcomeJourneyRequests = pgTable(
  'welcome_journey_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    userMessage: text('user_message'),
    offeredSessionIds: jsonb('offered_session_ids').$type<string[]>().default([]),
    preferredSlots: jsonb('preferred_slots').$type<string[]>().default([]),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    warningEmailSentAt: timestamp('warning_email_sent_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    studioIdIdx: index('welcome_journey_requests_studio_id_idx').on(table.studioId),
    userIdIdx: index('welcome_journey_requests_user_id_idx').on(table.userId),
    statusIdx: index('welcome_journey_requests_status_idx').on(table.status),
    // For cron sweeps: find pending requests that expired
    statusExpiresIdx: index('welcome_journey_requests_status_expires_idx').on(
      table.status,
      table.expiresAt,
    ),
  }),
);

