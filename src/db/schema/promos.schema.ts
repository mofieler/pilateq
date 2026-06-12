import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.schema';
import { creditPackages, creditPurchases } from './credits.schema';
import { studios } from './studios.schema';

export const promoCodes = pgTable(
  'promo_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 50 }).notNull().unique(),
    type: varchar('type', { length: 20 }).$type<'percentage' | 'fixed'>().notNull(),
    value: integer('value').notNull(), // percentage (e.g. 10 for 10%) or absolute cents (e.g. 500 for 5.00 EUR)
    maxUses: integer('max_uses'),
    currentUses: integer('current_uses').notNull().default(0),
    maxUsesPerUser: integer('max_uses_per_user').notNull().default(1),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    packageId: uuid('package_id').references(() => creditPackages.id, { onDelete: 'set null' }), // optional package restriction
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    studioIdIdx: index('promo_codes_studio_id_idx').on(table.studioId),
    codeIdx: index('promo_codes_code_idx').on(table.code),
    isActiveIdx: index('promo_codes_is_active_idx').on(table.isActive),
    studioCodeIdx: uniqueIndex('promo_codes_studio_code_idx').on(table.studioId, table.code),
    packageIdx: index('promo_codes_package_idx').on(table.packageId),
    valueNonNeg: check('promo_codes_value_nonneg', sql`${table.value} >= 0`),
    currentUsesNonNeg: check('promo_codes_current_uses_nonneg', sql`${table.currentUses} >= 0`),
    maxUsesPerUserPositive: check('promo_codes_max_uses_per_user_positive', sql`${table.maxUsesPerUser} > 0`),
  }),
);

export const promoUsages = pgTable(
  'promo_usages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    promoId: uuid('promo_id')
      .notNull()
      .references(() => promoCodes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    purchaseId: uuid('purchase_id')
      .notNull()
      .references(() => creditPurchases.id, { onDelete: 'cascade' }),
    appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    studioIdIdx: index('promo_usages_studio_id_idx').on(table.studioId),
    promoIdIdx: index('promo_usages_promo_id_idx').on(table.promoId),
    userIdIdx: index('promo_usages_user_id_idx').on(table.userId),
    purchaseIdIdx: index('promo_usages_purchase_id_idx').on(table.purchaseId),
  }),
);
