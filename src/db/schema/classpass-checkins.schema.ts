import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { classSessions } from './classes.schema';
import { studios } from './studios.schema';

/**
 * Class pass partner check-ins.
 *
 * When a student books via an external partner (Wellpass, Urban Sports Club,
 * ClassPass, etc.), a check-in record is created. The studio can reconcile these
 * against partner reports.
 */
export const classPassCheckins = pgTable(
  'class_pass_checkins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => classSessions.id, { onDelete: 'restrict' }),
    providerKey: varchar('provider_key', { length: 63 }).notNull(),
    /** pending = created but not confirmed; confirmed = spot reserved; reconciled = partner paid; rejected = not accepted. */
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true, mode: 'date' }),
    notes: varchar('notes', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    studioIdIdx: index('class_pass_checkins_studio_id_idx').on(table.studioId),
    userIdIdx: index('class_pass_checkins_user_id_idx').on(table.userId),
    sessionIdIdx: index('class_pass_checkins_session_id_idx').on(table.sessionId),
    providerIdx: index('class_pass_checkins_provider_idx').on(table.providerKey),
    statusIdx: index('class_pass_checkins_status_idx').on(table.status),
  }),
);

import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
export type ClassPassCheckin = InferSelectModel<typeof classPassCheckins>;
export type NewClassPassCheckin = InferInsertModel<typeof classPassCheckins>;
