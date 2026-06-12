'use client';

import { cn } from '@/lib/utils';

type FilterKey = 'all' | 'group' | 'session' | 'membership';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'group', label: 'Group Classes' },
  { key: 'session', label: 'Private & Duo' },
  { key: 'membership', label: 'Memberships' },
];

interface FilterBarProps {
  active: FilterKey;
  onChange: (key: FilterKey) => void;
}

export function FilterBar({ active, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            'rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
            active === key
              ? 'bg-[#4e2b22] text-[#faf9f7] shadow-sm'
              : 'bg-white/60 text-[#8b6b5c] border border-[#ede8e5]/80 hover:border-[#c4a88a]/40 hover:text-[#6b3d32]',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export type { FilterKey };
