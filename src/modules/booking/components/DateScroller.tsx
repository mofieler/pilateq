'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addDays, format, parseISO } from 'date-fns';
import {
  isStudioSameDay,
  isStudioToday,
  startOfStudioDay,
} from '@/lib/utils/date.utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_AHEAD = 14;
export const DATE_PARAM = 'date';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDays(): Date[] {
  const today = startOfStudioDay();
  return Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
}

function parseDateParam(raw: string | null): Date {
  if (!raw) return startOfStudioDay();
  try {
    return parseISO(raw);
  } catch {
    return startOfStudioDay();
  }
}

// ─── Inner component (useSearchParams requires Suspense) ──────────────────────

function DateScrollerInner({ onChange }: { onChange?: (date: Date) => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const days = buildDays();
  const raw = searchParams.get(DATE_PARAM);
  const selectedDate = parseDateParam(raw);
  const selectedKey = format(selectedDate, 'yyyy-MM-dd');

  // Track button elements by date key for scrollIntoView
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Scroll selected day into view whenever the selection changes
  useEffect(() => {
    buttonRefs.current
      .get(selectedKey)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedKey]);

  function handleSelect(day: Date) {
    const key = format(day, 'yyyy-MM-dd');
    const params = new URLSearchParams(searchParams.toString());
    params.set(DATE_PARAM, key);
    router.push(`?${params.toString()}`, { scroll: false });
    onChange?.(day);
  }

  return (
    <div
      className="flex gap-0.5 overflow-x-auto py-1 [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none' }}
      aria-label="Select a date"
    >
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const isSelected = isStudioSameDay(day, selectedDate);
        const isCurrentDay = isStudioToday(day);

        return (
          <button
            key={key}
            ref={(el) => {
              if (el) buttonRefs.current.set(key, el);
              else buttonRefs.current.delete(key);
            }}
            type="button"
            aria-label={format(day, 'EEEE, MMMM d')}
            aria-pressed={isSelected}
            onClick={() => handleSelect(day)}
            className={[
              'flex min-w-[46px] flex-col items-center gap-1.5 rounded-xl px-2 py-2.5',
              'transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22]/20 focus-visible:ring-offset-1',
              isSelected
                ? 'bg-[#4e2b22] shadow-lg shadow-[#4e2b22]/20'
                : 'hover:bg-[#ede8e5]/60 active:bg-[#ede8e5]',
            ].join(' ')}
          >
            {/* Day abbreviation */}
            <span
              className={[
                'text-[10px] font-semibold leading-none tracking-wider uppercase',
                isSelected ? 'text-[#faf9f7]/80' : 'text-[#8b6b5c]',
              ].join(' ')}
            >
              {format(day, 'EEE')}
            </span>

            {/* Day number */}
            <span
              className={[
                'text-[15px] font-bold leading-none tabular-nums',
                isSelected
                  ? 'text-[#faf9f7]'
                  : isCurrentDay
                    ? 'text-[#4e2b22]'
                    : 'text-[#4e2b22]',
              ].join(' ')}
            >
              {format(day, 'd')}
            </span>

            {/* Today dot — always occupies space to prevent layout shift */}
            <span
              className={[
                'size-1.5 rounded-full',
                isCurrentDay
                  ? isSelected
                    ? 'bg-[#c4a88a]'
                    : 'bg-[#6b8e6b]'
                  : 'invisible',
              ].join(' ')}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

// ─── Skeleton (shown during Suspense) ─────────────────────────────────────────

function DateScrollerSkeleton() {
  return (
    <div className="flex gap-0.5 overflow-hidden py-1" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex min-w-[46px] animate-pulse flex-col items-center gap-1.5 rounded-xl px-2 py-2.5"
        >
          <div className="h-2.5 w-6 rounded-md bg-[#ede8e5]/60" />
          <div className="h-[15px] w-[15px] rounded-md bg-[#ede8e5]/60" />
          <div className="size-1.5 rounded-full bg-transparent" />
        </div>
      ))}
    </div>
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type DateScrollerProps = {
  /** Called when the user selects a date (URL param also updated). */
  onChange?: (date: Date) => void;
};

export function DateScroller(props: DateScrollerProps) {
  return (
    <Suspense fallback={<DateScrollerSkeleton />}>
      <DateScrollerInner {...props} />
    </Suspense>
  );
}
