'use client';

import { useMemo, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  CalendarCheckIcon, CalendarXIcon, CoinsIcon,
  RefreshCcwIcon, SlidersHorizontalIcon, UserIcon,
} from 'lucide-react';
import type { ActivityItem, ActivityType } from '@/modules/statistics/actions/statistics.actions';

// ─── Config ───────────────────────────────────────────────────────────────────

type FilterGroup = 'all' | 'bookings' | 'cancellations' | 'financial';

const FILTER_GROUPS: { id: FilterGroup; label: string }[] = [
  { id: 'all',           label: 'All' },
  { id: 'bookings',      label: 'Bookings' },
  { id: 'cancellations', label: 'Cancellations' },
  { id: 'financial',     label: 'Financial' },
];

const GROUP_TYPES: Record<FilterGroup, ActivityType[] | null> = {
  all:           null,
  bookings:      ['booking_confirmed'],
  cancellations: ['booking_cancelled_user', 'booking_cancelled_admin'],
  financial:     ['credit_purchase', 'credit_refund', 'credit_adjustment'],
};

const ITEM_ICON: Record<ActivityType, React.ReactNode> = {
  booking_confirmed:       <CalendarCheckIcon className="size-3.5" />,
  booking_cancelled_user:  <CalendarXIcon className="size-3.5" />,
  booking_cancelled_admin: <CalendarXIcon className="size-3.5" />,
  credit_purchase:         <CoinsIcon className="size-3.5" />,
  credit_refund:           <RefreshCcwIcon className="size-3.5" />,
  credit_adjustment:       <SlidersHorizontalIcon className="size-3.5" />,
};

const ITEM_COLOR: Record<ActivityType, { icon: string; dot: string }> = {
  booking_confirmed:       { icon: 'bg-[#6b8e6b]/15 text-[#4a7c4a]', dot: 'bg-[#4a7c4a]' },
  booking_cancelled_user:  { icon: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400' },
  booking_cancelled_admin: { icon: 'bg-red-100 text-red-600',         dot: 'bg-red-400' },
  credit_purchase:         { icon: 'bg-[#c4a88a]/15 text-[#6b3d32]', dot: 'bg-[#c4a88a]' },
  credit_refund:           { icon: 'bg-[#ede8e5] text-[#6b3d32]',    dot: 'bg-[#8b6b5c]' },
  credit_adjustment:       { icon: 'bg-[#ede8e5] text-[#6b3d32]',    dot: 'bg-[#8b6b5c]' },
};

const ITEM_TYPE_LABEL: Record<ActivityType, string> = {
  booking_confirmed:       'Booking',
  booking_cancelled_user:  'Cancelled (user)',
  booking_cancelled_admin: 'Cancelled (admin)',
  credit_purchase:         'Purchase',
  credit_refund:           'Refund',
  credit_adjustment:       'Adjustment',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActivityRow({
  item,
  onUserClick,
}: {
  item: ActivityItem;
  onUserClick: (userId: string) => void;
}) {
  const colors = ITEM_COLOR[item.type];

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#ede8e5]/60 last:border-0 group">
      {/* Icon */}
      <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${colors.icon}`}>
        {ITEM_ICON[item.type]}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#4e2b22] truncate">{item.title}</p>
            <p className="text-xs text-[#8b6b5c] mt-0.5">{item.subtitle}</p>
          </div>
          <div className="shrink-0 text-right">
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.icon}`}>
              {ITEM_TYPE_LABEL[item.type]}
            </span>
            <p className="text-[11px] text-[#a6856f] mt-1 tabular-nums">
              {formatDistanceToNow(item.timestamp, { addSuffix: true })}
            </p>
          </div>
        </div>

        {/* User chip */}
        <button
          type="button"
          onClick={() => onUserClick(item.userId)}
          className="mt-1.5 flex items-center gap-1 rounded-full bg-[#faf9f7] border border-[#ede8e5] px-2 py-0.5 text-[11px] text-[#6b3d32] font-medium hover:bg-[#ede8e5]/60 hover:text-[#4e2b22] transition-colors"
        >
          <UserIcon className="size-3" />
          {item.userName}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  activity: ActivityItem[];
  filterUserId?: string | null;
  onUserClick: (userId: string) => void;
};

const PAGE_SIZE = 25;

export function ActivityFeed({ activity, filterUserId, onUserClick }: Props) {
  const [group, setGroup] = useState<FilterGroup>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let items = activity;

    // Group filter
    const types = GROUP_TYPES[group];
    if (types) items = items.filter(i => types.includes(i.type));

    // User filter from parent (student tab selection)
    if (filterUserId) items = items.filter(i => i.userId === filterUserId);

    // Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      items = items.filter(i =>
        i.userName.toLowerCase().includes(q) ||
        i.userEmail.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        (i.meta.className ?? '').toLowerCase().includes(q),
      );
    }

    return items;
  }, [activity, group, filterUserId, search]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type chips */}
        <div className="flex items-center gap-1 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 p-0.5">
          {FILTER_GROUPS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setGroup(f.id); setPage(1); }}
              className={[
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                group === f.id
                  ? 'bg-[#4e2b22] text-white shadow-sm'
                  : 'text-[#8b6b5c] hover:text-[#4e2b22]',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search student or class…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[160px] rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 px-3 py-1.5 text-xs text-[#4e2b22] placeholder:text-[#a6856f] outline-none focus:border-[#c4a88a] transition-colors"
        />

        <span className="text-xs text-[#a6856f] tabular-nums shrink-0">
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Feed */}
      <div className="rounded-2xl border border-[#ede8e5]/80 bg-white px-4">
        {paginated.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-[#8b6b5c]">No activity found</p>
            <p className="text-xs text-[#a6856f] mt-1">Try adjusting the filters</p>
          </div>
        ) : (
          paginated.map(item => (
            <ActivityRow key={item.id} item={item} onUserClick={onUserClick} />
          ))
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setPage(p => p + 1)}
          className="w-full rounded-xl border border-[#ede8e5] py-2.5 text-xs font-semibold text-[#6b3d32] hover:bg-[#ede8e5]/60 transition-colors"
        >
          Show more ({filtered.length - paginated.length} remaining)
        </button>
      )}
    </div>
  );
}
