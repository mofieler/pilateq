import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { studioMembershipRoleEnum, membershipStatusEnum } from './enums';
import { users } from './users.schema';
import { studios } from './studios.schema';

/**
 * Studio memberships — many-to-many bridge between users and studios.
 *
 * Replaces the implicit single-tenant mapping on users.studio_id. A user may
 * belong to multiple studios with a distinct role per studio.
 */
export const studioMemberships = pgTable(
  'studio_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    role: studioMembershipRoleEnum('role').notNull().default('student'),
    status: membershipStatusEnum('status').notNull().default('active'),
    invitedByUserId: uuid('invited_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userStudioUniqueIdx: uniqueIndex('studio_memberships_user_studio_unique_idx').on(
      table.userId,
      table.studioId,
    ),
    studioIdIdx: index('studio_memberships_studio_id_idx').on(table.studioId),
    userIdIdx: index('studio_memberships_user_id_idx').on(table.userId),
    roleIdx: index('studio_memberships_role_idx').on(table.role),
    statusIdx: index('studio_memberships_status_idx').on(table.status),
  }),
);

/**
 * Studio invites — token-based invitations to join a studio.
 *
 * Invites are created by existing studio members (typically owners/admins) and
 * redeemed by users who sign up or log in with the invited email address.
 */
export const studioInvites = pgTable(
  'studio_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: studioMembershipRoleEnum('role').notNull().default('student'),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    invitedByUserId: uuid('invited_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    tokenHashUniqueIdx: uniqueIndex('studio_invites_token_hash_unique_idx').on(table.tokenHash),
    studioIdIdx: index('studio_invites_studio_id_idx').on(table.studioId),
    tokenHashIdx: index('studio_invites_token_hash_idx').on(table.tokenHash),
    emailIdx: index('studio_invites_email_idx').on(table.email),
    expiresAtIdx: index('studio_invites_expires_at_idx').on(table.expiresAt),
  }),
);

// Convenience types
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
export type StudioMembership = InferSelectModel<typeof studioMemberships>;
export type NewStudioMembership = InferInsertModel<typeof studioMemberships>;
export type StudioInvite = InferSelectModel<typeof studioInvites>;
export type NewStudioInvite = InferInsertModel<typeof studioInvites>;
