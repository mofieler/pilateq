import { NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/db';
import {
  users,
  bookings,
  classSessions,
  classTemplates,
  creditTransactions,
  creditPurchases,
  creditPackages,
  userMemberships,
  membershipPlans,
} from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.user.studioId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const studioId = session.user.studioId;

  const [
    profileRows,
    bookingRows,
    transactionRows,
    purchaseRows,
    membershipRows,
  ] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        studioId: users.studioId,
        profileCompleted: users.profileCompleted,
        hasSignedWaiver: users.hasSignedWaiver,
        waiverSignedAt: users.waiverSignedAt,
        waiverVersion: users.waiverVersion,
        totalClassesAttended: users.totalClassesAttended,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.studioId, studioId)))
      .limit(1),

    db
      .select({
        booking: bookings,
        sessionStartsAt: classSessions.startsAt,
        sessionEndsAt: classSessions.endsAt,
        templateName: classTemplates.name,
        templateLocation: classTemplates.location,
        templateClassType: classTemplates.classType,
      })
      .from(bookings)
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
      .where(and(eq(bookings.userId, userId), eq(bookings.studioId, studioId)))
      .orderBy(desc(classSessions.startsAt)),

    db
      .select()
      .from(creditTransactions)
      .where(and(eq(creditTransactions.userId, userId), eq(creditTransactions.studioId, studioId)))
      .orderBy(desc(creditTransactions.createdAt)),

    db
      .select({
        purchase: creditPurchases,
        packageName: creditPackages.name,
      })
      .from(creditPurchases)
      .leftJoin(creditPackages, eq(creditPurchases.packageId, creditPackages.id))
      .where(and(eq(creditPurchases.userId, userId), eq(creditPurchases.studioId, studioId)))
      .orderBy(desc(creditPurchases.createdAt)),

    db
      .select({
        membership: userMemberships,
        planName: membershipPlans.name,
      })
      .from(userMemberships)
      .innerJoin(membershipPlans, eq(userMemberships.planId, membershipPlans.id))
      .where(and(eq(userMemberships.userId, userId), eq(userMemberships.studioId, studioId)))
      .orderBy(desc(userMemberships.startedAt)),
  ]);

  const profile = profileRows[0];
  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    profile: {
      ...profile,
      acceptedTerms: membershipRows
        .filter((m) => m.membership.acceptedTermsAt)
        .map((m) => ({
          planName: m.planName,
          acceptedTermsAt: m.membership.acceptedTermsAt,
          acceptedWithdrawalWaiverAt: m.membership.acceptedWithdrawalWaiverAt,
        })),
    },
    bookings: bookingRows.map(({ booking, ...session }) => ({
      ...booking,
      session,
    })),
    creditTransactions: transactionRows,
    purchases: purchaseRows.map(({ purchase, packageName }) => ({
      ...purchase,
      packageName,
    })),
    memberships: membershipRows.map(({ membership, planName }) => ({
      ...membership,
      planName,
    })),
  };

  return NextResponse.json(exportData, {
    headers: {
      'Content-Disposition': `attachment; filename="data-export-${userId}.json"`,
      'Content-Type': 'application/json',
    },
  });
}
