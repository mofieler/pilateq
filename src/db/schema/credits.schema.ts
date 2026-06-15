/**
 * Simplified Credit System Schema
 *
 * Single-ledger architecture: creditTransactions is the ONLY source of truth.
 * Balance is computed dynamically via SUM(amount).
 *
 * Tables: 5 (was 9)
 *   creditPackages      — what the studio sells
 *   creditTransactions  — immutable ledger (purchase, debit, refund, adjustment, membership_grant)
 *   creditPurchases     — payment tracking per purchase
 *   membershipPlans     — available membership plans
 *   userMemberships     — active user subscriptions
 */

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
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  creditTypeEnum,
  creditTransactionTypeEnum,
  paymentMethodEnum,
  paymentStatusEnum,
  creditPackCategoryEnum,
  membershipStatusEnum,
  sessionSubtypeEnum,
} from './enums';
import { users } from './users.schema';
import { bookings } from './bookings.schema';
import { promoCodes } from './promos.schema';
import { studios } from './studios.schema';

// ─── Credit Packages ─────────────────────────────────────────────────────────

export const creditPackages = pgTable(
  'credit_packages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    creditsAmount: integer('credits_amount').notNull(),
    creditType: creditTypeEnum('credit_type').notNull(),
    category: creditPackCategoryEnum('category').notNull().default('credit'),
    priceCents: integer('price_cents').notNull(),
    discountPriceCents: integer('discount_price_cents'),
    currency: varchar('currency', { length: 3 }).notNull().default('eur'),
    validityDays: integer('validity_days').notNull().default(365),
    stripePriceId: varchar('stripe_price_id', { length: 255 }).unique(),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    studioIdIdx: index('credit_packages_studio_id_idx').on(table.studioId),
    isActiveIdx: index('credit_packages_is_active_idx').on(table.isActive),
    creditTypeIdx: index('credit_packages_credit_type_idx').on(table.creditType),
    studioActiveIdx: index('credit_packages_studio_active_idx').on(table.studioId, table.isActive),
    priceNonNeg: check('credit_packages_price_nonneg', sql`${table.priceCents} >= 0`),
    creditsPositive: check('credit_packages_credits_positive', sql`${table.creditsAmount} > 0`),
  }),
);

// ─── Credit Transactions (Single Ledger) ─────────────────────────────────────

export const creditTransactions = pgTable(
  'credit_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    type: creditTransactionTypeEnum('type').notNull(),
    creditType: creditTypeEnum('credit_type').notNull(),
    amount: integer('amount').notNull(), // positive = credit added, negative = credit spent
    description: text('description'),

    // Optional links — exactly one should be set per row (enforced by check)
    bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
    purchaseId: uuid('purchase_id').references(() => creditPurchases.id, { onDelete: 'set null' }),
    membershipId: uuid('membership_id').references(() => userMemberships.id, { onDelete: 'set null' }),
    processedBy: uuid('processed_by').references(() => users.id, { onDelete: 'set null' }),

    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    studioIdIdx: index('credit_transactions_studio_id_idx').on(table.studioId),
    userIdIdx: index('credit_transactions_user_id_idx').on(table.userId),
    typeIdx: index('credit_transactions_type_idx').on(table.type),
    // Tenant-scoped balance and ledger lookups
    studioUserIdx: index('credit_transactions_studio_user_idx').on(table.studioId, table.userId),
    studioTypeIdx: index('credit_transactions_studio_type_idx').on(table.studioId, table.type),
    bookingIdIdx: index('credit_transactions_booking_id_idx').on(table.bookingId),
    purchaseIdIdx: index('credit_transactions_purchase_id_idx').on(table.purchaseId),
    // Core balance query: WHERE user_id = ? AND credit_type = ?
    userCreditTypeIdx: index('credit_transactions_user_credit_type_idx').on(table.userId, table.creditType),
    // For cursor-based pagination
    userCreatedAtIdx: index('credit_transactions_user_created_at_idx').on(table.userId, table.createdAt),
  }),
);

// ─── Credit Purchases ────────────────────────────────────────────────────────

export const creditPurchases = pgTable(
  'credit_purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    packageId: uuid('package_id')
      .references(() => creditPackages.id, { onDelete: 'restrict' }),
    promoCodeId: uuid('promo_code_id').references(() => promoCodes.id, { onDelete: 'set null' }),
    creditsAmount: integer('credits_amount').notNull(),
    creditType: creditTypeEnum('credit_type').notNull(),
    priceCents: integer('price_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('eur'),
    paymentMethod: paymentMethodEnum('payment_method').notNull().default('pay_at_studio'),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
    stripeSessionId: varchar('stripe_session_id', { length: 255 }),
    stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }).unique(),
    paymentDueDate: timestamp('payment_due_date', { withTimezone: true, mode: 'date' }),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
    paidByUserId: uuid('paid_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    processingFeeCents: integer('processing_fee_cents').default(0),
    adminNotes: text('admin_notes'),
    invoiceNumber: varchar('invoice_number', { length: 50 }),
    invoiceIssuedAt: timestamp('invoice_issued_at', { withTimezone: true, mode: 'date' }),
    creditsGrantedAt: timestamp('credits_granted_at', { withTimezone: true, mode: 'date' }),
    // Idempotency key for pay-at-studio purchases. Generated client-side and
    // stored so duplicate submissions return the same pending purchase instead
    // of creating a new invoice.
    idempotencyKey: varchar('idempotency_key', { length: 64 }).unique(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    studioIdIdx: index('credit_purchases_studio_id_idx').on(table.studioId),
    userIdIdx: index('credit_purchases_user_id_idx').on(table.userId),
    packageIdIdx: index('credit_purchases_package_id_idx').on(table.packageId),
    statusIdx: index('credit_purchases_status_idx').on(table.paymentStatus),
    // Tenant-scoped payment status lookups
    studioStatusIdx: index('credit_purchases_studio_status_idx').on(table.studioId, table.paymentStatus),
    methodIdx: index('credit_purchases_method_idx').on(table.paymentMethod),
    stripeSessionUniqueIdx: uniqueIndex('credit_purchases_stripe_session_unique_idx').on(table.stripeSessionId),
    invoiceNumberIdx: index('credit_purchases_invoice_number_idx').on(table.invoiceNumber),
    invoiceNumberUniqueIdx: uniqueIndex('credit_purchases_invoice_number_unique_idx').on(table.invoiceNumber),
    idempotencyKeyIdx: uniqueIndex('credit_purchases_idempotency_key_idx').on(table.idempotencyKey),
    priceNonNeg: check('credit_purchases_price_nonneg', sql`${table.priceCents} >= 0`),
    creditsPositive: check('credit_purchases_credits_positive', sql`${table.creditsAmount} > 0`),
  }),
);

// ─── Membership Plans ─────────────────────────────────────────────────────────

export const membershipPlans = pgTable(
  'membership_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    creditType: creditTypeEnum('credit_type').notNull(),
    sessionSubtype: sessionSubtypeEnum('session_subtype'),
    weeklyCredits: integer('weekly_credits').notNull(),
    durationWeeks: integer('duration_weeks').notNull(),
    priceCents: integer('price_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('eur'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    studioIdIdx: index('membership_plans_studio_id_idx').on(table.studioId),
    isActiveIdx: index('membership_plans_is_active_idx').on(table.isActive),
    studioActiveIdx: index('membership_plans_studio_active_idx').on(table.studioId, table.isActive),
    weeklyCreditsPositive: check('membership_plans_weekly_credits_positive', sql`${table.weeklyCredits} > 0`),
    durationWeeksPositive: check('membership_plans_duration_weeks_positive', sql`${table.durationWeeks} > 0`),
    priceNonNeg: check('membership_plans_price_nonneg', sql`${table.priceCents} >= 0`),
  }),
);

// ─── User Memberships ────────────────────────────────────────────────────────

export const userMemberships = pgTable(
  'user_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => membershipPlans.id, { onDelete: 'restrict' }),
    creditType: creditTypeEnum('credit_type').notNull(),
    sessionSubtype: sessionSubtypeEnum('session_subtype'),
    weeklyCredits: integer('weekly_credits').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }).notNull(),
    status: membershipStatusEnum('status').notNull().default('active'),
    lastCreditGrantAt: timestamp('last_credit_grant_at', { withTimezone: true, mode: 'date' }),
    nextCreditGrantAt: timestamp('next_credit_grant_at', { withTimezone: true, mode: 'date' }).notNull(),
    selfPurchased: boolean('self_purchased').notNull().default(false),
    acceptedTermsAt: timestamp('accepted_terms_at', { withTimezone: true, mode: 'date' }),
    acceptedWithdrawalWaiverAt: timestamp('accepted_withdrawal_waiver_at', { withTimezone: true, mode: 'date' }),
    purchaseIpAddress: varchar('purchase_ip_address', { length: 45 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    studioIdIdx: index('user_memberships_studio_id_idx').on(table.studioId),
    // Tenant-scoped active subscription lookups
    studioStatusIdx: index('user_memberships_studio_status_idx').on(table.studioId, table.status),
    userIdIdx: index('user_memberships_user_id_idx').on(table.userId),
    planIdIdx: index('user_memberships_plan_id_idx').on(table.planId),
    grantSweepIdx: index('user_memberships_grant_sweep_idx').on(table.status, table.nextCreditGrantAt),
    weeklyCreditsPositive: check('user_memberships_weekly_credits_positive', sql`${table.weeklyCredits} > 0`),
    endsAfterStarts: check('user_memberships_ends_after_starts', sql`${table.endsAt} > ${table.startedAt}`),
  }),
);
