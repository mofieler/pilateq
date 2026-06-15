import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { classTypeEnum, creditTypeEnum, sessionStatusEnum } from './enums';
import { instructors } from './instructors.schema';
import { users } from './users.schema';
import { studios } from './studios.schema';

export const classTemplates = pgTable(
  'class_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    classType: classTypeEnum('class_type').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    maxCapacity: integer('max_capacity').notNull(),
    creditCost: integer('credit_cost').notNull(),
    // Credit type based on class type:
    // - mat_group: for group mat classes
    // - reformer_group: for group reformer classes  
    // - private_session: for private sessions (1:1 or 1:2)
    creditType: creditTypeEnum('credit_type').notNull(),
    // [FIX-3] SET NULL — if an instructor is removed, templates survive as orphaned records
    instructorId: uuid('instructor_id').references(() => instructors.id, { onDelete: 'set null' }),
    vibeTags: jsonb('vibe_tags').$type<string[]>().default([]),
    location: varchar('location', { length: 255 }),
    isWelcomeJourney: boolean('is_welcome_journey').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    // [FIX-2] withTimezone: true
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    studioIdIdx: index('class_templates_studio_id_idx').on(table.studioId),
    classTypeIdx: index('class_templates_type_idx').on(table.classType),
    isActiveIdx: index('class_templates_is_active_idx').on(table.isActive),
    instructorIdx: index('class_templates_instructor_idx').on(table.instructorId),
    studioActiveIdx: index('class_templates_studio_active_idx').on(table.studioId, table.isActive),
    durationPositive: check('class_templates_duration_positive', sql`${table.durationMinutes} > 0`),
    maxCapacityPositive: check('class_templates_capacity_positive', sql`${table.maxCapacity} > 0`),
    creditCostPositive: check('class_templates_credit_cost_positive', sql`${table.creditCost} > 0`),
  }),
);

export const classSessions = pgTable(
  'class_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    // [FIX-3] SET NULL — session record survives template deletion (for historical bookings)
    templateId: uuid('template_id').references(() => classTemplates.id, { onDelete: 'set null' }),
    instructorId: uuid('instructor_id').references(() => instructors.id, { onDelete: 'set null' }),
    // [FIX-2] withTimezone: true — critical for cross-timezone scheduling correctness
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }).notNull(),
    maxCapacity: integer('max_capacity').notNull(),
    bookedCount: integer('booked_count').notNull().default(0),
    waitlistCount: integer('waitlist_count').notNull().default(0),
    status: sessionStatusEnum('status').notNull().default('scheduled'),
    cancellationReason: text('cancellation_reason'),
    // [FIX-2] withTimezone: true
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
    // [FIX-3] SET NULL — admin/instructor who cancelled; nullable, auditable
    cancelledBy: uuid('cancelled_by').references(() => users.id, { onDelete: 'set null' }),
    // Stamped when admin/instructor reschedules the class time. Used to grant
    // students a free 24-hour cancellation window after any reschedule.
    // [FIX-2] withTimezone: true
    rescheduledAt: timestamp('rescheduled_at', { withTimezone: true, mode: 'date' }),

    // Google Calendar sync — populated when the instructor's account has an active
    // calendar connection and we've pushed an event. Null = not synced yet.
    // googleCalendarEventId is the event ID in the instructor's calendar.
    // googleCalendarId is the calendar this event lives in (may differ if instructor
    // reselects calendar — we use it to know where to PATCH/DELETE).
    googleCalendarEventId: text('google_calendar_event_id'),
    googleCalendarId: text('google_calendar_id'),
    // [FIX-2] withTimezone: true
    googleCalendarSyncedAt: timestamp('google_calendar_synced_at', {
      withTimezone: true,
      mode: 'date',
    }),
    googleCalendarSyncError: text('google_calendar_sync_error'),

    // [FIX-2] withTimezone: true
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),

    // Optimistic locking — critical for concurrent booking/cancellation races.
    version: integer('version').notNull().default(0),
  },
  (table) => ({
    studioIdIdx: index('class_sessions_studio_id_idx').on(table.studioId),
    startsAtIdx: index('class_sessions_starts_at_idx').on(table.startsAt),
    statusIdx: index('class_sessions_status_idx').on(table.status),
    studioStatusIdx: index('class_sessions_studio_status_idx').on(table.studioId, table.status),
    // Tenant-scoped schedule range queries
    studioStartsAtIdx: index('class_sessions_studio_starts_at_idx').on(table.studioId, table.startsAt),
    instructorIdx: index('class_sessions_instructor_idx').on(table.instructorId),
    // Composite index for the most common query: upcoming scheduled sessions
    scheduleIdx: index('class_sessions_schedule_idx').on(table.startsAt, table.status),
    // Retry-sweep worker queries sessions with non-null sync errors
    syncErrorIdx: index('class_sessions_sync_error_idx').on(table.googleCalendarSyncError),
    // For instructor overlap queries: instructor + status + time range
    instructorTimeIdx: index('class_sessions_instructor_time_idx').on(table.instructorId, table.status, table.startsAt, table.endsAt),
    // For template joins
    templateIdIdx: index('class_sessions_template_id_idx').on(table.templateId),
    endsAfterStarts: check('class_sessions_ends_after_starts', sql`${table.endsAt} > ${table.startsAt}`),
    bookedCountNonNeg: check('class_sessions_booked_count_nonneg', sql`${table.bookedCount} >= 0`),
    waitlistCountNonNeg: check('class_sessions_waitlist_count_nonneg', sql`${table.waitlistCount} >= 0`),
    maxCapacityPositive: check('class_sessions_capacity_positive', sql`${table.maxCapacity} > 0`),
    versionNonNeg: check('class_sessions_version_nonneg', sql`${table.version} >= 0`),
  }),
);
