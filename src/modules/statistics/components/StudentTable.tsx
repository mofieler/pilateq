'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { SearchIcon, ChevronUpIcon, ChevronDownIcon, UserIcon } from 'lucide-react';
import type { StudentRow } from '@/modules/statistics/actions/statistics.actions';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'createdAt' | 'passBalance' | 'matPassBalance' | 'reformerPassBalance' | 'sessionBalance' | 'totalBookings' | 'upcomingBookings';
type SortDir = 'asc' | 'desc';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
        active ? 'text-[#4e2b22]' : 'text-[#8b6b5c] hover:text-[#4e2b22]'
      }`}
    >
      {label}
      <span className="flex flex-col gap-px">
        <ChevronUpIcon
          className={`size-2.5 ${active && dir === 'asc' ? 'text-[#4e2b22]' : 'text-[#c4a88a]'}`}
          strokeWidth={3}
        />
        <ChevronDownIcon
          className={`size-2.5 ${active && dir === 'desc' ? 'text-[#4e2b22]' : 'text-[#c4a88a]'}`}
          strokeWidth={3}
        />
      </span>
    </button>
  );
}

const CREDIT_ABBREV: Record<string, string> = { pass: 'P', mat_pass: 'M', reformer_pass: 'R', session: 'S' };

function CreditBadge({ value, type }: { value: number; type: string }) {
  const low = value <= 2;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
        low ? 'bg-amber-50 text-amber-700' : 'bg-[#ede8e5]/60 text-[#4e2b22]'
      }`}
    >
      {value}
      <span className="font-normal text-[10px] opacity-70">{CREDIT_ABBREV[type] ?? type}</span>
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  students: StudentRow[];
  selectedUserId: string | null;
  onSelect: (userId: string) => void;
};

const PAGE_SIZE = 20;

export function StudentTable({ students, selectedUserId, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = q
      ? students.filter(s =>
          s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
        )
      : students;

    rows = [...rows].sort((a, b) => {
      let av: string | number = a[sortKey] instanceof Date
        ? (a[sortKey] as Date).getTime()
        : (a[sortKey] as string | number);
      let bv: string | number = b[sortKey] instanceof Date
        ? (b[sortKey] as Date).getTime()
        : (b[sortKey] as string | number);

      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();

      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }, [students, search, sortKey, sortDir]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  return (
    <div className="space-y-3">
      {/* Search + count */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#a6856f]" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 pl-8 pr-3 py-1.5 text-xs text-[#4e2b22] placeholder:text-[#a6856f] outline-none focus:border-[#c4a88a] transition-colors"
          />
        </div>
        <span className="text-xs text-[#a6856f] tabular-nums shrink-0">
          {filtered.length} student{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#ede8e5]/80 bg-white overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-4 items-center px-4 py-2.5 border-b border-[#ede8e5]/60 bg-[#faf9f7]/60">
          <SortHeader label="Student" sortKey="name" current={sortKey} dir={sortDir} onSort={handleSort} />
          <SortHeader label="Pass" sortKey="passBalance" current={sortKey} dir={sortDir} onSort={handleSort} />
          <SortHeader label="Mat" sortKey="matPassBalance" current={sortKey} dir={sortDir} onSort={handleSort} />
          <SortHeader label="Reformer" sortKey="reformerPassBalance" current={sortKey} dir={sortDir} onSort={handleSort} />
          <SortHeader label="Session" sortKey="sessionBalance" current={sortKey} dir={sortDir} onSort={handleSort} />
          <SortHeader label="Bookings" sortKey="totalBookings" current={sortKey} dir={sortDir} onSort={handleSort} />
          <SortHeader label="Upcoming" sortKey="upcomingBookings" current={sortKey} dir={sortDir} onSort={handleSort} />
        </div>

        {/* Rows */}
        {paginated.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm font-medium text-[#8b6b5c]">No students found</p>
            <p className="text-xs text-[#a6856f] mt-1">Try a different search</p>
          </div>
        ) : (
          paginated.map(s => {
            const selected = selectedUserId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                className={`w-full grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-[#ede8e5]/50 last:border-0 text-left transition-colors ${
                  selected
                    ? 'bg-[#4e2b22]/5'
                    : 'hover:bg-[#faf9f7]/80'
                }`}
              >
                {/* Name + email */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    selected ? 'bg-[#4e2b22] text-white' : 'bg-[#ede8e5] text-[#6b3d32]'
                  }`}>
                    {s.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${selected ? 'text-[#4e2b22]' : 'text-[#4e2b22]'}`}>
                      {s.name}
                    </p>
                    <p className="text-[11px] text-[#8b6b5c] truncate">{s.email}</p>
                  </div>
                </div>

                {/* Credits */}
                <CreditBadge value={s.passBalance} type="pass" />
                <CreditBadge value={s.matPassBalance} type="mat_pass" />
                <CreditBadge value={s.reformerPassBalance} type="reformer_pass" />
                <CreditBadge value={s.sessionBalance} type="session" />

                {/* Booking counts */}
                <span className="text-sm font-semibold tabular-nums text-[#4e2b22] text-center w-8">
                  {s.totalBookings}
                </span>
                <span className={`text-sm font-semibold tabular-nums text-center w-8 ${
                  s.upcomingBookings > 0 ? 'text-[#4a7c4a]' : 'text-[#a6856f]'
                }`}>
                  {s.upcomingBookings}
                </span>
              </button>
            );
          })
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
