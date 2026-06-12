import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.schema';
import { studios } from './studios.schema';

/**
 * audit_logs — Application-level audit trail for security, financial and admin events.
 *
 * Captures who did what, to which resource, when, and whether it succeeded.
 * This table is append-only — application code must never UPDATE or DELETE rows.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Multi-tenancy: every audit entry belongs to a studio where possible.
    studioId: uuid('studio_id').references(() => studios.id, { onDelete: 'cascade' }),

    // Actor and action
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 128 }).notNull(),
    resource: varchar('resource', { length: 128 }).notNull(),
    resourceId: uuid('resource_id'),

    // Context
    details: jsonb('details').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),

    // Classification
    severity: varchar('severity', { length: 16 }).notNull(),
    category: varchar('category', { length: 32 }).notNull(),

    // Outcome
    success: boolean('success').notNull(),
    errorMessage: text('error_message'),

    // Immutable timestamp
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    // Required by MVP-9: user timeline queries
    userCreatedAtIdx: index('audit_logs_user_id_created_at_idx').on(table.userId, table.createdAt),
    // Required by MVP-9: category-based queries
    categoryCreatedAtIdx: index('audit_logs_category_created_at_idx').on(table.category, table.createdAt),
    // Tenant isolation lookups
    studioIdx: index('audit_logs_studio_id_idx').on(table.studioId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    resourceIdx: index('audit_logs_resource_idx').on(table.resource),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
    severityCheck: check(
      'audit_logs_severity_check',
      sql`${table.severity} IN ('low', 'medium', 'high', 'critical')`,
    ),
    categoryCheck: check(
      'audit_logs_category_check',
      sql`${table.category} IN ('auth', 'financial', 'admin', 'user_action', 'system')`,
    ),
  }),
);
