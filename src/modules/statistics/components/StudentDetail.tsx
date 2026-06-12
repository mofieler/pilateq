'use client';

import { useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  XIcon, CalendarCheckIcon, CalendarXIcon, CoinsIcon,
  RefreshCcwIcon, SlidersHorizontalIcon, ArrowUpIcon, ArrowDownIcon,
} from 'lucide-react';
import { getStudentDetailAction } from '@/modules/statistics/actions/statistics.actions';
import type { StudentDetail as StudentDetailType } from '@/modules/statistics/actions/statistics.actions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  if (status === 'confirmed') return 'bg-[#6b8e6b]/15 text-[#4a7c4a]';
  return 'bg-red-50 text-red-600';
}

function txIcon(type: string) {
  if (type === 'purchase') return <CoinsIcon className="size-3.5" />;
  if (type === 'refund') return <RefreshCcwIcon className="size-3.5" />;
  return <SlidersHorizontalIcon className="size-3.5" />;
}

function txColor(type: string) {
  if (type === 'purchase') return 'bg-[#c4a88a]/15 text-[#6b3d32]';
  if (type === 'refund') return 'bg-[#6b8e6b]/15 text-[#4a7c4a]';
  return 'bg-[#ede8e5] text-[#6b3d32]';
}

const CREDIT_TYPE_LABEL: Record<string, string> = {
  pass:          'Pass',
  mat_pass:      'Mat Pass',
  reformer_pass: 'Reformer Pass',
  session:       'Session',
};

function formatCreditType(type: string) {
  return CREDIT_TYPE_LABEL[type] ?? type;
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  userId: string;
  onClose: () => void;
};

export function StudentDetail({ userId, onClose }: Props) {
  const [detail, setDetail] = useState<StudentDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'bookings' | 'transactions'>('bookings');

  useEffect(() => {
    setLoading(true);
    setDetail(null);
    getStudentDetailAction(userId).then(d => {
      setDetail(d);
      setLoading(false);
    });
  }, [userId]);

  return (
    <div className="rounded-2xl border border-[#ede8e5]/80 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#ede8e5]/60 bg-[#faf9f7]/60">
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="size-10 rounded-full bg-[#ede8e5] animate-pulse" />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-full bg-[#4e2b22] text-white text-sm font-bold shrink-0">
              {detail?.name.charAt(0).toUpperCase() ?? '?'}
            </div>
          )}
          <div>
            {loading ? (
              <>
                <div className="h-4 w-32 rounded bg-[#ede8e5] animate-pulse mb-1" />
                <div className="h-3 w-44 rounded bg-[#ede8e5] animate-pulse" />
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-[#4e2b22]">{detail?.name}</p>
                <p className="text-xs text-[#8b6b5c]">{detail?.email}</p>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-lg text-[#8b6b5c] hover:bg-[#ede8e5]/60 hover:text-[#4e2b22] transition-colors"
          aria-label="Close"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {/* Credit balances */}
      {!loading && detail && (
        <div className="grid grid-cols-4 gap-2 px-5 py-4 border-b border-[#ede8e5]/60">
          {[
            { label: 'Pass',     value: detail.passBalance },
            { label: 'Mat',      value: detail.matPassBalance },
            { label: 'Reformer', value: detail.reformerPassBalance },
            { label: 'Session',  value: detail.sessionBalance },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-[#ede8e5]/40 px-3 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-[#8b6b5c] mb-1">{label}</p>
              <p className={`text-xl font-bold tabular-nums ${value <= 2 ? 'text-amber-600' : 'text-[#4e2b22]'}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}
      {loading && (
        <div className="grid grid-cols-4 gap-2 px-5 py-4 border-b border-[#ede8e5]/60">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-[#ede8e5] animate-pulse" />
          ))}
        </div>
      )}

      {/* Tab switch */}
      <div className="flex gap-1 px-5 pt-4 pb-1">
        {(['bookings', 'transactions'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              tab === t
                ? 'bg-[#4e2b22] text-white shadow-sm'
                : 'text-[#8b6b5c] hover:text-[#4e2b22]'
            }`}
          >
            {t === 'bookings' ? 'Bookings' : 'Transactions'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-5 pb-5 pt-3 space-y-2 max-h-[380px] overflow-y-auto">
        {loading && (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-[#ede8e5]/60 animate-pulse" />
          ))
        )}

        {!loading && detail && tab === 'bookings' && (
          detail.recentBookings.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#a6856f]">No bookings yet</p>
          ) : (
            detail.recentBookings.map(b => (
              <div key={b.id} className="flex items-center gap-3 rounded-xl border border-[#ede8e5]/60 bg-[#faf9f7]/60 px-3 py-2.5">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${statusColor(b.status)}`}>
                  {b.status === 'confirmed'
                    ? <CalendarCheckIcon className="size-3.5" />
                    : <CalendarXIcon className="size-3.5" />
                  }
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#4e2b22] truncate">{b.className}</p>
                  <p className="text-[11px] text-[#8b6b5c]">
                    {format(b.startsAt, 'dd MMM yyyy · HH:mm')}
                    {' · '}
                    {b.creditsSpent} {formatCreditType(b.creditType)} credit{b.creditsSpent !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor(b.status)}`}>
                  {b.status === 'confirmed' ? 'Confirmed' : 'Cancelled'}
                </span>
              </div>
            ))
          )
        )}

        {!loading && detail && tab === 'transactions' && (
          detail.recentTransactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#a6856f]">No transactions yet</p>
          ) : (
            detail.recentTransactions.map(t => {
              const positive = t.amount >= 0;
              const sign = positive ? '+' : '';
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-[#ede8e5]/60 bg-[#faf9f7]/60 px-3 py-2.5">
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${txColor(t.type)}`}>
                    {txIcon(t.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#4e2b22] capitalize">
                      {t.type.replace('_', ' ')}
                      {' · '}
                      {formatCreditType(t.creditType)}
                    </p>
                    <p className="text-[11px] text-[#8b6b5c] truncate">
                      {t.description ?? formatDistanceToNow(t.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold tabular-nums ${positive ? 'text-[#4a7c4a]' : 'text-red-600'}`}>
                      {sign}{t.amount}
                    </p>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
