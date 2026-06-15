import { addDays } from 'date-fns';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { startOfStudioDay } from '@/lib/utils/date.utils';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { classSessions, classTemplates, waitlistEntries } from '@/db/schema';
import { auth } from '@/lib/auth/auth';
import { hasCompletedWelcome } from '@/lib/welcome';
import { BookingCalendar } from '@/modules/booking/components/BookingCalendar';
import type { ClassSessionCardProps } from '@/modules/booking/components/ClassSessionCard';
import { cancellationService } from '@/modules/booking/services/cancellation.service';
import { isSessionClassType, getAcceptedCreditTypes } from '@/lib/config/class-types';
import { creditService } from '@/modules/billing/services/credit.service';
import { requireStudioId } from '@/lib/studio/studio-context';
import { getStudioConfig } from '@/lib/studio/server';
import type { StudioConfig } from '@/lib/studio';

const DUO_CLASS_TYPES = new Set(['reformer_duo', 'mat_duo']);

async function getUpcomingSessions(
  userId: string,
  welcomed: boolean,
  config: StudioConfig,
): Promise<ClassSessionCardProps[]> {
  const today = startOfStudioDay();
  const cutoff = addDays(today, 14);

  const studioId = await requireStudioId();
  const [rows, mercyContext, allBalances, waitlistRows] = await Promise.all([
    db.query.classSessions.findMany({
      with: {
        template: true,
        instructor: { with: { user: true } },
        bookings: {
          where: (b, { and: dbAnd, eq: dbEq }) =>
            dbAnd(dbEq(b.userId, userId), dbEq(b.status, 'confirmed')),
          columns: { id: true, creditsSpent: true, bookedAt: true },
        },
      },
      where: and(
        gte(classSessions.startsAt, today),
        lt(classSessions.startsAt, cutoff),
        eq(classSessions.status, 'scheduled'),
        sql`NOT EXISTS (
          SELECT 1 FROM ${classTemplates} ct
          WHERE ct.id = ${classSessions.templateId}
            AND ct.is_welcome_journey = true
        )`,
      ),
      orderBy: (s, { asc }) => [asc(s.startsAt)],
    }),
    cancellationService.getMercyContext(userId),
    creditService.getAllBalances(studioId, userId),
    db
      .select({ sessionId: waitlistEntries.sessionId })
      .from(waitlistEntries)
      .where(
        and(
          eq(waitlistEntries.studioId, studioId),
          eq(waitlistEntries.userId, userId),
          eq(waitlistEntries.status, 'waiting'),
        ),
      ),
  ]);

  const waitlistedSessionIds = new Set(waitlistRows.map((r) => r.sessionId));

  const mercyUsesLeft = mercyContext.mercyUsesLeft;

  // Build a lookup of all user balances by credit type
  const balanceMap: Record<string, number> = {};
  for (const [creditType, balance] of Object.entries(allBalances)) {
    balanceMap[creditType] = balance;
  }

  return rows
    .map((s) => {
      const classType   = s.template?.classType ?? 'mat_group';
      const creditType  = (s.template?.creditType ?? 'pass') as ClassSessionCardProps['creditType'];
      const creditCost  = s.template?.creditCost ?? 1;

      // Pre-compute whether the user can afford this class based on compatible credit types
      const acceptedTypes = getAcceptedCreditTypes(classType);
      const totalCompatibleCredits = acceptedTypes.reduce(
        (sum, ct) => sum + (balanceMap[ct] ?? 0), 0
      );

      return {
        id:                  s.id,
        name:                s.template?.name ?? 'Unnamed Class',
        classType,
        startsAt:            s.startsAt,
        durationMinutes:     s.template?.durationMinutes ?? 60,
        instructorName:      s.instructor?.user?.name ?? 'TBA',
        instructorAvatarUrl: null,
        vibeTags:            (s.template?.vibeTags ?? []) as string[],
        bookedCount:         s.bookedCount,
        maxCapacity:         s.maxCapacity,
        creditCost,
        creditType,
        status:              s.status,
        isBookedByUser:      s.bookings.length > 0,
        bookingId:           s.bookings[0]?.id,
        creditsSpent:        s.bookings[0]?.creditsSpent,
        bookedAt:            s.bookings[0]?.bookedAt ?? null,
        rescheduledAt:       s.rescheduledAt ?? null,
        mercyUsesLeft,
        location:            s.template?.location ?? null,
        requiresWelcomeJourney: !welcomed && classType !== 'yoga',
        userCreditBalances:  balanceMap,
        canAfford:           totalCompatibleCredits >= creditCost,
        isOnWaitlist:        waitlistedSessionIds.has(s.id),
      };
    })
    // Hide private & duo sessions from unwelcomed users — they need Welcome Journey first
    .filter((s) => welcomed || !isSessionClassType(s.classType));
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function BookPage() {
  const authSession = await auth();
  const userId = authSession?.user?.id ?? '';
  const config = await getStudioConfig();

  // If the studio disabled Welcome Journey, treat everyone as welcomed.
  const welcomed = config.features.welcomeJourney
    ? (userId ? await hasCompletedWelcome(userId) : true)
    : true;
  const sessions = userId ? await getUpcomingSessions(userId, welcomed, config) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <h1 className="text-3xl font-bold text-[#4e2b22]">Book a Class</h1>
        <p className="mt-2 text-sm text-[#8b6b5c]">
          Browse and book sessions for the next two weeks
        </p>
      </div>

      {/* Banner for unwelcomed users — yoga is open, Pilates needs WJ */}
      {userId && !welcomed && (
        <div className="rounded-2xl border border-[#d4a574]/30 bg-[#d4a574]/10 p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#d4a574]/20 text-[#6b3d32]">
              <Star className="size-4" aria-hidden />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-[#4e2b22]">New here? Start with Yoga — or dive into Pilates!</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#6b3d32]">
                <strong>Yoga classes are open to everyone</strong> — no intro needed, just grab credits and book.
                For <strong>Reformer, Mat, Chair and other Pilates apparatus classes</strong>, please complete your Welcome Journey first so we can keep you safe and get the most out of every session.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <Link
                  href="/credits?tab=purchase"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#4e2b22] underline underline-offset-2 transition-opacity hover:opacity-70"
                >
                  1. Get Welcome Journey package →
                </Link>
                <Link
                  href="/welcome-journey"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#4e2b22] underline underline-offset-2 transition-opacity hover:opacity-70"
                >
                  2. Request your Welcome Journey slots →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Container */}
      <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#ede8e5]/60 p-6 backdrop-blur-xl shadow-[0_4px_20px_rgba(78,43,34,0.04)]">
        <BookingCalendar sessions={sessions} />
      </div>
    </div>
  );
}
