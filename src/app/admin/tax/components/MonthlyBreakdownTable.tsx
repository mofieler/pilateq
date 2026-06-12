import { cn } from '@/lib/utils';
import type { MonthlyRevenue } from '@/modules/billing/actions/taxSummary.actions';

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function MonthlyBreakdownTable({ months }: { months: MonthlyRevenue[] }) {
  const maxRevenue = Math.max(...months.map((m) => m.revenueCents), 1);

  return (
    <div className="rounded-2xl border border-[#ede8e5] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#ede8e5] bg-[#faf9f7]">
        <h2 className="font-semibold text-[#4e2b22]">Monthly Breakdown</h2>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#ede8e5] bg-[#faf9f7]/60">
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#8b6b5c] uppercase tracking-wide">Month</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-[#8b6b5c] uppercase tracking-wide">Revenue</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-[#8b6b5c] uppercase tracking-wide">Outstanding</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-[#8b6b5c] uppercase tracking-wide">Invoices</th>
              <th className="px-5 py-3 text-xs font-semibold text-[#8b6b5c] uppercase tracking-wide">Bar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ede8e5]/60">
            {months.map((m) => {
              const barWidth = maxRevenue > 0 ? (m.revenueCents / maxRevenue) * 100 : 0;
              const isEmpty = m.revenueCents === 0 && m.outstandingCents === 0;
              return (
                <tr
                  key={m.month}
                  className={cn(
                    'transition-colors',
                    isEmpty ? 'text-[#c4a88a]' : 'hover:bg-[#faf9f7]',
                  )}
                >
                  <td className="px-5 py-3 font-medium text-[#4e2b22]">{m.monthLabel}</td>
                  <td className="px-5 py-3 text-right font-semibold text-[#4a7c4a]">
                    {m.revenueCents > 0 ? formatPrice(m.revenueCents) : '—'}
                  </td>
                  <td className={cn(
                    'px-5 py-3 text-right font-medium',
                    m.outstandingCents > 0 ? 'text-[#b58a5c]' : 'text-[#c4a88a]',
                  )}>
                    {m.outstandingCents > 0 ? formatPrice(m.outstandingCents) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-[#6b3d32]">
                    {m.invoiceCount > 0 ? `${m.paidCount}/${m.invoiceCount}` : '—'}
                  </td>
                  <td className="px-5 py-3 w-32">
                    <div className="h-2 rounded-full bg-[#ede8e5] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#6b8e6b] transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="sm:hidden divide-y divide-[#ede8e5]/60">
        {months.map((m) => (
          <div key={m.month} className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#4e2b22]">{m.monthLabel}</p>
              {m.invoiceCount > 0 && (
                <p className="text-xs text-[#8b6b5c]">{m.paidCount}/{m.invoiceCount} invoices</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-[#4a7c4a]">
                {m.revenueCents > 0 ? formatPrice(m.revenueCents) : '—'}
              </p>
              {m.outstandingCents > 0 && (
                <p className="text-xs text-[#b58a5c]">{formatPrice(m.outstandingCents)} pending</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
