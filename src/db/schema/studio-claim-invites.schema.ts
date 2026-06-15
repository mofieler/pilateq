import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { studios } from './studios.schema';

/**
 * Invitation tokens for claiming/creating a studio.
 *
 * Security:
 *  - The raw token is only ever sent in the invite email/URL.
 *  - Only its SHA-256 hash is stored in the database.
 *  - Tokens are single-use and expire after a configurable window.
 *  - Optionally bound to a specific email address.
 */
export const studioClaimInvites = pgTable(
  'studio_claim_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // SHA-256 hash of the raw token shown in the invite URL.
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),

    // Optional: lock the invite to a specific recipient email.
    email: varchar('email', { length: 255 }),

    // Optional: pre-reserve a slug for the studio being claimed.
    studioSlug: varchar('studio_slug', { length: 63 }),

    // Free-form note for the superadmin (e.g. "Paquita onboarding").
    notes: text('notes'),

    invitedByUserId: uuid('invited_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    usedByUserId: uuid('used_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),

    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' })
      .notNull(),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex('studio_claim_invites_token_hash_idx').on(
      table.tokenHash,
    ),
    emailIdx: index('studio_claim_invites_email_idx').on(table.email),
    invitedByIdx: index('studio_claim_invites_invited_by_idx').on(
      table.invitedByUserId,
    ),
    expiresAtIdx: index('studio_claim_invites_expires_at_idx').on(
      table.expiresAt,
    ),
    usedAtIdx: index('studio_claim_invites_used_at_idx').on(table.usedAt),
  }),
);
