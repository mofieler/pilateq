/**
 * Tenant isolation helpers.
 *
 * These helpers centralise the common "does resource X belong to studio Y?"
 * query that is repeated across server actions and services. Each helper
 * returns `true` only when the requested row exists and its `studioId`
 * matches the provided value.
 */

import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import {
  classSessions,
  classTemplates,
  bookings,
  creditPackages,
  creditPurchases,
  membershipPlans,
  users,
  welcomeJourneyRequests,
} from '@/db/schema';

export async function verifyClassSessionStudio(
  id: string,
  studioId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ studioId: classSessions.studioId })
    .from(classSessions)
    .where(and(eq(classSessions.id, id), eq(classSessions.studioId, studioId)))
    .limit(1);
  return !!row;
}

export async function verifyClassTemplateStudio(
  id: string,
  studioId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ studioId: classTemplates.studioId })
    .from(classTemplates)
    .where(and(eq(classTemplates.id, id), eq(classTemplates.studioId, studioId)))
    .limit(1);
  return !!row;
}

export async function verifyBookingStudio(
  id: string,
  studioId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ studioId: bookings.studioId })
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.studioId, studioId)))
    .limit(1);
  return !!row;
}

export async function verifyCreditPackageStudio(
  id: string,
  studioId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ studioId: creditPackages.studioId })
    .from(creditPackages)
    .where(and(eq(creditPackages.id, id), eq(creditPackages.studioId, studioId)))
    .limit(1);
  return !!row;
}

export async function verifyCreditPurchaseStudio(
  id: string,
  studioId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ studioId: creditPurchases.studioId })
    .from(creditPurchases)
    .where(and(eq(creditPurchases.id, id), eq(creditPurchases.studioId, studioId)))
    .limit(1);
  return !!row;
}

export async function verifyMembershipPlanStudio(
  id: string,
  studioId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ studioId: membershipPlans.studioId })
    .from(membershipPlans)
    .where(and(eq(membershipPlans.id, id), eq(membershipPlans.studioId, studioId)))
    .limit(1);
  return !!row;
}

/**
 * Verify a user belongs to the given studio and has not been soft-deleted.
 */
export async function verifyUserStudio(
  id: string,
  studioId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ studioId: users.studioId })
    .from(users)
    .where(and(eq(users.id, id), eq(users.studioId, studioId), isNull(users.deletedAt)))
    .limit(1);
  return !!row;
}

export async function verifyWelcomeJourneyRequestStudio(
  id: string,
  studioId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ studioId: welcomeJourneyRequests.studioId })
    .from(welcomeJourneyRequests)
    .where(and(eq(welcomeJourneyRequests.id, id), eq(welcomeJourneyRequests.studioId, studioId)))
    .limit(1);
  return !!row;
}
