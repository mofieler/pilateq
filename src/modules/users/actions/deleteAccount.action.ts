'use server';

import { eq, and, gt, isNull } from 'drizzle-orm';
import { auth, signOut } from '@/lib/auth/auth';
import { db } from '@/db';
import { users, bookings, classSessions, creditPurchases, userMemberships, sessions } from '@/db/schema';
import { cancellationService } from '@/modules/booking/services/cancellation.service';
import { logSecurityEvent } from '@/lib/security/audit-logger';
import { getLogger } from '@/lib/logger';

const logger = getLogger('account-deletion');

export type DeleteAccountResult = { success: true } | { success: false; error: string };

/**
 * GDPR-compliant account deletion for the current session user.
 *
 * - Cancels future confirmed bookings and refunds credits where applicable.
 * - Soft-deletes the user row.
 * - Anonymises PII only when no financial records require retention.
 * - Retains bookings, purchases and invoices for legal/tax purposes.
 * - Signs the user out and logs the action.
 */
export async function deleteAccountAction(): Promise<DeleteAccountResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized.' };
  }

  const userId = session.user.id;

  const [user] = await db
    .select({ id: users.id, studioId: users.studioId, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!user?.studioId) {
    return { success: false, error: 'Account not found.' };
  }

  const now = new Date();

  // ── Cancel all future confirmed bookings (best-effort) ─────────────────────
  const futureBookings = await db
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .where(
      and(
        eq(bookings.userId, userId),
        eq(bookings.studioId, user.studioId),
        eq(bookings.status, 'confirmed'),
        gt(classSessions.startsAt, now),
      ),
    );

  const cancelledBookingIds: string[] = [];
  const failedCancellationIds: string[] = [];

  for (const { id } of futureBookings) {
    try {
      const result = await cancellationService.cancel(id, userId, 'Account deletion');
      if (result.success) {
        cancelledBookingIds.push(id);
      } else {
        failedCancellationIds.push(id);
      }
    } catch (err) {
      logger.warn({ err, userId, bookingId: id }, 'Failed to cancel booking during account deletion');
      failedCancellationIds.push(id);
    }
  }

  // ── Determine whether financial records require retaining billing PII ───────
  const [purchaseRow, membershipRow] = await Promise.all([
    db
      .select({ id: creditPurchases.id })
      .from(creditPurchases)
      .where(and(eq(creditPurchases.userId, userId), eq(creditPurchases.studioId, user.studioId)))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(and(eq(userMemberships.userId, userId), eq(userMemberships.studioId, user.studioId)))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  const hasFinancialRecords = !!purchaseRow || !!membershipRow;

  // ── Soft-delete (and anonymise if no financial records need retention) ─────
  const anonymisedEmail = `deleted-${user.id}@anonymized.local`;
  const updateValues = hasFinancialRecords
    ? {
        deletedAt: now,
        passwordHash: null as string | null,
        phone: null as string | null,
        avatarUrl: null as string | null,
        image: null as string | null,
        updatedAt: now,
      }
    : {
        deletedAt: now,
        name: 'Deleted User',
        email: anonymisedEmail,
        passwordHash: null as string | null,
        phone: null as string | null,
        avatarUrl: null as string | null,
        image: null as string | null,
        updatedAt: now,
      };

  await db.update(users).set(updateValues).where(eq(users.id, userId));

  // ── Sign the user out on all devices ───────────────────────────────────────
  await db.delete(sessions).where(eq(sessions.userId, userId));

  // ── Audit log ──────────────────────────────────────────────────────────────
  await logSecurityEvent({
    userId,
    studioId: user.studioId,
    action: 'account_deleted',
    resource: 'users',
    resourceId: userId,
    category: 'user_action',
    severity: 'critical',
    success: true,
    details: {
      anonymised: !hasFinancialRecords,
      cancelledBookings: cancelledBookingIds,
      failedCancellations: failedCancellationIds,
    },
  });

  // ── Clear the session cookie ───────────────────────────────────────────────
  try {
    await signOut({ redirect: false });
  } catch (err) {
    logger.warn({ err, userId }, 'signOut failed during account deletion');
  }

  return { success: true };
}
