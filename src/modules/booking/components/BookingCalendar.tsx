'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import {
  isStudioSameDay,
  isStudioToday,
  startOfStudioDay,
} from '@/lib/utils/date.utils';
import { CalendarDaysIcon, CalendarX2Icon, LayoutListIcon } from 'lucide-react';
import { DateScroller, DATE_PARAM } from './DateScroller';
import { ClassSessionCard, type ClassSessionCardProps } from './ClassSessionCard';
import { BookingConfirmModal } from './BookingConfirmModal';
import { joinWaitlistAction } from '@/modules/booking/actions/joinWaitlist.action';
import { BookedClassModal } from './BookedClassModal';
import { WeekView, WeekNav } from './WeekView';
import { CancelBookingDialog } from '@/modules/users/components/CancelBookingButton';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BookingCalendarProps = {
  sessions: ClassSessionCardProps[];
};

type ViewMode = 'list' | 'week';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateParam(raw: string | null): Date {
  if (!raw) return startOfStudioDay();
  try {
    return parseISO(raw);
  } catch {
    return startOfStudioDay();
  }
}

// ─── View toggle ──────────────────────────────────────────────────────────────

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-[#ede8e5] p-0.5">
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={view === 'list'}
        className={[
          'flex items-center justify-center gap-1.5 rounded-lg px-3 sm:px-4 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2',
          view === 'list'
            ? 'bg-[#faf9f7] text-[#4e2b22] shadow-sm ring-1 ring-[#ede8e5]'
            : 'text-[#8b6b5c] hover:text-[#6b3d32] hover:bg-[#ede8e5]/20 active:bg-[#ede8e5]/40',
        ].join(' ')}
      >
        <LayoutListIcon className="size-4 sm:size-5" aria-hidden />
        <span className="hidden sm:inline">List</span>
        <span className="sm:hidden">List</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('week')}
        aria-pressed={view === 'week'}
        className={[
          'flex items-center justify-center gap-1.5 rounded-lg px-3 sm:px-4 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2',
          view === 'week'
            ? 'bg-[#faf9f7] text-[#4e2b22] shadow-sm ring-1 ring-[#ede8e5]'
            : 'text-[#8b6b5c] hover:text-[#6b3d32] hover:bg-[#ede8e5]/20 active:bg-[#ede8e5]/40',
        ].join(' ')}
      >
        <CalendarDaysIcon className="size-4 sm:size-5" aria-hidden />
        <span className="hidden sm:inline">Week</span>
        <span className="sm:hidden">Week</span>
      </button>
    </div>
  );
}

// ─── Session list (list view body) ────────────────────────────────────────────

function SessionList({
  sessions,
  onBook,
  onJoinWaitlist,
}: {
  sessions: ClassSessionCardProps[];
  onBook: (session: ClassSessionCardProps) => void;
  onJoinWaitlist: (sessionId: string) => void;
}) {
  const searchParams = useSearchParams();
  const selectedDate = parseDateParam(searchParams.get(DATE_PARAM));

  const filtered = sessions
    .filter((s) => isStudioSameDay(s.startsAt, selectedDate))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const dateHeading = isStudioToday(selectedDate)
    ? `Today · ${format(selectedDate, 'd MMMM')}`
    : format(selectedDate, 'EEEE · d MMMM');

  return (
    <div>
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-[#4e2b22]">{dateHeading}</h2>
        <span className="text-xs font-medium text-[#8b6b5c]">
          {filtered.length === 0
            ? 'No classes'
            : `${filtered.length} ${filtered.length === 1 ? 'class' : 'classes'}`}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyDay />
      ) : (
        <ul className="space-y-3">
          {filtered.map((session) => (
            <li key={session.id}>
              <ClassSessionCard
                {...session}
                onBook={() => onBook(session)}
                onJoinWaitlist={onJoinWaitlist}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyDay() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-[#ede8e5]/60 ring-1 ring-[#c4a88a]/20">
        <CalendarX2Icon className="size-8 text-[#c4a88a]" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-[#4e2b22]">No classes scheduled</p>
      <p className="mt-1.5 text-xs text-[#8b6b5c]">Try selecting another date</p>
    </div>
  );
}

function SessionListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="mb-5 flex items-baseline justify-between">
        <div className="h-4 w-32 animate-pulse rounded-lg bg-[#ede8e5]/60" />
        <div className="h-3 w-12 animate-pulse rounded-lg bg-[#ede8e5]/60" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-52 animate-pulse rounded-2xl bg-gradient-to-br from-[#ede8e5]/40 to-[#e5dfdb]/40" />
      ))}
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function BookingCalendar({ sessions }: BookingCalendarProps) {
  const [view, setView] = useState<ViewMode>('list');
  const [sessionToBook, setSessionToBook] = useState<ClassSessionCardProps | null>(null);
  const [bookedSession, setBookedSession] = useState<ClassSessionCardProps | null>(null);
  const [sessionToCancel, setSessionToCancel] = useState<ClassSessionCardProps | null>(null);
  const [waitlistedIds, setWaitlistedIds] = useState<Set<string>>(
    () => new Set(sessions.filter((s) => s.isOnWaitlist).map((s) => s.id))
  );

  function handleSessionClick(session: ClassSessionCardProps) {
    if (session.isBookedByUser) {
      setBookedSession(session);
    } else {
      setSessionToBook(session);
    }
  }

  async function handleJoinWaitlist(sessionId: string) {
    const result = await joinWaitlistAction({ sessionId });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setWaitlistedIds((prev) => new Set(prev).add(sessionId));
    toast.success('You\'re on the waitlist!', {
      description: `Position ${result.data?.position}. We'll notify you if a spot opens up.`,
    });
  }

  const sessionsWithWaitlist = sessions.map((s) => ({
    ...s,
    isOnWaitlist: s.isOnWaitlist || waitlistedIds.has(s.id),
  }));

  return (
    <div>
      {/*
        Persistent sticky header — always visible regardless of view.
        List mode: DateScroller fills the left side, toggle pinned right.
        Week mode: empty left side, toggle pinned right (week nav lives inside WeekView).
        -mx-6 breaks out of dashboard p-6; px-4 restores inner padding.
      */}
      <div className="sticky top-[57px] z-10 -mx-6 border-b border-[#ede8e5]/80 bg-[#faf9f7]/90 px-4 pb-3 pt-3 shadow-[0_4px_14px_rgba(78,43,34,0.04)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            {view === 'list' ? <DateScroller /> : <WeekNav />}
          </div>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* ── List view body ────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="pt-5 pb-10">
          <Suspense fallback={<SessionListSkeleton />}>
            <SessionList
              sessions={sessionsWithWaitlist}
              onBook={handleSessionClick}
              onJoinWaitlist={handleJoinWaitlist}
            />
          </Suspense>
        </div>
      )}

      {/* ── Week view body ────────────────────────────────────────────────────── */}
      {view === 'week' && (
        <div className="pt-4 pb-10">
          <WeekView
            sessions={sessionsWithWaitlist}
            onBook={handleSessionClick}
            onJoinWaitlist={handleJoinWaitlist}
          />
        </div>
      )}

      {/* ── Shared confirm modal (unbooked sessions) ──────────────────────────── */}
      <BookingConfirmModal
        session={sessionToBook}
        onClose={() => setSessionToBook(null)}
      />

      {/* ── Booked class modal (already-booked sessions) ────────────────────────── */}
      <BookedClassModal
        session={bookedSession}
        onClose={() => setBookedSession(null)}
        onCancel={setSessionToCancel}
      />

      {/* ── Standalone cancel booking dialog (avoids nesting AlertTemplates) ───── */}
      {sessionToCancel && (
        <CancelBookingDialog
          open={!!sessionToCancel}
          onOpenChange={(open) => !open && setSessionToCancel(null)}
          bookingId={sessionToCancel.bookingId!}
          className={sessionToCancel.name}
          startsAt={sessionToCancel.startsAt}
          creditsSpent={sessionToCancel.creditsSpent ?? sessionToCancel.creditCost}
          creditType={sessionToCancel.creditType}
          mercyUsesLeft={sessionToCancel.mercyUsesLeft ?? 0}
          rescheduledAt={sessionToCancel.rescheduledAt}
          bookedAt={sessionToCancel.bookedAt}
          classType={sessionToCancel.classType}
        />
      )}
    </div>
  );
}
