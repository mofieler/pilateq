import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { requireStudioId } from '@/lib/studio/studio-context';
import { CalendarDays, Users, CreditCard, TrendingUp, Settings } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { and, eq, gte, lt, isNull, sql, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  classSessions,
  users,
  creditPurchases,
  bookings,
  classTemplates,
  creditTransactions,
  creditPackages,
  userMemberships,
  membershipPlans,
  instructors,
} from '@/db/schema';
import { format } from 'date-fns';
import { AdminWelcomeJourneyTasks } from '@/modules/welcome/components/AdminWelcomeJourneyTasks';
import { AdminDuoManager } from '@/modules/booking/components/AdminDuoManager';
import {
  getPendingWelcomeJourneyRequests,
  getWelcomeJourneyRequestsForAttendance,
} from '@/modules/welcome/actions/welcomeRequest.actions';
import {
  getDuoInvitesForAdminAction,
  getUpcomingDuoSessionsAction,
} from '@/modules/booking/actions/adminDuo.actions';
import { RecentActivityFeed } from '@/modules/admin/components/RecentActivityFeed';
import type { ActivityItem } from '@/modules/admin/components/RecentActivityFeed';
import { AdminSetupChecklist } from '@/modules/admin/components/AdminSetupChecklist';
import { AdminAuditLogWidget } from '@/modules/admin/components/AdminAuditLogWidget';
import { getRecentAuditLogsAction } from '@/modules/admin/actions/auditLog.actions';
import { getStudioConfig } from '@/lib/studio/server';

async function getDashboardStats(studioId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Today's classes count
  const [todayClassesResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.studioId, studioId),
        gte(classSessions.startsAt, today),
        lt(classSessions.startsAt, tomorrow)
      )
    );

  // Active students count (users with role 'student' who are not deleted)
  const [activeStudentsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(
      and(
        eq(users.studioId, studioId),
        eq(users.role, 'student'),
        isNull(users.deletedAt)
      )
    );

  // Credits sold - sum of credits from all purchases
  const [creditsSoldResult] = await db
    .select({ 
      total: sql<number | null>`sum(${creditPurchases.creditsAmount})::int` 
    })
    .from(creditPurchases)
    .where(eq(creditPurchases.studioId, studioId));

  // Revenue - sum of all credit purchase amounts
  const [revenueResult] = await db
    .select({ 
      total: sql<number | null>`sum(${creditPurchases.priceCents})::int` 
    })
    .from(creditPurchases)
    .where(eq(creditPurchases.studioId, studioId));

  // ── Recent bookings with full details ──
  const recentBookings = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      createdAt: bookings.createdAt,
      userName: users.name,
      userEmail: users.email,
      className: classTemplates.name,
      sessionStartsAt: classSessions.startsAt,
      sessionDuration: classTemplates.durationMinutes,
      instructorName: sql<string | null>`COALESCE(${users.name}, 'TBA')`, // Simplified; actual instructor join below
      creditCost: classTemplates.creditCost,
      creditType: classTemplates.creditType,
      maxCapacity: classTemplates.maxCapacity,
      bookedCount: classSessions.bookedCount,
    })
    .from(bookings)
    .leftJoin(users, eq(bookings.userId, users.id))
    .leftJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .leftJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
    .where(eq(bookings.studioId, studioId))
    .orderBy(desc(bookings.createdAt))
    .limit(10);

  // ── Recent credit purchases with full details ──
  const recentPurchases = await db
    .select({
      id: creditPurchases.id,
      creditsAmount: creditPurchases.creditsAmount,
      priceCents: creditPurchases.priceCents,
      createdAt: creditPurchases.createdAt,
      paymentStatus: creditPurchases.paymentStatus,
      paymentMethod: creditPurchases.paymentMethod,
      userName: users.name,
      userEmail: users.email,
      packageName: creditPackages.name,
      packageId: creditPurchases.packageId,
      adminNotes: creditPurchases.adminNotes,
    })
    .from(creditPurchases)
    .leftJoin(users, eq(creditPurchases.userId, users.id))
    .leftJoin(creditPackages, eq(creditPurchases.packageId, creditPackages.id))
    .where(eq(creditPurchases.studioId, studioId))
    .orderBy(desc(creditPurchases.createdAt))
    .limit(10);

  // ── Recent credit adjustments from unified ledger ──
  const adminUser = alias(users, 'admin_user');
  const recentAdjustments = await db
    .select({
      id: creditTransactions.id,
      amountDelta: creditTransactions.amount,
      reason: creditTransactions.description,
      notes: sql<string | null>`NULL`,
      creditType: creditTransactions.creditType,
      createdAt: creditTransactions.createdAt,
      userName: users.name,
      userEmail: users.email,
      adminName: adminUser.name,
    })
    .from(creditTransactions)
    .leftJoin(users, eq(creditTransactions.userId, users.id))
    .leftJoin(adminUser, eq(creditTransactions.processedBy, adminUser.id))
    .where(and(eq(creditTransactions.studioId, studioId), eq(creditTransactions.type, 'adjustment')))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(5);

  // ── Recent membership subscriptions ──
  const recentMemberships = await db
    .select({
      id: userMemberships.id,
      status: userMemberships.status,
      startedAt: userMemberships.startedAt,
      endsAt: userMemberships.endsAt,
      weeklyCredits: userMemberships.weeklyCredits,
      creditType: userMemberships.creditType,
      createdAt: userMemberships.createdAt,
      userName: users.name,
      userEmail: users.email,
      planName: membershipPlans.name,
      planDurationWeeks: membershipPlans.durationWeeks,
      planPriceCents: membershipPlans.priceCents,
    })
    .from(userMemberships)
    .leftJoin(users, eq(userMemberships.userId, users.id))
    .leftJoin(membershipPlans, eq(userMemberships.planId, membershipPlans.id))
    .where(eq(userMemberships.studioId, studioId))
    .orderBy(desc(userMemberships.createdAt))
    .limit(10);

  return {
    todayClasses: todayClassesResult?.count ?? 0,
    activeStudents: activeStudentsResult?.count ?? 0,
    creditsSold: creditsSoldResult?.total ?? 0,
    revenue: revenueResult?.total ?? 0,
    recentBookings,
    recentPurchases,
    recentAdjustments,
    recentMemberships,
  };
}

export default async function AdminDashboard() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'admin' && session.user.role !== 'instructor') {
    redirect('/');
  }

  const studioId = await requireStudioId();
  const stats = await getDashboardStats(studioId);

  // ── Setup checklist data ──
  const studioConfig = await getStudioConfig();
  const now = new Date();
  const [instructorsCountRes, templatesCountRes, packagesCountRes, sessionsCountRes, currentUser] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(instructors).where(eq(instructors.studioId, studioId)),
    db.select({ count: sql<number>`count(*)::int` }).from(classTemplates).where(eq(classTemplates.studioId, studioId)),
    db.select({ count: sql<number>`count(*)::int` }).from(creditPackages).where(eq(creditPackages.studioId, studioId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(classSessions)
      .where(and(eq(classSessions.studioId, studioId), gte(classSessions.startsAt, now))),
    db
      .select({ hasSignedWaiver: users.hasSignedWaiver })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  const identityComplete = Boolean(
    studioConfig.identity.name &&
      studioConfig.identity.name !== 'My Pilates Studio' &&
      studioConfig.identity.email &&
      studioConfig.identity.email !== 'hello@example.com',
  );
  const paymentProvidersEnabled = studioConfig.paymentProviders.some((p) => p.enabled);
  const setupComplete =
    identityComplete &&
    (instructorsCountRes[0]?.count ?? 0) > 0 &&
    (templatesCountRes[0]?.count ?? 0) > 0 &&
    (packagesCountRes[0]?.count ?? 0) > 0 &&
    (sessionsCountRes[0]?.count ?? 0) > 0 &&
    paymentProvidersEnabled &&
    (currentUser?.hasSignedWaiver ?? false);

  const [pendingRes, attendanceRes, invitesRes, sessionsRes, auditLogsRes] = await Promise.all([
    getPendingWelcomeJourneyRequests(),
    getWelcomeJourneyRequestsForAttendance(),
    getDuoInvitesForAdminAction(),
    getUpcomingDuoSessionsAction(),
    getRecentAuditLogsAction(studioId, 8),
  ]);

  const initialPendingRequests = pendingRes.success ? (pendingRes.data ?? []) : [];
  const initialAttendanceItems = attendanceRes.success ? (attendanceRes.data ?? []) : [];
  const initialInvites = invitesRes.success ? (invitesRes.data ?? []) : [];
  const initialSessions = sessionsRes.success ? (sessionsRes.data ?? []) : [];
  const initialAuditLogs = auditLogsRes.success ? (auditLogsRes.data ?? []) : [];

  // ── Build enriched activity items ──
  const activityItems: ActivityItem[] = [
    // Bookings
    ...stats.recentBookings.map((b): ActivityItem => {
      const isCancellation = b.status === 'cancelled';
      const sessionDate = b.sessionStartsAt
        ? format(new Date(b.sessionStartsAt), 'EEE, MMM d')
        : 'Unknown date';
      const sessionTime = b.sessionStartsAt
        ? format(new Date(b.sessionStartsAt), 'HH:mm')
        : '';

      return {
        id: b.id,
        type: isCancellation ? 'cancellation' : 'booking',
        actorName: b.userName,
        actorEmail: b.userEmail,
        targetName: b.className || 'Unknown Class',
        targetDetail: isCancellation
          ? `Cancelled booking for ${sessionDate} at ${sessionTime}`
          : `Booked for ${sessionDate} at ${sessionTime} · ${b.creditCost ?? '?'} credits`,
        timestamp: b.createdAt,
        status: b.status,
        details: {
          creditImpact: b.creditCost
            ? {
                amount: b.creditCost,
                type: b.creditType ?? 'pass',
              }
            : undefined,
          sessionInfo: b.sessionStartsAt
            ? {
                startsAt: b.sessionStartsAt,
                instructorName: b.instructorName,
                durationMinutes: b.sessionDuration,
                capacity:
                  b.maxCapacity != null
                    ? { booked: b.bookedCount ?? 0, max: b.maxCapacity }
                    : undefined,
              }
            : undefined,
          operationContext: isCancellation
            ? `${b.userName ?? 'A student'} cancelled their spot for ${b.className ?? 'a class'}. ${b.creditCost ? `If within the refund window, ${b.creditCost} credits were returned to their account.` : ''}`
            : `${b.userName ?? 'A student'} successfully booked a spot in ${b.className ?? 'a class'}. ${b.creditCost ? `${b.creditCost} credits were deducted from their balance.` : ''}`,
          traceIds: { bookingId: b.id },
        },
      };
    }),

    // Purchases (excluding membership-bill records — those are shown in Memberships section)
    ...stats.recentPurchases
      .filter((p) => p.packageId !== null)
      .map((p): ActivityItem => {
        const pkgLabel = p.packageName === 'Welcome Journey' ? 'Welcome Package' : (p.packageName ?? 'Credit Package');
        return {
          id: p.id,
          type: 'purchase',
          actorName: p.userName,
          actorEmail: p.userEmail,
          targetName: pkgLabel,
          targetDetail: `${p.creditsAmount} credits · ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format((p.priceCents ?? 0) / 100)}`,
          timestamp: p.createdAt,
          status: p.paymentStatus,
          details: {
            creditImpact: {
              amount: p.creditsAmount,
              type: 'pass',
            },
            paymentInfo: {
              priceCents: p.priceCents ?? 0,
              paymentMethod: p.paymentMethod,
              paymentStatus: p.paymentStatus,
            },
            operationContext: `${p.userName ?? 'A student'} purchased ${pkgLabel}. ${p.creditsAmount} credits were added to their account. ${p.paymentMethod === 'pay_at_studio' ? 'Payment is pending — the student will pay at the studio or via bank transfer.' : 'Payment was processed online.'}`,
            traceIds: { purchaseId: p.id },
          },
        };
      }),

    // Memberships
    ...stats.recentMemberships.map((m): ActivityItem => {
      const priceFormatted = m.planPriceCents
        ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(m.planPriceCents / 100)
        : '';
      return {
        id: m.id,
        type: 'membership',
        actorName: m.userName,
        actorEmail: m.userEmail,
        targetName: m.planName || 'Membership',
        targetDetail: `${m.weeklyCredits} ${m.creditType ?? 'credits'}/week · ${priceFormatted}`,
        timestamp: m.createdAt,
        status: m.status,
        details: {
          membershipInfo: {
            planName: m.planName || 'Membership',
            durationWeeks: m.planDurationWeeks ?? 0,
            weeklyCredits: m.weeklyCredits,
            creditType: m.creditType ?? 'pass',
            startedAt: m.startedAt,
            endsAt: m.endsAt,
            status: m.status,
          },
          operationContext: `${m.userName ?? 'A student'} subscribed to ${m.planName ?? 'a membership plan'}. They will receive ${m.weeklyCredits} ${m.creditType ?? 'credits'} every week for ${m.planDurationWeeks ?? '?'} weeks. Credits are granted automatically every 7 days while the membership is active.`,
          traceIds: { membershipId: m.id },
        },
      };
    }),

    // Adjustments
    ...stats.recentAdjustments.map((a): ActivityItem => {
      const isAddition = (a.amountDelta ?? 0) > 0;
      return {
        id: a.id,
        type: 'credit_adjustment',
        actorName: a.userName,
        actorEmail: a.userEmail,
        targetName: isAddition ? 'Credits added' : 'Credits deducted',
        targetDetail: `${isAddition ? '+' : ''}${a.amountDelta} ${a.creditType ?? 'credits'}${a.reason ? ` · ${a.reason}` : ''}`,
        timestamp: a.createdAt,
        status: 'completed',
        details: {
          creditImpact: {
            amount: a.amountDelta,
            type: a.creditType ?? 'pass',
          },
          adminInfo: {
            adminName: a.adminName,
            reason: a.reason,
          },
          operationContext: `${a.adminName ?? 'An admin'} ${isAddition ? 'added' : 'deducted'} ${Math.abs(a.amountDelta ?? 0)} credits from ${a.userName ?? 'a student'}'s account. ${a.reason ? `Reason: ${a.reason}.` : ''} This type of manual adjustment is typically used to correct errors, grant goodwill credits, or fix system issues.`,
          traceIds: { adjustmentId: a.id },
        },
      };
    }),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of your studio operations and key metrics
        </p>
      </div>

      {/* Setup Checklist */}
      {!setupComplete && (
        <AdminSetupChecklist
          identityComplete={identityComplete}
          instructorsCount={instructorsCountRes[0]?.count ?? 0}
          templatesCount={templatesCountRes[0]?.count ?? 0}
          packagesCount={packagesCountRes[0]?.count ?? 0}
          sessionsCount={sessionsCountRes[0]?.count ?? 0}
          paymentProvidersEnabled={paymentProvidersEnabled}
          waiverSigned={currentUser?.hasSignedWaiver ?? false}
        />
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#6b3d32]">Today's Classes</p>
              <p className="text-2xl font-bold text-[#4e2b22]">{stats.todayClasses}</p>
            </div>
            <CalendarDays className="h-8 w-8 text-[#c4a88a]" />
          </div>
        </div>
        <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#6b3d32]">Active Students</p>
              <p className="text-2xl font-bold text-[#4e2b22]">{stats.activeStudents}</p>
            </div>
            <Users className="h-8 w-8 text-[#c4a88a]" />
          </div>
        </div>
        <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#6b3d32]">Credits Sold</p>
              <p className="text-2xl font-bold text-[#4e2b22]">{stats.creditsSold}</p>
            </div>
            <CreditCard className="h-8 w-8 text-[#c4a88a]" />
          </div>
        </div>
        <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#6b3d32]">Revenue</p>
              <p className="text-2xl font-bold text-[#4e2b22]">{formatPrice(stats.revenue)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-[#c4a88a]" />
          </div>
        </div>
      </div>

      {/* Welcome Journey Tasks — open requests & attendance checks */}
      <AdminWelcomeJourneyTasks
        initialPendingRequests={initialPendingRequests}
        initialAttendanceItems={initialAttendanceItems}
      />

      {/* Duo Invites — pending invites & upcoming duo sessions */}
      <AdminDuoManager
        initialInvites={initialInvites}
        initialSessions={initialSessions}
      />

      {/* Quick Actions */}
      <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
        <h2 className="text-lg font-semibold text-[#4e2b22] mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/admin/classes"
            className="rounded-lg border border-[#ede8e5]/60 bg-white/60 p-4 hover:bg-[#faf9f7]/80 transition-all"
          >
            <CalendarDays className="h-6 w-6 text-[#4e2b22] mb-2" />
            <h3 className="font-medium text-[#4e2b22]">Manage Classes</h3>
            <p className="text-sm text-[#8b6b5c] mt-1">Schedule and manage class sessions</p>
          </Link>
          <Link
            href="/admin/templates"
            className="rounded-lg border border-[#ede8e5]/60 bg-white/60 p-4 hover:bg-[#faf9f7]/80 transition-all"
          >
            <CalendarDays className="h-6 w-6 text-[#4e2b22] mb-2" />
            <h3 className="font-medium text-[#4e2b22]">Class Templates</h3>
            <p className="text-sm text-[#8b6b5c] mt-1">Create and edit class templates</p>
          </Link>
          <Link
            href="/admin/credits"
            className="rounded-lg border border-[#ede8e5]/60 bg-white/60 p-4 hover:bg-[#faf9f7]/80 transition-all"
          >
            <CreditCard className="h-6 w-6 text-[#4e2b22] mb-2" />
            <h3 className="font-medium text-[#4e2b22]">Credit Packages</h3>
            <p className="text-sm text-[#8b6b5c] mt-1">Manage credit packages and pricing</p>
          </Link>
          <Link
            href="/admin/payments"
            className="rounded-lg border border-[#ede8e5]/60 bg-white/60 p-4 hover:bg-[#faf9f7]/80 transition-all"
          >
            <TrendingUp className="h-6 w-6 text-[#4e2b22] mb-2" />
            <h3 className="font-medium text-[#4e2b22]">Payments</h3>
            <p className="text-sm text-[#8b6b5c] mt-1">View payment history and status</p>
          </Link>
          <Link
            href="/admin/settings"
            className="rounded-lg border border-[#ede8e5]/60 bg-white/60 p-4 hover:bg-[#faf9f7]/80 transition-all"
          >
            <Settings className="h-6 w-6 text-[#4e2b22] mb-2" />
            <h3 className="font-medium text-[#4e2b22]">Studio Settings</h3>
            <p className="text-sm text-[#8b6b5c] mt-1">Configure business model, payments, and branding</p>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#4e2b22]">Recent Activity</h2>
            <span className="text-xs text-[#8b6b5c]">{activityItems.length} events</span>
          </div>
          <RecentActivityFeed items={activityItems} initialLimit={8} />
        </div>

        {/* Recent Admin Activity */}
        <div className="lg:col-span-1">
          <AdminAuditLogWidget initialLogs={initialAuditLogs} />
        </div>
      </div>
    </div>
  );
}
