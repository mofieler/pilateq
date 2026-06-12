'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, ChevronDown, CalendarX } from 'lucide-react';
import { BookingCard } from '@/modules/users/components/BookingCard';
import type { CreditType } from '@/lib/config/class-types';

interface PastBooking {
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
}

interface Props {
  past: PastBooking[];
  mercyUsesLeft: number;
}

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'attended', label: 'Attended' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'reformer', label: 'Reformer' },
  { value: 'mat', label: 'Mat' },
  { value: 'chair', label: 'Chair' },
  { value: 'online', label: 'Online' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'sound_healing', label: 'Sound Healing' },
];

export function BookingHistoryClient({ past, mercyUsesLeft }: Props) {
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let result = [...past];

    if (filterStatus !== 'all') {
      result = result.filter((b) => b.status === filterStatus);
    }

    if (filterType !== 'all') {
      if (filterType === 'reformer') {
        result = result.filter((b) => b.classType.startsWith('reformer'));
      } else if (filterType === 'mat') {
        result = result.filter((b) => b.classType.startsWith('mat'));
      } else {
        result = result.filter((b) => b.classType === filterType);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.instructorName?.toLowerCase().includes(q) ?? false) ||
          (b.location?.toLowerCase().includes(q) ?? false),
      );
    }

    return result;
  }, [past, filterStatus, filterType, searchQuery]);

  const displayed = filtered.slice(0, displayCount);
  const hasMore = displayCount < filtered.length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#a6856f]" />
          <input
            type="text"
            placeholder="Search classes, instructors, locations…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setDisplayCount(PAGE_SIZE);
            }}
            className="w-full rounded-xl border border-[#ede8e5]/80 bg-white pl-9 pr-3 py-2 text-xs text-[#4e2b22] placeholder:text-[#a6856f]/70 focus:border-[#c4a88a] focus:outline-none focus:ring-1 focus:ring-[#c4a88a]/30"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-[#a6856f]" />
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setDisplayCount(PAGE_SIZE);
              }}
              className="appearance-none rounded-xl border border-[#ede8e5]/80 bg-white pl-8 pr-7 py-2 text-xs text-[#4e2b22] focus:border-[#c4a88a] focus:outline-none focus:ring-1 focus:ring-[#c4a88a]/30 cursor-pointer"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 text-[#a6856f] pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setDisplayCount(PAGE_SIZE);
              }}
              className="appearance-none rounded-xl border border-[#ede8e5]/80 bg-white pl-3 pr-7 py-2 text-xs text-[#4e2b22] focus:border-[#c4a88a] focus:outline-none focus:ring-1 focus:ring-[#c4a88a]/30 cursor-pointer"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 text-[#a6856f] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Results count */}
      {filtered.length !== past.length && (
        <p className="text-[11px] text-[#8b6b5c]">
          Showing {filtered.length} of {past.length} classes
        </p>
      )}

      {/* List */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#c4a88a]/30 bg-gradient-to-br from-[#faf9f7]/60 to-[#ede8e5]/30 py-14 text-center">
          <CalendarX className="size-8 text-[#c4a88a] mb-4" />
          <p className="text-sm font-semibold text-primary">No matching classes</p>
          <p className="mt-1 text-sm text-muted">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((booking) => (
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
              isPast={true}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#ede8e5] bg-white px-4 py-2 text-xs font-medium text-[#6b3d32] hover:bg-[#faf9f7] transition-colors"
          >
            Load more ({filtered.length - displayCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
