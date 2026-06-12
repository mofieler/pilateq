import { pgTable, uuid, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { waitlistStatusEnum } from './enums';
import { users } from './users.schema';
import { classSessions } from './classes.schema';
import { studios } from './studios.schema';

export const waitlistEntries = pgTable(
  'waitlist_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    // [FIX-3] RESTRICT — waitlist entries are operational records that must be explicitly
    // resolved (cancelled, promoted, expired) before any user deletion can proceed.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // [FIX-3] RESTRICT — the cancelSessionByInstructor flow must explicitly cancel
    // waitlist entries; silent cascade would skip the refund / notification logic.
    sessionId: uuid('session_id')
      .notNull()
      .references(() => classSessions.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    status: waitlistStatusEnum('status').notNull().default('waiting'),
    // [FIX-2] withTimezone: true — offer window timing must be unambiguous
    offeredAt: timestamp('offered_at', { withTimezone: true, mode: 'date' }),
    offerExpiresAt: timestamp('offer_expires_at', { withTimezone: true, mode: 'date' }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // One waitlist entry per user per session
    uniqueEntry: uniqueIndex('waitlist_studio_user_session_unique_idx').on(table.studioId, table.userId, table.sessionId),
    // For FIFO promotion queries: ORDER BY position WHERE session = X AND status = 'waiting'
    studioIdIdx: index('waitlist_studio_id_idx').on(table.studioId),
    sessionPositionIdx: index('waitlist_session_position_idx').on(table.sessionId, table.position),
    statusIdx: index('waitlist_status_idx').on(table.status),
    // For the BullMQ promotion worker: find waiting entries for a session, ordered by position
    promotionIdx: index('waitlist_promotion_idx').on(
      table.sessionId,
      table.status,
      table.position,
    ),
  }),
);
