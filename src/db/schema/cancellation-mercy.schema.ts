import { pgTable, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { bookings } from './bookings.schema';
import { studios } from './studios.schema';

// One row per late-cancellation that received "mercy" (refund despite <24h).
// Count per calendar month limits the user to MERCY_USES_PER_MONTH = 3.
// Replaces the legacy users.firstMercyUsed lifetime flag.
export const cancellationMercyUses = pgTable(
  'cancellation_mercy_uses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'cascade' }),
    // [FIX-3] RESTRICT — audit trail, never silently lost
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // SET NULL — keep the mercy record even if the booking is later purged
    bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
    // [FIX-2] tz-aware
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    // Count query: WHERE userId AND date_trunc('month', usedAt) = date_trunc('month', NOW())
    studioIdIdx: index('mercy_uses_studio_id_idx').on(t.studioId),
    userMonthIdx: index('mercy_uses_user_month_idx').on(t.studioId, t.userId, t.usedAt),
  }),
);
