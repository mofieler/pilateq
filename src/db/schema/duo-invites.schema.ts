import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { duoInviteStatusEnum } from './enums';
import { users } from './users.schema';
import { classSessions } from './classes.schema';
import { bookings } from './bookings.schema';
import { studios } from './studios.schema';

export const duoInvites = pgTable(
  'duo_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    // [FIX-3] RESTRICT — organizer booking is a financial record
    organizerBookingId: uuid('organizer_booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'restrict' }),
    // [FIX-3] RESTRICT — financial/booking coordination record
    organizerUserId: uuid('organizer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => classSessions.id, { onDelete: 'restrict' }),
    // Unguessable random token — shared outside the app (WhatsApp, SMS, etc.)
    // Generated via: crypto.randomBytes(32).toString('hex')
    token: varchar('token', { length: 64 }).notNull(),
    status: duoInviteStatusEnum('status').notNull().default('pending'),
    // Set when partner accepts — nullable until then
    partnerBookingId: uuid('partner_booking_id')
      .references(() => bookings.id, { onDelete: 'set null' }),
    // [FIX-3] RESTRICT once set — partner's booking is a financial record
    partnerUserId: uuid('partner_user_id')
      .references(() => users.id, { onDelete: 'restrict' }),
    // [FIX-2] withTimezone: true — scheduling-critical timestamp
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Token must be globally unique — used as the public invite URL key
    studioIdIdx: index('duo_invites_studio_id_idx').on(table.studioId),
    tokenUniqueIdx: uniqueIndex('duo_invites_token_unique_idx').on(table.token),
    organizerBookingIdx: index('duo_invites_organizer_booking_idx').on(table.organizerBookingId),
    sessionIdx: index('duo_invites_session_idx').on(table.sessionId),
    // Sweep for expired pending invites
    statusExpiresIdx: index('duo_invites_status_expires_idx').on(table.status, table.expiresAt),
  }),
);
