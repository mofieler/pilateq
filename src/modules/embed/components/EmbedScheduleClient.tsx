'use client';

import { useCallback, useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, addDays, startOfWeek, parseISO } from 'date-fns';
import { de as deLocale, enUS as enUSLocale, es as esLocale } from 'date-fns/locale';
import { ExternalLink, CalendarClock } from 'lucide-react';
import type { ClassSessionCardProps } from '@/modules/booking/components/ClassSessionCard';
import { WeekNav, WeekView } from '@/modules/booking/components/WeekView';
import { buildEmbedBookCtaUrl, buildEmbedSessionBookingUrl } from '@/modules/embed/lib/booking-links';
import { useStudioConfig } from '@/lib/studio';
import {
  formatStudioTime,
  isStudioSameDay,
  isStudioToday,
  startOfStudioDay,
} from '@/lib/utils/date.utils';
import { EmbedResizeReporter } from './EmbedResizeReporter';
import { EmbedTranslationContext, EMBED_TRANSLATIONS } from './EmbedTranslationContext';
import { getCalendarBlockClasses, getCalendarDotClass } from '@/lib/config/class-colors';

// ─── Constants ───

type ClassType = ClassSessionCardProps['classType'];

const DATE_FNS_LOCALES: Record<string, any> = {
  de: deLocale,
  en: enUSLocale,
  es: esLocale,
};

// ─── Helpers ───

function parseDateParam(raw: string | null): Date {
  if (!raw) return startOfStudioDay();
  try {
    return parseISO(raw);
  } catch {
    return startOfStudioDay();
  }
}

// ─── Sub-components ───

function EmbedDaySessionCard({
  session,
  onBook,
  t,
  hideSpots,
}: {
  session: ClassSessionCardProps;
  onBook: (s: ClassSessionCardProps) => void;
  t: (key: string, variables?: Record<string, string>) => string;
  hideSpots: boolean;
}) {
  const bg = getCalendarBlockClasses(session.classType);
  const dot = getCalendarDotClass(session.classType);
  const isCancelled = session.status === 'cancelled';
  const isBooked = session.isBookedByUser;
  const isFull = !isBooked && session.bookedCount >= session.maxCapacity;
  const spotsLeft = Math.max(0, session.maxCapacity - session.bookedCount);

  const statusText = isCancelled
    ? t('cancelled')
    : isBooked
      ? t('booked')
      : isFull
        ? t('full')
        : hideSpots
          ? ''
          : t('spotsFree', { spots: String(spotsLeft), max: String(session.maxCapacity) });

  const statusColor = isBooked
    ? 'text-[#4a7c4a] font-semibold bg-[#6b8e6b]/15 px-2 py-0.5 rounded-full'
    : isCancelled
      ? 'text-[#c45c4a] font-semibold bg-[#c45c4a]/10 px-2 py-0.5 rounded-full'
      : isFull
        ? 'text-[#c45c4a] font-semibold bg-[#c45c4a]/10 px-2 py-0.5 rounded-full'
        : 'text-[#8b6b5c] bg-[#ede8e5]/60 px-2 py-0.5 rounded-full';

  return (
    <div
      onClick={() => {
        if (!isCancelled) onBook(session);
      }}
      className={[
        'w-full rounded-2xl border p-4 text-left transition-all flex items-center justify-between gap-4 select-none',
        isCancelled ? 'opacity-40 cursor-default' : 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
        bg,
      ].join(' ')}
    >
      <div className="flex-1 min-w-0">
        {/* Time + Type */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className={`size-2 rounded-full shrink-0 ${dot}`} />
          <span className="text-xs font-bold tabular-nums">
            {formatStudioTime(session.startsAt)}
          </span>
          <span className="text-xs opacity-60">·</span>
          <span className="text-xs opacity-75">{session.durationMinutes} min</span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/40 border border-white/20">
            {t('classTypes.' + session.classType)}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold leading-snug mb-1 text-[#4e2b22]">
          {session.name}
        </h3>

        {/* Instructor & Credits */}
        <div className="flex items-center gap-3 text-xs text-[#8b6b5c] flex-wrap">
          <span>{session.instructorName}</span>
          <span className="opacity-60">·</span>
          <span>
            {session.creditCost} {session.creditType === 'session' ? t('sessionCredits') : t('credits')}
          </span>
        </div>
      </div>

      {/* Right side: Status and tap action */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        {statusText && (
          <span className={`text-[10px] font-semibold ${statusColor}`}>
            {statusText}
          </span>
        )}
        {!isCancelled && !isBooked && !isFull && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#faf9f7] bg-[#4e2b22] px-3 py-1.5 rounded-lg shadow-sm hover:bg-[#6b3d32] transition-colors">
            {t('bookNow')}
          </span>
        )}
      </div>
    </div>
  );
}

function EmbedDayViewInner({
  sessions,
  onBook,
  locale,
  hideSpots,
  t,
}: {
  sessions: ClassSessionCardProps[];
  onBook: (session: ClassSessionCardProps) => void;
  locale: string;
  hideSpots: boolean;
  t: (key: string, variables?: Record<string, string>) => string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedDate = parseDateParam(searchParams.get('date'));

  const fnsLocale = DATE_FNS_LOCALES[locale] || enUSLocale;
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const daySessions = sessions
    .filter((s) => isStudioSameDay(s.startsAt, selectedDate))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  function selectDay(day: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', format(day, 'yyyy-MM-dd'));
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      {/* 7-day compact grid - Fits perfectly on mobile screens without scroll */}
      <div className="grid grid-cols-7 gap-1 rounded-xl border border-[#ede8e5]/80 bg-[#faf9f7] p-1 shadow-[0_4px_12px_rgba(78,43,34,0.02)]">
        {weekDays.map((day) => {
          const current = isStudioToday(day);
          const selected = isStudioSameDay(day, selectedDate);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => selectDay(day)}
              className={[
                'flex flex-col items-center rounded-lg py-2 transition-all cursor-pointer',
                selected
                  ? 'bg-[#4e2b22] text-[#faf9f7] shadow-sm'
                  : current
                    ? 'bg-[#6b8e6b]/10 text-[#4a7c4a] hover:bg-[#6b8e6b]/20'
                    : 'text-[#8b6b5c] hover:bg-[#ede8e5]/60 hover:text-[#4e2b22]',
              ].join(' ')}
            >
              <span className="text-[9px] font-bold uppercase tracking-wider">
                {format(day, 'EEE', { locale: fnsLocale }).slice(0, 2)}
              </span>
              <span className="mt-1 text-sm font-bold tabular-nums">
                {format(day, 'd')}
              </span>
              {current && !selected && (
                <span className="mt-0.5 size-1 rounded-full bg-[#6b8e6b]" />
              )}
              {current && selected && (
                <span className="mt-0.5 size-1 rounded-full bg-[#c4a88a]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Day schedule vertical list */}
      <div className="space-y-3 pt-1">
        {daySessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-[#ede8e5] bg-[#faf9f7]/30">
            <span className="text-xs font-semibold text-[#8b6b5c]">{t('noClassesToday')}</span>
          </div>
        ) : (
          daySessions.map((session) => (
            <EmbedDaySessionCard
              key={session.id}
              session={session}
              onBook={onBook}
              t={t}
              hideSpots={hideSpots}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EmbedDayViewSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid grid-cols-7 gap-1 rounded-xl border border-[#ede8e5]/80 bg-[#faf9f7] p-1 animate-pulse">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center py-2 gap-1.5">
            <div className="h-2 w-6 rounded-md bg-[#ede8e5]/60" />
            <div className="h-4 w-4 rounded-md bg-[#ede8e5]/60" />
          </div>
        ))}
      </div>
      <div className="space-y-3 pt-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 w-full rounded-2xl bg-[#ede8e5]/30 animate-pulse border border-[#ede8e5]/50" />
        ))}
      </div>
    </div>
  );
}

function EmbedDayView(props: {
  sessions: ClassSessionCardProps[];
  onBook: (session: ClassSessionCardProps) => void;
  locale: string;
  hideSpots: boolean;
  t: (key: string, variables?: Record<string, string>) => string;
}) {
  return (
    <Suspense fallback={<EmbedDayViewSkeleton />}>
      <EmbedDayViewInner {...props} />
    </Suspense>
  );
}

// ─── Main Component ───

type Props = {
  sessions: ClassSessionCardProps[];
  bookingBaseUrl: string;
  locale?: string;
  hideSpots?: boolean;
};

export function EmbedScheduleClient({ sessions, bookingBaseUrl, locale = 'en', hideSpots = false }: Props) {
  const [customTranslations, setCustomTranslations] = useState<Record<string, string> | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');

  // Detect mobile screen on mount to default to day view
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      setViewMode(isMobile ? 'day' : 'week');
    }
  }, []);

  // Listen for custom translation messages from parent (so they can pipe Vue-i18n translations)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data && event.data.type === 'embed-translations') {
        if (event.data.translations) {
          setCustomTranslations(event.data.translations);
        }
      }
    }
    window.addEventListener('message', handleMessage);
    // Notify parent frame that the embed is ready to receive custom translations
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'embed-ready' }, '*');
    }
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleBook = useCallback((session: ClassSessionCardProps) => {
    const url = buildEmbedSessionBookingUrl(session.startsAt);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const bookCtaUrl = buildEmbedBookCtaUrl();
  const hasSessions = sessions.length > 0;

  const activeLocale = (locale.toLowerCase() === 'de' || locale.toLowerCase() === 'es') ? locale.toLowerCase() as 'de' | 'es' : 'en';
  const defaults = EMBED_TRANSLATIONS[activeLocale];

  const t = useCallback((key: string, variables?: Record<string, string>): string => {
    if (customTranslations && customTranslations[key]) {
      let val = customTranslations[key];
      if (variables) {
        Object.entries(variables).forEach(([k, v]) => {
          val = val.replace(`{${k}}`, v);
        });
      }
      return val;
    }
    if (key.startsWith('classTypes.')) {
      const typeKey = key.split('.')[1] as keyof typeof defaults.classTypes;
      return defaults.classTypes[typeKey] || EMBED_TRANSLATIONS.en.classTypes[typeKey] || typeKey;
    }
    let val = (defaults as any)[key] || (EMBED_TRANSLATIONS.en as any)[key] || key;
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        val = val.replace(`{${k}}`, v);
      });
    }
    return val;
  }, [customTranslations, defaults]);

  return (
    <EmbedTranslationContext.Provider value={{ locale: activeLocale, hideSpots, t }}>
      <EmbedResizeReporter>
        <div className="relative bg-[#faf9f7] text-[#4e2b22] select-none">
          <header className="border-b border-[#ede8e5]/80 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b6b5c]">
                  {t('weeklySchedule')}
                </p>
                <h1 className="mt-1 text-lg font-bold text-[#4e2b22] sm:text-xl">
                  {useStudioConfig().identity.name}
                </h1>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-[#6b3d32]">
                  {t('tapToBook', { url: bookingBaseUrl.replace(/^https?:\/\//, '') })}
                </p>
              </div>
              <a
                href={bookCtaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-br from-[#4e2b22] to-[#6b3d32] px-4 py-2.5 text-xs font-semibold text-[#faf9f7] shadow-[0_4px_14px_rgba(78,43,34,0.2)] transition hover:-translate-y-0.5 cursor-pointer"
              >
                {t('bookNow')}
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </header>

          {hasSessions ? (
            <>
              <div className="sticky top-0 z-10 border-b border-[#ede8e5]/60 bg-[#faf9f7]/95 px-4 py-2.5 backdrop-blur-md sm:px-5 flex flex-col gap-2.5">
                <WeekNav locale={activeLocale} />
                
                {/* Day / Week switch tab bar */}
                <div className="flex justify-center border-t border-[#ede8e5]/40 pt-2">
                  <div className="inline-flex rounded-xl bg-[#ede8e5]/40 p-0.5 border border-[#ede8e5]/60 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setViewMode('day')}
                      className={[
                        'rounded-lg px-4 py-1.5 text-xs font-bold transition-all cursor-pointer',
                        viewMode === 'day'
                          ? 'bg-[#faf9f7] text-[#4e2b22] shadow-sm'
                          : 'text-[#8b6b5c] hover:text-[#4e2b22]',
                      ].join(' ')}
                    >
                      {t('dayView')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('week')}
                      className={[
                        'rounded-lg px-4 py-1.5 text-xs font-bold transition-all cursor-pointer',
                        viewMode === 'week'
                          ? 'bg-[#faf9f7] text-[#4e2b22] shadow-sm'
                          : 'text-[#8b6b5c] hover:text-[#4e2b22]',
                      ].join(' ')}
                    >
                      {t('weekView')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-4 py-4 sm:px-5 sm:py-5">
                {viewMode === 'week' ? (
                  <WeekView sessions={sessions} onBook={handleBook} locale={activeLocale} hideSpots={hideSpots} />
                ) : (
                  <EmbedDayView
                    sessions={sessions}
                    onBook={handleBook}
                    locale={activeLocale}
                    hideSpots={hideSpots}
                    t={t}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="px-4 py-12 sm:px-5 sm:py-16">
              <div className="flex flex-col items-center text-center">
                {/* Decorative ring with icon */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 rounded-full bg-[#c4a88a]/20 blur-xl" />
                  <div className="relative flex size-20 items-center justify-center rounded-full border border-[#c4a88a]/30 bg-[#faf9f7] shadow-[0_4px_20px_rgba(196,168,138,0.15)]">
                    <CalendarClock className="size-9 text-[#c4a88a]" strokeWidth={1.5} />
                  </div>
                </div>

                <h2 className="text-xl font-bold text-[#4e2b22] sm:text-2xl">
                  {t('comingSoonTitle')}
                </h2>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#8b6b5c]">
                  {t('comingSoonSubtitle')}
                </p>

                {/* Subtle decorative dots */}
                <div className="mt-6 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#c4a88a]/40" />
                  <span className="size-1.5 rounded-full bg-[#c4a88a]/60" />
                  <span className="size-1.5 rounded-full bg-[#c4a88a]/40" />
                </div>
              </div>
            </div>
          )}

          <footer className="border-t border-[#ede8e5]/60 px-4 py-3 text-center text-[10px] text-[#8b6b5c] sm:px-5">
            {t('poweredBy')}{' '}
            <a
              href={bookingBaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#6b3d32] underline-offset-2 hover:underline"
            >
              {t('booking')}
            </a>
          </footer>
        </div>
      </EmbedResizeReporter>
    </EmbedTranslationContext.Provider>
  );
}
