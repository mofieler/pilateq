import { pgTable, varchar, integer, timestamp, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const rateLimits = pgTable('rate_limits', {
  key: varchar('key', { length: 255 }).primaryKey(),
  attempts: integer('attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true, mode: 'date' }),
  backoffTier: integer('backoff_tier').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => ({
  attemptsNonNeg: check('rate_limits_attempts_nonneg', sql`${table.attempts} >= 0`),
  backoffTierNonNeg: check('rate_limits_backoff_tier_nonneg', sql`${table.backoffTier} >= 0`),
}));
