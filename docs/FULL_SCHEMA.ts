/**
 * FULL_SCHEMA.TS — Pilates OS
 * Complete PostgreSQL schema via Drizzle ORM
 * Covers all 3 phases: Core, Professionalization, Growth & VOD
 *
 * Patch v1.1.0:
 *   [FIX-1] Soft-delete column added to `users` table (deletedAt).
 *   [FIX-2] All timestamps updated to { withTimezone: true, mode: 'date' } system-wide.
 *   [FIX-3] All financial/booking onDelete: 'cascade' changed to 'restrict' or 'set null'.
 *
 * Structure:
 *   1. Enums
 *   2. Core Tables (Users, Instructors, Classes)
 *   3. Booking & Waitlist Tables
 *   4. Credit & Billing Tables
 *   5. Waiver & Guest Pass Tables
 *   6. VOD Tables
 *   7. Gamification Tables
 *   8. Relations
 *   9. Type Exports
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────────────────────
// 1. ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', [
  'student',
  'instructor',
  'admin',
]);

export const classTypeEnum = pgEnum('class_type', [
  'private',
  'duo',
  'group',
  'reformer',
  'mat',
  'online',
]);

export const intensityLevelEnum = pgEnum('intensity_level', [
  'low',
  'medium',
  'high',
  'varied',
]);

export const sessionStatusEnum = pgEnum('session_status', [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
]);

export const bookingStatusEnum = pgEnum('booking_status', [
  'confirmed',
  'cancelled',
  'attended',
  'no_show',
  'waitlisted',
]);

export const cancellationTypeEnum = pgEnum('cancellation_type', [
  'user_cancelled',
  'instructor_cancelled',
  'admin_cancelled',
]);

export const creditTypeEnum = pgEnum('credit_type', [
  'standard',
  'premium',
  'vip',
]);

export const creditTransactionTypeEnum = pgEnum('credit_transaction_type', [
  'purchase',
  'debit',
  'refund',
  'manual_adjustment',
  'expiry',
]);

export const stripeTransactionStatusEnum = pgEnum('stripe_transaction_status', [
  'pending',
  'succeeded',
  'failed',
  'refunded',
]);

export const waitlistStatusEnum = pgEnum('waitlist_status', [
  'waiting',
  'offered',
  'confirmed',
  'expired',
  'cancelled',
]);

export const guestPassStatusEnum = pgEnum('guest_pass_status', [
  'active',
  'redeemed',
  'expired',
]);

export const vodStatusEnum = pgEnum('vod_status', [
  'processing',
  'published',
  'unlisted',
  'archived',
]);

export const vodDifficultyEnum = pgEnum('vod_difficulty', [
  'beginner',
  'intermediate',
  'advanced',
]);

export const badgeTriggerTypeEnum = pgEnum('badge_trigger_type', [
  'classes_attended',
  'streak',
  'purchases',
  'special',
]);

// ─────────────────────────────────────────────────────────────────────────────
// 2. CORE TABLES
// ─────────────────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    avatarUrl: varchar('avatar_url', { length: 500 }),
    role: userRoleEnum('role').notNull().default('student'),

    // Auth.js fields
    // [FIX-2] withTimezone: true on all timestamps
    emailVerified: timestamp('email_verified', { withTimezone: true, mode: 'date' }),
    image: varchar('image', { length: 500 }),

    // Booking / Business logic flags
    hasSignedWaiver: boolean('has_signed_waiver').notNull().default(false),
    firstMercyUsed: boolean('first_mercy_used').notNull().default(false),

    // Gamification (Phase 3 — pre-allocated for schema stability)
    totalClassesAttended: integer('total_classes_attended').notNull().default(0),
    currentStreak: integer('current_streak').notNull().default(0),
    longestStreak: integer('longest_streak').notNull().default(0),
    // [FIX-2] withTimezone: true
    streakLastUpdatedAt: timestamp('streak_last_updated_at', { withTimezone: true, mode: 'date' }),

    // [FIX-1] Soft-delete column — NEVER hard-delete users with financial history.
    // Queries must include .where(isNull(users.deletedAt)) to exclude soft-deleted rows.
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),

    // [FIX-2] withTimezone: true
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    roleIdx: index('users_role_idx').on(table.role),
    // [FIX-1] Index for efficient soft-delete filtering
    deletedAtIdx: index('users_deleted_at_idx').on(table.deletedAt),
  }),
);

// Auth.js v5 required tables
// NOTE: Auth tables (accounts, sessions) intentionally retain onDelete: 'cascade'
// because they are session data, NOT financial records. Deleting a user's auth
// sessions on user deletion is the correct behaviour.
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 255 }).notNull(),
    provider: varchar('provider', { length: 255 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: varchar('token_type', { length: 255 }),
    scope: varchar('scope', { length: 255 }),
    idToken: text('id_token'),
    sessionState: varchar('session_state', { length: 255 }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
    userIdIdx: index('accounts_user_id_idx').on(table.userId),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    sessionToken: varchar('session_token', { length: 255 }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // [FIX-2] withTimezone: true
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
  }),
);

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: varchar('identifier', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull(),
    // [FIX-2] withTimezone: true
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  }),
);

export const instructors = pgTable(
  'instructors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      // [FIX-3] Instructors are linked to users but are operational data.
      // 'restrict' prevents accidental user deletion while instructor records exist.
      // Use soft-delete on users instead; this is the safety net.
      .references(() => users.id, { onDelete: 'restrict' }),
    bio: text('bio'),
    spotifyPlaylistUrl: varchar('spotify_playlist_url', { length: 500 }),
    intensityLevel: intensityLevelEnum('intensity_level').default('medium'),
    specialties: jsonb('specialties').$type<string[]>().default([]),
    vibeTags: jsonb('vibe_tags').$type<string[]>().default([]),
    avatarUrl: varchar('avatar_url', { length: 500 }),
    isActive: boolean('is_active').notNull().default(true),
    // [FIX-2] withTimezone: true
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: uniqueIndex('instructors_user_id_idx').on(table.userId),
    isActiveIdx: index('instructors_is_active_idx').on(table.isActive),
  }),
);

export const classTemplates = pgTable(
  'class_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    classType: classTypeEnum('class_type').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    maxCapacity: integer('max_capacity').notNull(),
    creditCost: integer('credit_cost').notNull(),
    creditType: creditTypeEnum('credit_type').notNull().default('standard'),
    instructorId: uuid('instructor_id').references(() => instructors.id, {
      onDelete: 'set null',
    }),
    vibeTags: jsonb('vibe_tags').$type<string[]>().default([]),
    location: varchar('location', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    // [FIX-2] withTimezone: true
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    classTypeIdx: index('class_templates_type_idx').on(table.classType),
    isActiveIdx: index('class_templates_is_active_idx').on(table.isActive),
    instructorIdx: index('class_templates_instructor_idx').on(table.instructorId),
  }),
);

export const classSessions = pgTable(
  'class_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id').references(() => classTemplates.id, {
      onDelete: 'set null',
    }),
    instructorId: uuid('instructor_id').references(() => instructors.id, {
      onDelete: 'set null',
    }),
    // [FIX-2] withTimezone: true — critical for scheduling across timezones
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }).notNull(),
    maxCapacity: integer('max_capacity').notNull(),
    bookedCount: integer('booked_count').notNull().default(0),
    waitlistCount: integer('waitlist_count').notNull().default(0),
    status: sessionStatusEnum('status').notNull().default('scheduled'),
    cancellationReason: text('cancellation_reason'),
    // [FIX-2] withTimezone: true
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
    cancelledBy: uuid('cancelled_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    // [FIX-2] withTimezone: true
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    startsAtIdx: index('class_sessions_starts_at_idx').on(table.startsAt),
    statusIdx: index('class_sessions_status_idx').on(table.status),
    instructorIdx: index('class_sessions_instructor_idx').on(table.instructorId),
    scheduleIdx: index('class_sessions_schedule_idx').on(
      table.startsAt,
      table.status,
    ),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. BOOKING & WAITLIST TABLES
// ─────────────────────────────────────────────────────────────────────────────

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // [FIX-3] CHANGED from 'cascade' to 'restrict'.
    // We must never silently delete booking records with credit transactions attached.
    // Use soft-delete on users instead.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // [FIX-3] CHANGED from 'cascade' to 'restrict'.
    // Deleting a session that has bookings must be blocked at the DB level.
    // Use the session cancellation flow (which refunds credits) instead.
    sessionId: uuid('session_id')
      .notNull()
      .references(() => classSessions.id, { onDelete: 'restrict' }),
    status: bookingStatusEnum('status').notNull().default('confirmed'),
    cancellationType: cancellationTypeEnum('cancellation_type'),
    mercyApplied: boolean('mercy_applied').notNull().default(false),
    creditsSpent: integer('credits_spent').notNull(),
    creditType: creditTypeEnum('credit_type').notNull(),
    // [FIX-2] withTimezone: true
    bookedAt: timestamp('booked_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
    cancellationReason: text('cancellation_reason'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    uniqueBooking: uniqueIndex('bookings_user_session_unique_idx').on(
      table.userId,
      table.sessionId,
    ),
    userIdIdx: index('bookings_user_id_idx').on(table.userId),
    sessionIdIdx: index('bookings_session_id_idx').on(table.sessionId),
    statusIdx: index('bookings_status_idx').on(table.status),
    userStatusIdx: index('bookings_user_status_idx').on(
      table.userId,
      table.status,
    ),
  }),
);

export const waitlistEntries = pgTable(
  'waitlist_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // [FIX-3] CHANGED from 'cascade' to 'restrict' — waitlist entries are
    // operational records that must be explicitly resolved before user deletion.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // [FIX-3] CHANGED from 'cascade' to 'restrict' — the cancelSessionByInstructor
    // flow must explicitly cancel waitlist entries. Silent cascade is dangerous.
    sessionId: uuid('session_id')
      .notNull()
      .references(() => classSessions.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    status: waitlistStatusEnum('status').notNull().default('waiting'),
    // [FIX-2] withTimezone: true
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
    uniqueEntry: uniqueIndex('waitlist_user_session_unique_idx').on(
      table.userId,
      table.sessionId,
    ),
    sessionPositionIdx: index('waitlist_session_position_idx').on(
      table.sessionId,
      table.position,
    ),
    statusIdx: index('waitlist_status_idx').on(table.status),
    promotionIdx: index('waitlist_promotion_idx').on(
      table.sessionId,
      table.status,
      table.position,
    ),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. CREDIT & BILLING TABLES
// ─────────────────────────────────────────────────────────────────────────────

export const creditPackages = pgTable(
  'credit_packages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    creditsAmount: integer('credits_amount').notNull(),
    creditType: creditTypeEnum('credit_type').notNull(),
    priceCents: integer('price_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('eur'),
    validityDays: integer('validity_days').notNull().default(365),
    stripePriceId: varchar('stripe_price_id', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    // [FIX-2] withTimezone: true
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    isActiveIdx: index('credit_packages_is_active_idx').on(table.isActive),
    creditTypeIdx: index('credit_packages_credit_type_idx').on(table.creditType),
  }),
);

export const creditBalances = pgTable(
  'credit_balances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // [FIX-3] CHANGED from 'cascade' to 'restrict'.
    // Credit balances are financial records. They must not vanish silently.
    // Soft-delete the user; these records must be retained for audit.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    creditType: creditTypeEnum('credit_type').notNull(),
    balance: integer('balance').notNull().default(0),
    // [FIX-2] withTimezone: true
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    uniqueBalance: uniqueIndex('credit_balances_user_type_unique_idx').on(
      table.userId,
      table.creditType,
    ),
    userIdIdx: index('credit_balances_user_id_idx').on(table.userId),
    expiresAtIdx: index('credit_balances_expires_at_idx').on(table.expiresAt),
  }),
);

export const creditTransactions = pgTable(
  'credit_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // [FIX-3] CHANGED from 'cascade' to 'restrict'.
    // Transaction ledger is immutable. User deletion must never destroy ledger history.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // 'set null' is correct for bookingId and packageId — the transaction record
    // itself must survive even if the referenced booking/package is later removed.
    bookingId: uuid('booking_id').references(() => bookings.id, {
      onDelete: 'set null',
    }),
    packageId: uuid('package_id').references(() => creditPackages.id, {
      onDelete: 'set null',
    }),
    type: creditTransactionTypeEnum('type').notNull(),
    creditType: creditTypeEnum('credit_type').notNull(),
    amount: integer('amount').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    description: text('description'),
    processedBy: uuid('processed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    // [FIX-2] withTimezone: true — ledger timestamps must be unambiguous
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('credit_transactions_user_id_idx').on(table.userId),
    bookingIdIdx: index('credit_transactions_booking_id_idx').on(table.bookingId),
    typeIdx: index('credit_transactions_type_idx').on(table.type),
    userCreatedAtIdx: index('credit_transactions_user_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export const stripeTransactions = pgTable(
  'stripe_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // [FIX-3] CHANGED from 'cascade' to 'restrict'.
    // Stripe transaction records are financial audit artifacts. Non-negotiable.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    packageId: uuid('package_id').references(() => creditPackages.id, {
      onDelete: 'set null',
    }),
    stripePaymentIntentId: varchar('stripe_payment_intent_id', {
      length: 255,
    }).unique(),
    stripeCheckoutSessionId: varchar('stripe_checkout_session_id', {
      length: 255,
    }).unique(),
    amountCents: integer('amount_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('eur'),
    status: stripeTransactionStatusEnum('status').notNull().default('pending'),
    stripeMetadata: jsonb('stripe_metadata').$type<Record<string, unknown>>(),
    // [FIX-2] withTimezone: true
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('stripe_transactions_user_id_idx').on(table.userId),
    paymentIntentIdx: uniqueIndex('stripe_transactions_payment_intent_idx').on(
      table.stripePaymentIntentId,
    ),
    checkoutSessionIdx: uniqueIndex(
      'stripe_transactions_checkout_session_idx',
    ).on(table.stripeCheckoutSessionId),
    statusIdx: index('stripe_transactions_status_idx').on(table.status),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. WAIVER & GUEST PASS TABLES
// ─────────────────────────────────────────────────────────────────────────────

export const waivers = pgTable(
  'waivers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // [FIX-3] CHANGED from 'cascade' to 'restrict'.
    // Legal documents. Waiver signatures must be retained indefinitely
    // for liability purposes. Never allow silent deletion.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    documentVersion: varchar('document_version', { length: 50 }).notNull(),
    documentContent: text('document_content').notNull(),
    ipAddress: varchar('ip_address', { length: 50 }).notNull(),
    userAgent: text('user_agent'),
    // [FIX-2] withTimezone: true — legal timestamp, must be unambiguous
    signedAt: timestamp('signed_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('waivers_user_id_idx').on(table.userId),
    userVersionIdx: index('waivers_user_version_idx').on(
      table.userId,
      table.documentVersion,
    ),
  }),
);

export const guestPasses = pgTable(
  'guest_passes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    // [FIX-3] CHANGED from 'cascade' to 'restrict' for createdBy.
    // Guest passes are financial instruments; their origin must be traceable.
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    redeemedBy: uuid('redeemed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    redeemedForSession: uuid('redeemed_for_session').references(
      () => classSessions.id,
      { onDelete: 'set null' },
    ),
    status: guestPassStatusEnum('status').notNull().default('active'),
    // [FIX-2] withTimezone: true
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    codeIdx: uniqueIndex('guest_passes_code_idx').on(table.code),
    statusIdx: index('guest_passes_status_idx').on(table.status),
    expiresAtIdx: index('guest_passes_expires_at_idx').on(table.expiresAt),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. VOD TABLES (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────

export const vodVideos = pgTable(
  'vod_videos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    s3Key: varchar('s3_key', { length: 500 }),
    cdnUrl: varchar('cdn_url', { length: 500 }),
    thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
    durationSeconds: integer('duration_seconds'),
    fileSizeBytes: integer('file_size_bytes'),
    status: vodStatusEnum('status').notNull().default('processing'),
    tags: jsonb('tags').$type<string[]>().default([]),
    difficulty: vodDifficultyEnum('difficulty'),
    instructorId: uuid('instructor_id').references(() => instructors.id, {
      onDelete: 'set null',
    }),
    viewCount: integer('view_count').notNull().default(0),
    schemaOrgMetadata: jsonb('schema_org_metadata').$type<Record<string, unknown>>(),
    // [FIX-2] withTimezone: true
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    slugIdx: uniqueIndex('vod_videos_slug_idx').on(table.slug),
    statusIdx: index('vod_videos_status_idx').on(table.status),
    difficultyIdx: index('vod_videos_difficulty_idx').on(table.difficulty),
    instructorIdx: index('vod_videos_instructor_idx').on(table.instructorId),
    publishedAtIdx: index('vod_videos_published_at_idx').on(table.publishedAt),
  }),
);

export const vodProgress = pgTable(
  'vod_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // [FIX-3] CHANGED from 'cascade' to 'restrict' for userId.
    // Progress records may be valuable for analytics/retention even post user deletion.
    // Soft-delete users and retain progress data for aggregate reporting.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    videoId: uuid('video_id')
      .notNull()
      // 'cascade' is acceptable here: if a video is deleted from the system,
      // the associated progress records are genuinely orphaned and can be removed.
      .references(() => vodVideos.id, { onDelete: 'cascade' }),
    watchedSeconds: integer('watched_seconds').notNull().default(0),
    completed: boolean('completed').notNull().default(false),
    // [FIX-2] withTimezone: true
    lastWatchedAt: timestamp('last_watched_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    uniqueProgress: uniqueIndex('vod_progress_user_video_unique_idx').on(
      table.userId,
      table.videoId,
    ),
    userIdIdx: index('vod_progress_user_id_idx').on(table.userId),
    videoIdIdx: index('vod_progress_video_id_idx').on(table.videoId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. GAMIFICATION TABLES (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────

export const badges = pgTable(
  'badges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    description: text('description'),
    iconUrl: varchar('icon_url', { length: 500 }),
    triggerType: badgeTriggerTypeEnum('trigger_type').notNull(),
    triggerValue: integer('trigger_value'),
    // [FIX-2] withTimezone: true
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    triggerTypeIdx: index('badges_trigger_type_idx').on(table.triggerType),
  }),
);

export const userBadges = pgTable(
  'user_badges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // [FIX-3] CHANGED from 'cascade' to 'restrict' for userId.
    // Badge awards are user achievement records — retain for historical display
    // and potential reinstatement after soft-delete recovery.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    badgeId: uuid('badge_id')
      .notNull()
      // 'cascade' is correct here: if an admin deletes a badge definition,
      // the award records for that badge become meaningless and can be removed.
      .references(() => badges.id, { onDelete: 'cascade' }),
    // [FIX-2] withTimezone: true
    awardedAt: timestamp('awarded_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueUserBadge: uniqueIndex('user_badges_user_badge_unique_idx').on(
      table.userId,
      table.badgeId,
    ),
    userIdIdx: index('user_badges_user_id_idx').on(table.userId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. RELATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  instructor: one(instructors, {
    fields: [users.id],
    references: [instructors.userId],
  }),
  bookings: many(bookings),
  creditBalances: many(creditBalances),
  creditTransactions: many(creditTransactions),
  stripeTransactions: many(stripeTransactions),
  waitlistEntries: many(waitlistEntries),
  waivers: many(waivers),
  guestPassesCreated: many(guestPasses, { relationName: 'createdBy' }),
  vodProgress: many(vodProgress),
  userBadges: many(userBadges),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const instructorsRelations = relations(instructors, ({ one, many }) => ({
  user: one(users, {
    fields: [instructors.userId],
    references: [users.id],
  }),
  classTemplates: many(classTemplates),
  classSessions: many(classSessions),
  vodVideos: many(vodVideos),
}));

export const classTemplatesRelations = relations(
  classTemplates,
  ({ one, many }) => ({
    instructor: one(instructors, {
      fields: [classTemplates.instructorId],
      references: [instructors.id],
    }),
    classSessions: many(classSessions),
  }),
);

export const classSessionsRelations = relations(
  classSessions,
  ({ one, many }) => ({
    template: one(classTemplates, {
      fields: [classSessions.templateId],
      references: [classTemplates.id],
    }),
    instructor: one(instructors, {
      fields: [classSessions.instructorId],
      references: [instructors.id],
    }),
    cancelledByUser: one(users, {
      fields: [classSessions.cancelledBy],
      references: [users.id],
    }),
    bookings: many(bookings),
    waitlistEntries: many(waitlistEntries),
  }),
);

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
  session: one(classSessions, {
    fields: [bookings.sessionId],
    references: [classSessions.id],
  }),
  creditTransactions: many(creditTransactions),
}));

export const waitlistEntriesRelations = relations(
  waitlistEntries,
  ({ one }) => ({
    user: one(users, {
      fields: [waitlistEntries.userId],
      references: [users.id],
    }),
    session: one(classSessions, {
      fields: [waitlistEntries.sessionId],
      references: [classSessions.id],
    }),
  }),
);

export const creditPackagesRelations = relations(
  creditPackages,
  ({ many }) => ({
    creditTransactions: many(creditTransactions),
    stripeTransactions: many(stripeTransactions),
  }),
);

export const creditBalancesRelations = relations(creditBalances, ({ one }) => ({
  user: one(users, {
    fields: [creditBalances.userId],
    references: [users.id],
  }),
}));

export const creditTransactionsRelations = relations(
  creditTransactions,
  ({ one }) => ({
    user: one(users, {
      fields: [creditTransactions.userId],
      references: [users.id],
    }),
    booking: one(bookings, {
      fields: [creditTransactions.bookingId],
      references: [bookings.id],
    }),
    package: one(creditPackages, {
      fields: [creditTransactions.packageId],
      references: [creditPackages.id],
    }),
    processedByUser: one(users, {
      fields: [creditTransactions.processedBy],
      references: [users.id],
    }),
  }),
);

export const vodVideosRelations = relations(vodVideos, ({ one, many }) => ({
  instructor: one(instructors, {
    fields: [vodVideos.instructorId],
    references: [instructors.id],
  }),
  progress: many(vodProgress),
}));

export const badgesRelations = relations(badges, ({ many }) => ({
  userBadges: many(userBadges),
}));

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, {
    fields: [userBadges.userId],
    references: [users.id],
  }),
  badge: one(badges, {
    fields: [userBadges.badgeId],
    references: [badges.id],
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// 9. TYPE EXPORTS
// Use these Drizzle-inferred types throughout the application.
// Never define manual interfaces that duplicate these.
// ─────────────────────────────────────────────────────────────────────────────

import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Instructor = InferSelectModel<typeof instructors>;
export type NewInstructor = InferInsertModel<typeof instructors>;

export type ClassTemplate = InferSelectModel<typeof classTemplates>;
export type NewClassTemplate = InferInsertModel<typeof classTemplates>;

export type ClassSession = InferSelectModel<typeof classSessions>;
export type NewClassSession = InferInsertModel<typeof classSessions>;

export type Booking = InferSelectModel<typeof bookings>;
export type NewBooking = InferInsertModel<typeof bookings>;

export type WaitlistEntry = InferSelectModel<typeof waitlistEntries>;
export type NewWaitlistEntry = InferInsertModel<typeof waitlistEntries>;

export type CreditPackage = InferSelectModel<typeof creditPackages>;
export type NewCreditPackage = InferInsertModel<typeof creditPackages>;

export type CreditBalance = InferSelectModel<typeof creditBalances>;
export type NewCreditBalance = InferInsertModel<typeof creditBalances>;

export type CreditTransaction = InferSelectModel<typeof creditTransactions>;
export type NewCreditTransaction = InferInsertModel<typeof creditTransactions>;

export type StripeTransaction = InferSelectModel<typeof stripeTransactions>;
export type NewStripeTransaction = InferInsertModel<typeof stripeTransactions>;

export type Waiver = InferSelectModel<typeof waivers>;
export type NewWaiver = InferInsertModel<typeof waivers>;

export type GuestPass = InferSelectModel<typeof guestPasses>;
export type NewGuestPass = InferInsertModel<typeof guestPasses>;

export type VodVideo = InferSelectModel<typeof vodVideos>;
export type NewVodVideo = InferInsertModel<typeof vodVideos>;

export type VodProgress = InferSelectModel<typeof vodProgress>;
export type NewVodProgress = InferInsertModel<typeof vodProgress>;

export type Badge = InferSelectModel<typeof badges>;
export type NewBadge = InferInsertModel<typeof badges>;

export type UserBadge = InferSelectModel<typeof userBadges>;
export type NewUserBadge = InferInsertModel<typeof userBadges>;

// Enum value types — use these instead of raw strings
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type ClassType = (typeof classTypeEnum.enumValues)[number];
export type CreditType = (typeof creditTypeEnum.enumValues)[number];
export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];
export type SessionStatus = (typeof sessionStatusEnum.enumValues)[number];
export type WaitlistStatus = (typeof waitlistStatusEnum.enumValues)[number];
export type TransactionType = (typeof creditTransactionTypeEnum.enumValues)[number];
export type StripeTransactionStatus = (typeof stripeTransactionStatusEnum.enumValues)[number];
export type VodStatus = (typeof vodStatusEnum.enumValues)[number];
export type VodDifficulty = (typeof vodDifficultyEnum.enumValues)[number];
