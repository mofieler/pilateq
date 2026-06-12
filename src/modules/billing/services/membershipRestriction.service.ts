import { db } from '@/db';
import { userMemberships } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { isSessionClassType } from '@/lib/config/class-types';
import type { ClassType } from '@/lib/config/class-types';

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type MembershipRestrictionResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Check whether a user's active membership allows booking a given class type.
 *
 * Business rule:
 *   - If the user has no active membership → allowed.
 *   - If the membership has no sessionSubtype → allowed (group credits, or legacy session).
 *   - If the class is NOT a session class (private/duo) → allowed (group classes bypass).
 *   - If membership.sessionSubtype = 'private' → only mat_private / reformer_private allowed.
 *   - If membership.sessionSubtype = 'duo'     → only mat_duo / reformer_duo allowed.
 *
 * This is used by ALL booking entry points (single booking, duo invite acceptance,
 * admin booking, etc.) so the restriction is enforced in one place.
 */
export async function checkMembershipSessionRestriction(
  tx: TxClient,
  userId: string,
  classType: ClassType,
): Promise<MembershipRestrictionResult> {
  // Group classes are never restricted by a session membership.
  if (!isSessionClassType(classType)) {
    return { allowed: true };
  }

  const [membership] = await tx
    .select({ sessionSubtype: userMemberships.sessionSubtype })
    .from(userMemberships)
    .where(and(eq(userMemberships.userId, userId), eq(userMemberships.status, 'active')))
    .limit(1);

  if (!membership?.sessionSubtype) {
    return { allowed: true };
  }

  const isPrivateClass = classType === 'mat_private' || classType === 'reformer_private';
  const isDuoClass = classType === 'mat_duo' || classType === 'reformer_duo';

  if (membership.sessionSubtype === 'private' && !isPrivateClass) {
    return {
      allowed: false,
      reason: 'Your membership is for private sessions only. Duo sessions are not included.',
    };
  }

  if (membership.sessionSubtype === 'duo' && !isDuoClass) {
    return {
      allowed: false,
      reason: 'Your membership is for duo sessions only. Private sessions are not included.',
    };
  }

  return { allowed: true };
}
