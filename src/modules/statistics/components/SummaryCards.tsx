'use client';

import type { SummaryStats } from '@/modules/statistics/actions/statistics.actions';

function formatEur(cents: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

const cards = (stats: SummaryStats) => [
  {
    label: 'Bookings this month',
    value: stats.bookingsThisMonth,
    sub: 'confirmed reservations',
    color: 'text-[#4a7c4a]',
    bg: 'bg-[#6b8e6b]/8',
    dot: 'bg-[#4a7c4a]',
  },
  {
    label: 'Revenue this month',
    value: formatEur(stats.revenueThisMonthCents),
    sub: 'from credit purchases',
    color: 'text-[#4e2b22]',
    bg: 'bg-[#c4a88a]/10',
    dot: 'bg-[#c4a88a]',
  },
  {
    label: 'Active students',
    value: stats.activeStudents,
    sub: 'booked in last 30 days',
    color: 'text-[#4e2b22]',
    bg: 'bg-[#ede8e5]/60',
    dot: 'bg-[#8b6b5c]',
  },
  {
    label: 'Cancellation rate',
    value: `${stats.cancellationRatePercent}%`,
    sub: 'of bookings this month',
    color: stats.cancellationRatePercent > 20 ? 'text-amber-700' : 'text-[#4e2b22]',
    bg: stats.cancellationRatePercent > 20 ? 'bg-amber-50' : 'bg-[#ede8e5]/60',
    dot: stats.cancellationRatePercent > 20 ? 'bg-amber-500' : 'bg-[#8b6b5c]',
  },
];

export function SummaryCards({ stats }: { stats: SummaryStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards(stats).map((card) => (
        <div
          key={card.label}
          className={`rounded-2xl border border-[#ede8e5]/80 ${card.bg} p-5 transition-shadow hover:shadow-[0_4px_16px_rgba(78,43,34,0.06)]`}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className={`size-2 rounded-full ${card.dot}`} />
            <p className="text-xs font-medium text-[#8b6b5c]">{card.label}</p>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
          <p className="mt-1 text-xs text-[#8b6b5c]">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
