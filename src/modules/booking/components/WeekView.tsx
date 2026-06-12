'use client';

import { Suspense, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  addDays,
  format,
  startOfWeek,
  parseISO,
} from 'date-fns';
import { de as deLocale, enUS as enUSLocale, es as esLocale } from 'date-fns/locale';
import {
  formatStudioTime,
  isStudioSameDay,
  isStudioToday,
  isStudioThisWeek,
  startOfStudioDay,
} from '@/lib/utils/date.utils';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { ClassSessionCardProps } from './ClassSessionCard';
import { DATE_PARAM } from './DateScroller';
import { useEmbedTranslation } from '@/modules/embed/components/EmbedTranslationContext';
import { getCalendarBlockClasses, getCalendarDotClass } from '@/lib/config/class-colors';
import { ClassTypeLegend } from './ClassTypeLegend';

const DATE_FNS_LOCALES: Record<string, any> = {
  de: deLocale,
  en: enUSLocale,
  es: esLocale,
};

function useTranslationFallback(propLocale?: string, propHideSpots?: boolean) {
  const embedCtx = useEmbedTranslation();
  
  const locale = propLocale || embedCtx?.locale || 'en';
  const hideSpots = propHideSpots !== undefined ? propHideSpots : (embedCtx?.hideSpots || false);
  const t = embedCtx?.t || ((key: string, variables?: Record<string, string>) => {
    if (key.startsWith('classTypes.')) {
      const typeKey = key.split('.')[1];
      const labels: Record<string, string> = {
        reformer_group:   'Reformer Group',
        reformer_private: 'Reformer Private',
        reformer_duo:     'Reformer Duo',
        mat_group:        'Mat Group',
        mat_private:      'Mat Private',
        mat_duo:          'Mat Duo',
        chair:            'Chair Pilates',
        online:           'Online',
        sound_healing:    'Sound Healing',
        yoga:             'Yoga',
      };
      return labels[typeKey] || typeKey;
    }

    const fallbacks: Record<string, string> = {
      cancelled: 'Cancelled',
      booked: '✓ Booked',
      full: 'Full · waitlist',
      spotsFree: '{spots} / {max} spots free',
      credits: 'Credits',
      sessionCredits: 'Session Credits',
      today: 'Today',
      previousWeek: 'Previous week',
      nextWeek: 'Next week',
    };
    let val = fallbacks[key] || key;
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        val = val.replace(`{${k}}`, v);
      });
    }
    return val;
  });

  return { locale, hideSpots, t };
}

// ─── Week header nav (used in sticky header of BookingCalendar) ───────────────

function WeekNavInner({ locale: propLocale }: { locale?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedDate = parseDateParam(searchParams.get(DATE_PARAM));
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const isCurrentWeek = isStudioThisWeek(weekStart);

  const { locale, t } = useTranslationFallback(propLocale);
  const fnsLocale = DATE_FNS_LOCALES[locale] || enUSLocale;

  function navigate(weeks: -1 | 1) {
    const newDate = addDays(weekStart, weeks * 7);
    const params = new URLSearchParams(searchParams.toString());
    params.set(DATE_PARAM, format(newDate, 'yyyy-MM-dd'));
    router.push(`?${params.toString()}`, { scroll: false });
  }

  function jumpToToday() {
    const params = new URLSearchParams(searchParams.toString());
    params.set(DATE_PARAM, format(startOfStudioDay(), 'yyyy-MM-dd'));
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-1 py-1">
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label={t('previousWeek')}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#ede8e5] text-[#8b6b5c] transition-all hover:bg-[#ede8e5]/60 hover:text-[#4e2b22] active:scale-95"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
      </button>

      {/* Single-row center: date + optional Today pill — never wraps to a second line */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
        <span className="text-sm font-semibold text-[#4e2b22] tabular-nums whitespace-nowrap">
          {format(weekStart, locale === 'de' ? 'd. MMM' : 'd MMM', { locale: fnsLocale })}–{format(addDays(weekStart, 6), locale === 'de' ? 'd. MMM' : 'd MMM', { locale: fnsLocale })}
        </span>
        {!isCurrentWeek && (
          <button
            type="button"
            onClick={jumpToToday}
            className="shrink-0 rounded-full border border-[#6b8e6b]/40 bg-[#6b8e6b]/10 px-2 py-0.5 text-[10px] font-semibold text-[#4a7c4a] transition-all hover:bg-[#6b8e6b]/20 active:scale-95"
          >
            {t('today')}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate(1)}
        aria-label={t('nextWeek')}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#ede8e5] text-[#8b6b5c] transition-all hover:bg-[#ede8e5]/60 hover:text-[#4e2b22] active:scale-95"
      >
        <ChevronRightIcon className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function WeekNavSkeleton() {
  return (
    <div className="flex items-center gap-1 py-1">
      <div className="size-10 animate-pulse rounded-xl bg-[#ede8e5]/60" />
      <div className="flex-1 h-4 animate-pulse rounded-lg bg-[#ede8e5]/60 mx-4" />
      <div className="size-10 animate-pulse rounded-xl bg-[#ede8e5]/60" />
    </div>
  );
}

export function WeekNav({ locale }: { locale?: string }) {
  return (
    <Suspense fallback={<WeekNavSkeleton />}>
      <WeekNavInner locale={locale} />
    </Suspense>
  );
}

// ─── Colour map ───────────────────────────────────────────────────────────────

type ClassType = ClassSessionCardProps['classType'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateParam(raw: string | null): Date {
  if (!raw) return startOfStudioDay();
  try { return parseISO(raw); } catch { return startOfStudioDay(); }
}

// ─── Session block ────────────────────────────────────────────────────────────

const CREDIT_LABEL_SHORT: Record<string, string> = {
  pass:          'Credits',
  mat_pass:      'Mat Credits',
  reformer_pass: 'Reformer Credits',
  session:       'Session Credits',
};

function getDurationHeightClass(durationMinutes: number): string {
  if (durationMinutes <= 30) return 'h-[76px]';
  if (durationMinutes <= 45) return 'h-[92px]';
  if (durationMinutes <= 60) return 'h-[108px]';
  if (durationMinutes <= 75) return 'h-[124px]';
  if (durationMinutes <= 90) return 'h-[140px]';
  return 'h-[156px]';
}

function SessionBlock({
  session,
  onClick,
  onJoinWaitlist,
  locale: propLocale,
  hideSpots: propHideSpots,
}: {
  session: ClassSessionCardProps;
  onClick: (s: ClassSessionCardProps) => void;
  onJoinWaitlist?: (sessionId: string) => void;
  locale?: string;
  hideSpots?: boolean;
}) {
  const bg = getCalendarBlockClasses(session.classType);
  const dot = getCalendarDotClass(session.classType);
  const isCancelled = session.status === 'cancelled';
  const isBooked = session.isBookedByUser;
  const isFull = !isBooked && session.bookedCount >= session.maxCapacity;
  const isOnWaitlist = session.isOnWaitlist ?? false;
  const spotsLeft = Math.max(0, session.maxCapacity - session.bookedCount);

  const { hideSpots, t } = useTranslationFallback(propLocale, propHideSpots);

  // Bottom status line — always rendered to keep all cards the same height
  const statusText = isCancelled
    ? t('cancelled')
    : isBooked
      ? t('booked')
      : isOnWaitlist
        ? 'On waitlist'
        : isFull
          ? t('full')
          : hideSpots
            ? '\u00A0'
            : t('spotsFree', { spots: String(spotsLeft), max: String(session.maxCapacity) });

  const statusColor = isBooked
    ? 'text-[#4a7c4a] font-semibold'
    : isFull || isCancelled
      ? 'opacity-50'
      : 'opacity-60';

  const heightClass = getDurationHeightClass(session.durationMinutes);

  function handleClick() {
    if (isCancelled) return;
    if (isFull && !isOnWaitlist && onJoinWaitlist) {
      onJoinWaitlist(session.id);
      return;
    }
    onClick(session);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isCancelled}
      className={[
        'w-full rounded-lg border px-2.5 py-2 text-left transition-all',
        'flex flex-col',
        heightClass,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22]/20 focus-visible:ring-offset-1',
        bg,
        isCancelled ? 'opacity-40 cursor-default' : 'cursor-pointer',
        isBooked ? 'ring-1 ring-[#6b8e6b]' : '',
        isOnWaitlist ? 'ring-1 ring-[#c4a88a]' : '',
      ].join(' ')}
      aria-label={`${session.name} at ${formatStudioTime(session.startsAt)}`}
    >
      {/* Dot + time */}
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`size-1.5 rounded-full shrink-0 ${dot} ${isCancelled ? 'opacity-50' : ''}`} />
        <p className="text-[10px] font-semibold tabular-nums leading-none opacity-70">
          {formatStudioTime(session.startsAt)}
          {' · '}
          {session.durationMinutes}m
        </p>
      </div>

      {/* Class name — always 2 lines max so height stays stable */}
      <p className="mt-1 text-xs font-bold leading-snug line-clamp-2 flex-1">
        {session.name}
      </p>

      {/* Credit cost */}
      <p className="mt-1 text-[10px] opacity-60">
        {session.creditCost} {session.creditType === 'session' ? t('sessionCredits') : t('credits')}
      </p>

      {/* Status line — always present, keeps all cards the same height */}
      <p className={`mt-1 text-[10px] ${statusColor}`}>
        {statusText}
      </p>
    </button>
  );
}

// ─── Inner (requires Suspense for useSearchParams) ────────────────────────────

function WeekViewInner({
  sessions,
  onBook,
  onJoinWaitlist,
  locale: propLocale,
  hideSpots: propHideSpots,
}: {
  sessions: ClassSessionCardProps[];
  onBook: (session: ClassSessionCardProps) => void;
  onJoinWaitlist?: (sessionId: string) => void;
  locale?: string;
  hideSpots?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // router used for selectDay navigation
  const selectedDate = parseDateParam(searchParams.get(DATE_PARAM));
  const scrollRef = useRef<HTMLDivElement>(null);

  const { locale, hideSpots, t } = useTranslationFallback(propLocale, propHideSpots);
  const fnsLocale = DATE_FNS_LOCALES[locale] || enUSLocale;

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Auto-scroll: center today if visible, otherwise scroll to start
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const todayEl = container.querySelector<HTMLElement>('[data-today]');
    if (todayEl) {
      const left = todayEl.offsetLeft - container.offsetWidth / 2 + todayEl.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, left), behavior: 'instant' });
    } else {
      container.scrollTo({ left: 0, behavior: 'instant' });
    }
  }, [weekStart]);

  function selectDay(day: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(DATE_PARAM, format(day, 'yyyy-MM-dd'));
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div>
      {/* 7-column grid — horizontally scrollable, no visible scrollbar */}
      <div className="relative">
        {/* Left fade hint */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-white/60 to-transparent z-10 rounded-l-xl" />
        {/* Right fade hint */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-white/60 to-transparent z-10 rounded-r-xl" />

        <div
          ref={scrollRef}
          className="overflow-x-auto rounded-xl border border-[#ede8e5]/80 bg-[#faf9f7] shadow-[0_4px_14px_rgba(78,43,34,0.04)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex min-w-[700px] divide-x divide-[#ede8e5]/60">
            {weekDays.map((day) => {
              const current = isStudioToday(day);
              const selected = isStudioSameDay(day, selectedDate);
              const daySessions = sessions
                .filter((s) => isStudioSameDay(s.startsAt, day))
                .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

              return (
                <div
                  key={day.toISOString()}
                  {...(current ? { 'data-today': '' } : {})}
                  className={[
                    'flex min-w-0 flex-1 flex-col',
                    current ? 'bg-[#6b8e6b]/5' : 'bg-[#faf9f7]',
                  ].join(' ')}
                >
                  {/* Day header */}
                  <button
                    type="button"
                    onClick={() => selectDay(day)}
                    className={[
                      'group flex flex-col items-center border-b px-1 py-2.5 transition-all',
                      current ? 'border-[#6b8e6b]/20 hover:bg-[#6b8e6b]/10' : 'border-[#ede8e5]/60 hover:bg-[#ede8e5]/40',
                      selected && !current ? 'bg-[#ede8e5]/60' : '',
                    ].join(' ')}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest ${
                        current ? 'text-[#6b8e6b]' : 'text-[#8b6b5c] group-hover:text-[#6b3d32]'
                      }`}
                    >
                      {format(day, 'EEE', { locale: fnsLocale })}
                    </span>
                    <span
                      className={`mt-1 flex size-7 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors ${
                        current
                          ? 'bg-[#4e2b22] text-[#faf9f7]'
                          : selected
                            ? 'bg-[#4e2b22] text-[#faf9f7]'
                            : 'text-[#4e2b22] group-hover:bg-[#ede8e5]'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    <span
                      className={[
                        'mt-1 size-1 rounded-full',
                        current ? 'bg-[#6b8e6b]' : 'bg-transparent',
                      ].join(' ')}
                      aria-hidden
                    />
                  </button>

                  {/* Session blocks */}
                  <div className="flex flex-col gap-1.5 pt-1.5 px-1.5">
                    {daySessions.length === 0 ? (
                      <div className="flex items-center justify-center py-6">
                        <span className="text-[10px] font-medium text-[#c4a88a]/50">–</span>
                      </div>
                    ) : (
                      daySessions.map((session) => (
                        <SessionBlock
                          key={session.id}
                          session={session}
                          onClick={onBook}
                          onJoinWaitlist={onJoinWaitlist}
                          locale={locale}
                          hideSpots={hideSpots}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4">
        <ClassTypeLegend locale={locale} />
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function WeekViewSkeleton() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="size-9 animate-pulse rounded-xl bg-[#ede8e5]/60" />
        <div className="h-4 w-36 animate-pulse rounded-lg bg-[#ede8e5]/60" />
        <div className="size-9 animate-pulse rounded-xl bg-[#ede8e5]/60" />
      </div>
      <div className="overflow-hidden rounded-xl border border-[#ede8e5]/60 bg-[#faf9f7] shadow-sm" aria-hidden>
        <div className="flex min-w-[700px] divide-x divide-[#ede8e5]/40">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col">
              <div className="flex flex-col items-center border-b border-[#ede8e5]/40 py-2.5 gap-1.5">
                <div className="h-2.5 w-6 animate-pulse rounded-md bg-[#ede8e5]/60" />
                <div className="size-7 animate-pulse rounded-full bg-[#ede8e5]/60" />
              </div>
              <div className="flex flex-col gap-1.5 p-1.5">
                {i % 3 !== 2 && (
                  <div className="h-16 animate-pulse rounded-lg bg-[#ede8e5]/40" />
                )}
                {i % 4 === 0 && (
                  <div className="h-14 animate-pulse rounded-lg bg-[#ede8e5]/40" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export type WeekViewProps = {
  sessions: ClassSessionCardProps[];
  onBook: (session: ClassSessionCardProps) => void;
  onJoinWaitlist?: (sessionId: string) => void;
  locale?: string;
  hideSpots?: boolean;
};

export function WeekView({ sessions, onBook, onJoinWaitlist, locale, hideSpots }: WeekViewProps) {
  return (
    <Suspense fallback={<WeekViewSkeleton />}>
      <WeekViewInner
        sessions={sessions}
        onBook={onBook}
        onJoinWaitlist={onJoinWaitlist}
        locale={locale}
        hideSpots={hideSpots}
      />
    </Suspense>
  );
}
