import { and, desc, eq, isNull } from 'drizzle-orm';
import type { CreditType } from '@/lib/config/class-types';
import { alias } from 'drizzle-orm/pg-core';
import { isPast, addDays } from 'date-fns';

import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { requireStudioId } from '@/lib/studio/studio-context';
import { bookings, classSessions, classTemplates, instructors, users } from '@/db/schema';
import { BookingCard } from '@/modules/users/components/BookingCard';
import { cancellationService } from '@/modules/booking/services/cancellation.service';
import { WaitlistSection } from '@/modules/waitlist/components/WaitlistSection';
import { getMyWaitlistEntries } from '@/modules/waitlist/actions/waitlist.actions';
import { CalendarCheck, CalendarX, HistoryIcon, AlertCircle } from 'lucide-react';
import { BookingHistoryClient } from './components/BookingHistoryClient';

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingWithDetails = {
  bookingId: string;
  sessionId: string;
  status: 'confirmed' | 'cancelled' | 'attended' | 'no_show' | 'waitlisted';
  creditsSpent: number;
  creditType: CreditType;
  name: string;
  classType: 'reformer_group' | 'reformer_private' | 'reformer_duo' | 'mat_group' | 'mat_private' | 'mat_duo' | 'chair' | 'online' | 'sound_healing' | 'yoga';
  durationMinutes: number;
  location: string | null;
  startsAt: Date;
  instructorName: string | null;
  instructorAvatarUrl: string | null;
  isPast: boolean;
};

// ─── Data Fetchers ───────────────────────────────────────────────────────────

async function getUserBookings(userId: string, studioId: string): Promise<{
  upcoming: BookingWithDetails[];
  past: BookingWithDetails[];
}> {
  const instructorUser = alias(users, 'instructor_user');

  const rows = await db
    .select({
      bookingId: bookings.id,
      sessionId: classSessions.id,
      bookingStatus: bookings.status,
      creditsSpent: bookings.creditsSpent,
      creditType: bookings.creditType,
      name: classTemplates.name,
      classType: classTemplates.classType,
      durationMinutes: classTemplates.durationMinutes,
      location: classTemplates.location,
      startsAt: classSessions.startsAt,
      instructorName: instructorUser.name,
      instructorAvatarUrl: instructors.avatarUrl,
    })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .leftJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
    .leftJoin(instructors, eq(classSessions.instructorId, instructors.id))
    .leftJoin(
      instructorUser,
      and(eq(instructors.userId, instructorUser.id), isNull(instructorUser.deletedAt))
    )
    .where(and(eq(bookings.userId, userId), eq(bookings.studioId, studioId)))
    .orderBy(desc(classSessions.startsAt));

  const allBookings: BookingWithDetails[] = rows.map((r) => ({
    bookingId: r.bookingId,
    sessionId: r.sessionId,
    status: r.bookingStatus,
    creditsSpent: r.creditsSpent,
    creditType: r.creditType as BookingWithDetails['creditType'],
    name: r.name ?? 'Unnamed Class',
    classType: (r.classType ?? 'mat_group') as BookingWithDetails['classType'],
    durationMinutes: r.durationMinutes ?? 60,
    location: r.location ?? null,
    startsAt: r.startsAt,
    instructorName: r.instructorName ?? null,
    instructorAvatarUrl: r.instructorAvatarUrl ?? null,
    isPast: isPast(r.startsAt),
  }));

  return {
    upcoming: allBookings.filter((b) => !b.isPast && b.status !== 'cancelled'),
    past: allBookings.filter((b) => b.isPast || b.status === 'cancelled'),
  };
}



// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MyBookingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;
  const studioId = session.user.studioId ?? await requireStudioId();
  const { upcoming, past } = await getUserBookings(userId, studioId);
  const waitlistEntries = await getMyWaitlistEntries();
  const offeredCount = waitlistEntries.filter((e) => e.status === 'offered').length;
  const mercyContext = await cancellationService.getMercyContext(userId);
  const mercyUsesLeft = mercyContext.mercyUsesLeft;

  return (
    <div className="space-y-8">
      {/* Offered waitlist slots banner */}
      {offeredCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/60 p-4 shadow-[0_4px_12px_rgba(251,191,36,0.08)] flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="size-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {offeredCount} waitlist spot{offeredCount > 1 ? 's' : ''} available!
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              You have been offered a spot in a fully booked class. Book now before it expires.
            </p>
          </div>
          <a
            href="/book"
            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
          >
            Book now →
          </a>
        </div>
      )}
      {/* Header */}
      <div>
        <p className="text-sm font-medium text-[#6b3d32]">My Classes</p>
        <h1 className="mt-1">My Bookings</h1>
        <p className="mt-2 text-sm text-[#6b3d32]">
          View your upcoming classes and booking history
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-5">
          <p className="text-sm font-medium text-secondary">Upcoming</p>
          <p className="text-2xl font-bold text-primary">{upcoming.length}</p>
          <p className="text-xs text-muted">Classes booked</p>
        </div>
        <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-5">
          <p className="text-sm font-medium text-secondary">Past 30 Days</p>
          <p className="text-2xl font-bold text-primary">
            {past.filter((b) => b.startsAt > addDays(new Date(), -30)).length}
          </p>
          <p className="text-xs text-muted">Classes attended</p>
        </div>
        <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-5">
          <p className="text-sm font-medium text-secondary">Total</p>
          <p className="text-2xl font-bold text-primary">{upcoming.length + past.length}</p>
          <p className="text-xs text-muted">All-time bookings</p>
        </div>
      </div>

      {/* Upcoming Classes */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
              <CalendarCheck className="size-4" />
            </span>
            <h2 className="text-lg font-semibold text-primary">Upcoming Classes</h2>
          </div>
          <a
            href="/book"
            className="text-sm font-medium text-secondary hover:text-primary transition-colors"
          >
            Book a class →
          </a>
        </div>

        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#c4a88a]/30 bg-gradient-to-br from-[#faf9f7]/60 to-[#ede8e5]/30 py-14 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-[#ede8e5]/60 ring-1 ring-[#c4a88a]/20">
              <CalendarCheck className="size-8 text-[#c4a88a]" />
            </div>
            <p className="text-sm font-semibold text-primary">No upcoming classes</p>
            <p className="mt-1 text-sm text-muted">Head to the booking calendar to reserve a spot</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((booking) => (
              <BookingCard
                key={booking.bookingId}
                bookingId={booking.bookingId}
                sessionId={booking.sessionId}
                status={booking.status}
                creditsSpent={booking.creditsSpent}
                creditType={booking.creditType}
                name={booking.name}
                classType={booking.classType}
                durationMinutes={booking.durationMinutes}
                location={booking.location}
                startsAt={booking.startsAt}
                instructorName={booking.instructorName}
                mercyUsesLeft={mercyUsesLeft}
                isPast={false}
              />
            ))}
          </div>
        )}
      </section>

      {/* Waitlists */}
      {waitlistEntries.length > 0 && (
        <WaitlistSection entries={waitlistEntries} />
      )}

      {/* Past Classes */}
      <section>
        <div className="mb-4 flex items-center gap-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
            <HistoryIcon className="size-4" />
          </span>
          <h2 className="text-lg font-semibold text-primary">History</h2>
        </div>

        {past.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#c4a88a]/30 bg-gradient-to-br from-[#faf9f7]/60 to-[#ede8e5]/30 py-14 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-[#ede8e5]/60 ring-1 ring-[#c4a88a]/20">
              <CalendarX className="size-8 text-[#c4a88a]" />
            </div>
            <p className="text-sm font-semibold text-primary">No past classes</p>
            <p className="mt-1 text-sm text-muted">Your class history will appear here</p>
          </div>
        ) : (
          <BookingHistoryClient past={past} mercyUsesLeft={mercyUsesLeft} />
        )}
      </section>
    </div>
  );
}
