import { and, asc, eq, gte, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { AlertCircle, ArrowRightIcon, CreditCardIcon, CalendarDaysIcon, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { getMyWelcomeJourneyRequest } from '@/modules/welcome/actions/welcomeRequest.actions';
import { db } from '@/db';
import {
  bookings,
  classSessions,
  classTemplates,
  instructors,
  users,
} from '@/db/schema';
import { CreditBalanceDisplay } from '@/modules/users/components/CreditBalanceDisplay';
import type { CreditBalance } from '@/modules/users/components/CreditBalanceDisplay';
import { DashboardGreeting } from '@/modules/users/components/DashboardGreeting';
import { UpcomingBookingsList } from '@/modules/users/components/UpcomingBookingsList';
import type { UpcomingBooking } from '@/modules/users/components/UpcomingBookingsList';
import { StreakCard } from '@/modules/users/components/StreakCard';
import { OpenBillsCard } from '@/modules/billing/components/OpenBillsCard';
import { getUserBillingStatus } from '@/modules/billing/services/billingStatus.service';
import { MembershipStatusCard } from '@/modules/billing/components/MembershipStatusCard';
import { getMyMembershipAction } from '@/modules/billing/actions/membership.actions';
import { cancellationService } from '@/modules/booking/services/cancellation.service';
import { creditService } from '@/modules/billing/services/credit.service';
import { requireStudioId } from '@/lib/studio/studio-context';
import { getStudioConfig } from '@/lib/studio/server';
import { getUserStreak } from '@/modules/gamification/services/streak.service';
import { EmptyDashboard } from '@/modules/users/components/EmptyDashboard';
import { sql } from 'drizzle-orm';

async function getCreditBalances(studioId: string, userId: string): Promise<CreditBalance[]> {
  const [pass, matPass, reformerPass, session] = await Promise.all([
    creditService.getBalanceWithExpiry(studioId, userId, 'pass'),
    creditService.getBalanceWithExpiry(studioId, userId, 'mat_pass'),
    creditService.getBalanceWithExpiry(studioId, userId, 'reformer_pass'),
    creditService.getBalanceWithExpiry(studioId, userId, 'session'),
  ]);
  return [
    { creditType: 'pass', balance: pass.balance, expiresAt: pass.expiresAt },
    { creditType: 'mat_pass', balance: matPass.balance, expiresAt: matPass.expiresAt },
    { creditType: 'reformer_pass', balance: reformerPass.balance, expiresAt: reformerPass.expiresAt },
    { creditType: 'session', balance: session.balance, expiresAt: session.expiresAt },
  ];
}

async function getUserHasAnyBookings(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(bookings)
    .where(eq(bookings.userId, userId))
    .limit(1);
  return (row?.count ?? 0) > 0;
}

async function getUpcomingBookings(userId: string): Promise<UpcomingBooking[]> {
  // Alias the users table so we can join it twice-free
  // (once for the booking owner check — already filtered by userId —
  //  and once for the instructor's display name)
  const instructorUser = alias(users, 'instructor_user');

  const rows = await db
    .select({
      bookingId:        bookings.id,
      creditsSpent:     bookings.creditsSpent,
      creditType:       bookings.creditType,
      name:             classTemplates.name,
      classType:        classTemplates.classType,
      durationMinutes:  classTemplates.durationMinutes,
      location:         classTemplates.location,
      startsAt:         classSessions.startsAt,
      instructorName:   instructorUser.name,
      instructorAvatarUrl: instructors.avatarUrl,
    })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .leftJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
    .leftJoin(instructors, eq(classSessions.instructorId, instructors.id))
    .leftJoin(instructorUser, and(
      eq(instructors.userId, instructorUser.id),
      isNull(instructorUser.deletedAt),
    ))
    .where(
      and(
        eq(bookings.userId, userId),
        eq(bookings.status, 'confirmed'),
        gte(classSessions.startsAt, new Date()),
      ),
    )
    .orderBy(asc(classSessions.startsAt))
    .limit(10);

  return rows.map((r) => ({
    bookingId:          r.bookingId,
    creditsSpent:       r.creditsSpent,
    creditType:         r.creditType,
    name:               r.name ?? 'Unnamed Class',
    classType:          r.classType ?? 'mat_group',
    durationMinutes:    r.durationMinutes ?? 60,
    location:           r.location ?? null,
    startsAt:           r.startsAt,
    instructorName:     r.instructorName ?? null,
    instructorAvatarUrl: r.instructorAvatarUrl ?? null,
  }));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;
  const userName = session.user.name ?? session.user.email ?? 'there';

  const [studioId, config] = await Promise.all([requireStudioId(), getStudioConfig()]);
  const [user] = await db
    .select({
      hasSignedWaiver: users.hasSignedWaiver,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [
    balances, upcomingBookings, mercyContext, billing, membership, welcomeJourneyRes,
    streakData, hasAnyBookings,
  ] = await Promise.all([
    getCreditBalances(studioId, userId),
    getUpcomingBookings(userId),
    cancellationService.getMercyContext(userId),
    getUserBillingStatus(userId, studioId),
    getMyMembershipAction(),
    getMyWelcomeJourneyRequest(),
    getUserStreak(userId),
    getUserHasAnyBookings(userId),
  ]);

  return (
    <div className="space-y-10">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <DashboardGreeting name={firstName(userName)} />

      {/* ── Waiver reminder banner ─────────────────────────────────────────── */}
      {!user?.hasSignedWaiver && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-[0_4px_12px_rgba(120,80,20,0.08)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <AlertCircle className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-amber-900">Liability waiver required</h3>
              <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                Please sign the studio liability waiver before you can book classes.
              </p>
            </div>
          </div>
          <Link
            href="/waiver"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-bold text-amber-50 shadow-[0_4px_14px_rgba(120,80,20,0.25)] transition-all hover:bg-amber-800 hover:shadow-[0_6px_20px_rgba(120,80,20,0.35)] hover:-translate-y-0.5"
          >
            Sign waiver
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
      )}

      {/* ── Welcome Journey Offer Banner ────────────────────────────────────── */}
      {welcomeJourneyRes.success && welcomeJourneyRes.data?.request?.status === 'slots_offered' && (
        <div className="rounded-2xl border border-[#d4a574]/30 bg-gradient-to-r from-[#d4a574]/15 to-[#d4a574]/5 p-5 shadow-[0_4px_12px_rgba(212,165,116,0.08)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#d4a574]/20 text-[#6b3d32]">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#4e2b22]">Welcome Journey Slots Ready!</h3>
              <p className="mt-1 text-xs text-[#6b3d32] leading-relaxed">
                We've prepared private introduction time slot options for you. Please pick your slot now to complete your booking.
              </p>
            </div>
          </div>
          <Link
            href="/welcome-journey"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#4e2b22] px-4 py-2.5 text-xs font-bold text-[#faf9f7] shadow-[0_4px_14px_rgba(78,43,34,0.25)] transition-all hover:bg-[#6b3d32] hover:shadow-[0_6px_20px_rgba(78,43,34,0.35)] hover:-translate-y-0.5"
          >
            Choose Time Slot
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
      )}

      {/* ── Empty state onboarding ─────────────────────────────────────────── */}
      {!hasAnyBookings && (
        <EmptyDashboard
          studioName={config.identity.name}
          welcomeJourneyPending={welcomeJourneyRes.success && welcomeJourneyRes.data?.request?.status === 'pending'}
        />
      )}

      {/* ── Streak ─────────────────────────────────────────────────────────── */}
      <StreakCard
        streak={streakData.currentStreak}
        longestStreak={streakData.longestStreak}
        weeklyBreakdown={streakData.weeklyBreakdown.map((w: { weekLabel: string; attended: boolean }) => ({
          weekLabel: w.weekLabel,
          attended: w.attended,
        }))}
        personalRhythmDays={streakData.personalRhythmDays}
        graceDays={streakData.graceDays}
        daysSinceLastClass={streakData.daysSinceLastClass}
        graceRemaining={streakData.graceRemaining}
      />

      {/* ── Open bills ─────────────────────────────────────────────────────── */}
      <OpenBillsCard openBills={billing.openBills} />

      {/* ── Active membership ───────────────────────────────────────────────── */}
      <MembershipStatusCard membership={membership ?? null} />

      {/* ── Credits ────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-linear-to-br from-[#faf9f7]/80 to-[#ede8e5]/60 p-6 backdrop-blur-xl border border-[#ede8e5]/80 shadow-[0_4px_20px_rgba(78,43,34,0.04)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
              <CreditCardIcon className="size-4" aria-hidden />
            </span>
            <h2 className="text-lg font-semibold text-primary">Credit Balances</h2>
          </div>
          <Link
            href="/credits"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#4e2b22] px-4 py-2 text-xs font-semibold text-[#faf9f7] shadow-[0_4px_14px_rgba(78,43,34,0.25)] transition-all hover:bg-[#6b3d32] hover:shadow-[0_6px_20px_rgba(78,43,34,0.35)] hover:-translate-y-0.5"
          >
            Buy credits
            <ArrowRightIcon className="size-3.5" aria-hidden />
          </Link>
        </div>
        <CreditBalanceDisplay balances={balances} />
      </section>

      {/* ── Upcoming bookings ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
              <CalendarDaysIcon className="size-4" aria-hidden />
            </span>
            <h2 className="text-lg font-semibold text-primary">
              Upcoming Classes
              {upcomingBookings.length > 0 && (
                <span className="ml-2 rounded-full bg-success/20 px-2.5 py-0.5 text-xs font-semibold text-success">
                  {upcomingBookings.length}
                </span>
              )}
            </h2>
          </div>
          <Link
            href="/book"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary transition-colors"
          >
            Book a class
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        </div>
        <UpcomingBookingsList bookings={upcomingBookings} mercyUsesLeft={mercyContext.mercyUsesLeft} />
      </section>
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

