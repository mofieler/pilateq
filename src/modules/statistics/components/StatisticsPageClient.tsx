'use client';

import { useState, useTransition } from 'react';
import { subDays } from 'date-fns';
import { BarChart3Icon, ActivityIcon, UsersIcon, RefreshCwIcon } from 'lucide-react';
import { SummaryCards } from './SummaryCards';
import { ActivityFeed } from './ActivityFeed';
import { StudentTable } from './StudentTable';
import { StudentDetail } from './StudentDetail';
import { getActivityFeedAction } from '@/modules/statistics/actions/statistics.actions';
import type {
  SummaryStats,
  ActivityItem,
  StudentRow,
} from '@/modules/statistics/actions/statistics.actions';

// ─── Date range options ───────────────────────────────────────────────────────

const DATE_RANGES: { label: string; days: number }[] = [
  { label: '7 days',  days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = 'activity' | 'students';

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  stats: SummaryStats;
  activity: ActivityItem[];
  students: StudentRow[];
  defaultFromDate: Date;
};

export function StatisticsPageClient({ stats, activity: initialActivity, students, defaultFromDate }: Props) {
  const [tab, setTab] = useState<Tab>('activity');
  const [activity, setActivity] = useState<ActivityItem[]>(initialActivity);
  const [selectedDays, setSelectedDays] = useState(30);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRangeChange(days: number) {
    setSelectedDays(days);
    startTransition(async () => {
      const fromDate = subDays(new Date(), days);
      const fresh = await getActivityFeedAction(fromDate);
      setActivity(fresh);
    });
  }

  function handleUserClick(userId: string) {
    setSelectedUserId(userId);
    setTab('students');
  }

  function handleStudentSelect(userId: string) {
    setSelectedUserId(prev => prev === userId ? null : userId);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#4e2b22]/10">
            <BarChart3Icon className="size-5 text-[#4e2b22]" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-[#4e2b22]">Statistics</h1>
            <p className="text-sm text-[#8b6b5c]">Overview of studio activity and students</p>
          </div>
        </div>
      </div>

      {/* Summary cards — always visible */}
      <SummaryCards stats={stats} />

      {/* Tab navigation + date range */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 p-0.5">
          <button
            type="button"
            onClick={() => setTab('activity')}
            className={[
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
              tab === 'activity'
                ? 'bg-[#4e2b22] text-white shadow-sm'
                : 'text-[#8b6b5c] hover:text-[#4e2b22]',
            ].join(' ')}
          >
            <ActivityIcon className="size-3.5" />
            Activity
          </button>
          <button
            type="button"
            onClick={() => { setTab('students'); setSelectedUserId(null); }}
            className={[
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
              tab === 'students'
                ? 'bg-[#4e2b22] text-white shadow-sm'
                : 'text-[#8b6b5c] hover:text-[#4e2b22]',
            ].join(' ')}
          >
            <UsersIcon className="size-3.5" />
            Students
          </button>
        </div>

        {/* Date range — only for activity tab */}
        {tab === 'activity' && (
          <div className="flex items-center gap-2">
            {isPending && (
              <RefreshCwIcon className="size-3.5 text-[#a6856f] animate-spin" />
            )}
            <div className="flex items-center gap-1 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 p-0.5">
              {DATE_RANGES.map(r => (
                <button
                  key={r.days}
                  type="button"
                  onClick={() => handleRangeChange(r.days)}
                  disabled={isPending}
                  className={[
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50',
                    selectedDays === r.days
                      ? 'bg-[#4e2b22] text-white shadow-sm'
                      : 'text-[#8b6b5c] hover:text-[#4e2b22]',
                  ].join(' ')}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Activity tab ── */}
      {tab === 'activity' && (
        <ActivityFeed
          activity={activity}
          filterUserId={null}
          onUserClick={handleUserClick}
        />
      )}

      {/* ── Students tab ── */}
      {tab === 'students' && (
        <div className={selectedUserId ? 'grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start' : ''}>
          <StudentTable
            students={students}
            selectedUserId={selectedUserId}
            onSelect={handleStudentSelect}
          />
          {selectedUserId && (
            <div className="lg:sticky lg:top-6">
              <StudentDetail
                key={selectedUserId}
                userId={selectedUserId}
                onClose={() => setSelectedUserId(null)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
