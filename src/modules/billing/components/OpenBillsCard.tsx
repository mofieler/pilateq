import Link from 'next/link';
import { AlertCircle, FileText, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { OpenBill } from '@/modules/billing/services/billingStatus.service';

function fmt(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function OpenBillsCard({ openBills }: { openBills: OpenBill[] }) {
  if (openBills.length === 0) return null;

  const hasOverdue = openBills.some((b) => b.isOverdue);
  const totalCents = openBills.reduce((sum, b) => sum + b.priceCents, 0);
  const currency   = openBills[0]?.currency ?? 'eur';

  return (
    <section
      className={
        hasOverdue
          ? 'rounded-2xl border border-[#c45c4a]/40 bg-gradient-to-br from-[#fdf0ec] to-[#fae3dd] p-6 shadow-[0_4px_20px_rgba(196,92,74,0.08)]'
          : 'rounded-2xl border border-[#c4a88a]/40 bg-gradient-to-br from-[#fdf8f5] to-[#f5ebe0] p-6 shadow-[0_4px_20px_rgba(78,43,34,0.04)]'
      }
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={
              hasOverdue
                ? 'inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#c45c4a]/15 text-[#c45c4a]'
                : 'inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5] text-[#6b3d32]'
            }
          >
            {hasOverdue ? <AlertCircle className="size-4" /> : <FileText className="size-4" />}
          </span>
          <h2 className="text-lg font-semibold text-[#4e2b22]">
            {hasOverdue ? 'Overdue invoices' : 'Open invoices'}
            <span className="ml-2 rounded-full bg-[#4e2b22]/10 px-2.5 py-0.5 text-xs font-semibold text-[#4e2b22]">
              {openBills.length}
            </span>
          </h2>
        </div>
        <span className="text-sm font-semibold text-[#4e2b22]">
          {fmt(totalCents, currency)}
        </span>
      </div>

      <ul className="space-y-2 mb-4">
        {openBills.map((b) => (
          <li
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#faf9f7]/80 border border-[#ede8e5]/60 px-4 py-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Clock
                className={b.isOverdue ? 'size-4 text-[#c45c4a] shrink-0' : 'size-4 text-[#6b3d32] shrink-0'}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#4e2b22] truncate">
                  {b.invoiceNumber ?? 'Invoice'} · {b.creditsAmount} credits
                </p>
                <p className={b.isOverdue ? 'text-xs text-[#c45c4a]' : 'text-xs text-[#6b3d32]'}>
                  {b.paymentDueDate
                    ? b.isOverdue
                      ? `Overdue since ${format(b.paymentDueDate, 'MMM d')} (${Math.abs(b.daysUntilDue)}d)`
                      : `Due ${format(b.paymentDueDate, 'MMM d, yyyy')} (${b.daysUntilDue}d remaining)`
                    : 'No due date'}
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-[#4e2b22]">
              {fmt(b.priceCents, b.currency)}
            </span>
          </li>
        ))}
      </ul>

      <p className={hasOverdue ? 'text-xs text-[#c45c4a]' : 'text-xs text-[#6b3d32]'}>
        {hasOverdue
          ? 'New purchases and bookings are paused until your overdue invoices are settled at the studio or via bank transfer.'
          : 'Please pay at the studio or via bank transfer by the due date. Both methods are welcome.'}
      </p>

      <Link
        href="/credits?tab=bills"
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#d4a574]/10 px-4 py-2.5 text-sm font-semibold text-[#6b3d32] border border-[#d4a574]/30 transition-all hover:bg-[#d4a574]/15 hover:border-[#d4a574]/40 active:bg-[#d4a574]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a574] focus-visible:ring-offset-2 sm:px-5 sm:py-3"
      >
        View bills details
      </Link>
    </section>
  );
}
