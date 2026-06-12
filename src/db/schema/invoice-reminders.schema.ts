import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { invoiceReminderTypeEnum } from './enums';
import { users } from './users.schema';
import { creditPurchases } from './credits.schema';
import { studios } from './studios.schema';

// Immutable audit trail for every invoice email triggered by admin.
// Never update rows — only insert. Follows the §147 AO pattern used in creditAdjustments.
export const invoiceReminders = pgTable(
  'invoice_reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    // [FIX-3] RESTRICT — invoice reminder is a financial audit record
    purchaseId: uuid('purchase_id')
      .notNull()
      .references(() => creditPurchases.id, { onDelete: 'restrict' }),
    // SET NULL — record survives admin account removal
    sentByAdminId: uuid('sent_by_admin_id')
      .references(() => users.id, { onDelete: 'set null' }),
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 500 }).notNull(),
    customMessage: text('custom_message'),
    reminderType: invoiceReminderTypeEnum('reminder_type').notNull(),
    deliveryStatus: varchar('delivery_status', { length: 20 }).notNull().default('sent'),
    resendMessageId: varchar('resend_message_id', { length: 255 }),
    // [FIX-2] withTimezone: true — immutable audit timestamp
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    studioIdIdx: index('invoice_reminders_studio_id_idx').on(table.studioId),
    purchaseIdIdx: index('invoice_reminders_purchase_id_idx').on(table.purchaseId),
    sentByAdminIdx: index('invoice_reminders_sent_by_admin_idx').on(table.sentByAdminId),
    // Cron sweep: find purchases with no reminder in last N days
    purchaseCreatedAtIdx: index('invoice_reminders_purchase_created_at_idx').on(
      table.purchaseId,
      table.createdAt,
    ),
  }),
);
