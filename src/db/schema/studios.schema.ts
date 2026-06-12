import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { studioStatusEnum } from './enums';

/**
 * Studios / tenants table.
 *
 * One row per Pilates studio using the platform.
 * Studio-specific business rules live in `studio_settings` as validated JSONB.
 */
export const studios = pgTable(
  'studios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 63 }).notNull().unique(),
    name: varchar('name', { length: 120 }).notNull(),
    status: studioStatusEnum('status').notNull().default('onboarding'),

    // Regional defaults
    timezone: varchar('timezone', { length: 80 }).notNull().default('Europe/Berlin'),
    defaultLocale: varchar('default_locale', { length: 5 }).notNull().default('en'),

    // SaaS metadata
    planTier: varchar('plan_tier', { length: 40 }).notNull().default('starter'),
    customDomain: varchar('custom_domain', { length: 255 }).unique(),
    isCustomDomainVerified: boolean('is_custom_domain_verified').notNull().default(false),

    // Ownership: the user who created the studio row during onboarding.
    // Used to prevent any authenticated user from escalating to admin by
    // completing onboarding on an existing studio row.
    // FK to users(id) ON DELETE SET NULL is enforced in migration 0007.
    createdByUserId: uuid('created_by_user_id'),

    // Soft-delete
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    slugIdx: uniqueIndex('studios_slug_idx').on(table.slug),
    statusIdx: index('studios_status_idx').on(table.status),
    customDomainIdx: uniqueIndex('studios_custom_domain_idx').on(table.customDomain),
    createdByUserIdIdx: index('studios_created_by_user_id_idx').on(table.createdByUserId),
  }),
);

/**
 * Studio settings.
 *
 * Single row per studio. `configJson` stores the serialized StudioConfig object.
 * The application validates this against `studioConfigSchema` on read/write.
 */
export const studioSettings = pgTable(
  'studio_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' })
      .unique(),
    configJson: jsonb('config_json').notNull().default({}),

    // Encrypted provider credentials are stored separately so they can be
    // rotated without touching the main config document.
    encryptedCredentials: jsonb('encrypted_credentials').default({}),

    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    studioIdIdx: uniqueIndex('studio_settings_studio_id_idx').on(table.studioId),
  }),
);

// Convenience types
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
export type Studio = InferSelectModel<typeof studios>;
export type NewStudio = InferInsertModel<typeof studios>;
export type StudioSetting = InferSelectModel<typeof studioSettings>;
export type NewStudioSetting = InferInsertModel<typeof studioSettings>;
