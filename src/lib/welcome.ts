import { db } from '@/db';
import { users, bookings, classSessions, classTemplates } from '@/db/schema';
import { eq, isNull } from 'drizzle-orm';

// Same type used by credit.service.ts for transaction-scoped queries
type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Returns true if the user has already completed the Welcome Journey.
 * Used in purchase guards, booking guards, and UI filtering.
 */
export async function hasCompletedWelcome(
  userId: string,
  client: TxClient | typeof db = db,
): Promise<boolean> {
  const [user] = await client
    .select({ welcomeCompletedAt: users.welcomeCompletedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.welcomeCompletedAt != null;
}

/**
 * Marks the user as having completed the Welcome Journey.
 * Idempotent — safe to call multiple times.
 */
export async function markWelcomeCompleted(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ welcomeCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Checks whether a specific booking is the user's Welcome Journey booking.
 * Looks up the session's template and checks the is_welcome_journey flag.
 * Uses LEFT JOINs so a missing session or template safely returns false.
 */
export async function isWelcomeJourneyBooking(
  bookingId: string,
  client: TxClient | typeof db = db,
): Promise<boolean> {
  const [result] = await client
    .select({ isWelcomeJourney: classTemplates.isWelcomeJourney })
    .from(bookings)
    .leftJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .leftJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  return result?.isWelcomeJourney ?? false;
}
