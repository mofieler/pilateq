import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { intensityLevelEnum } from './enums';
import { users } from './users.schema';
import { studios } from './studios.schema';

export const instructors = pgTable(
  'instructors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    // [FIX-3] 'restrict' — prevents accidental user deletion while instructor records exist.
    // Soft-delete the user instead; this FK is the safety net.
    userId: uuid('user_id')
      .notNull()
      .unique()
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
    studioIdIdx: index('instructors_studio_id_idx').on(table.studioId),
    userIdIdx: uniqueIndex('instructors_user_id_idx').on(table.userId),
    isActiveIdx: index('instructors_is_active_idx').on(table.isActive),
    studioActiveIdx: index('instructors_studio_active_idx').on(table.studioId, table.isActive),
  }),
);
