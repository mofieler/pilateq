'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Clock, X } from 'lucide-react';
import { format } from 'date-fns';
import { getMyBillingStatusAction } from '@/modules/billing/actions/billingStatus.actions';
import type { BillingStatus } from '@/modules/billing/services/billingStatus.service';

const SESSION_KEY = 'billing-reminder-shown-v1';

function fmt(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/**
 * Login-time reminder popup.
 *
 * Shown once per browser session when the user has at least one
 * overdue invoice OR at least one invoice due in ≤ 3 days.
 *
 * Overdue popup is non-dismissible-permanently — it reappears every session
 * until the bill is settled. Due-soon popup uses sessionStorage so it
 * doesn't re-pop on every page navigation.
 */
export function BillingReminderPopup() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getMyBillingStatusAction();
        if (cancelled || !result) return;
        const hasReminderState =
          result.hasOverdueBills || result.dueSoonBills.length > 0;
        if (!hasReminderState) return;

        // Overdue is always shown (hard block warning). Due-soon respects sessionStorage.
        if (result.hasOverdueBills) {
          setStatus(result);
          setOpen(true);
          return;
        }
        const seen = typeof window !== 'undefined' && window.sessionStorage.getItem(SESSION_KEY);
        if (!seen) {
          setStatus(result);
          setOpen(true);
        }
      } catch {
        // silent — never break the dashboard because of the popup
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!open || !status) return null;

  const isOverdue = status.hasOverdueBills;
  const bills = isOverdue ? status.overdueBills : status.dueSoonBills;
  const total = bills.reduce((s, b) => s + b.priceCents, 0);
  const currency = bills[0]?.currency ?? 'eur';

  function dismiss() {
    if (!isOverdue && typeof window !== 'undefined') {
      window.sessionStorage.setItem(SESSION_KEY, '1');
    }
    setOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={dismiss}
    >
      <div
        className={`relative w-full max-w-md rounded-2xl bg-[#faf9f7] shadow-[0_24px_60px_rgba(78,43,34,0.25)] overflow-hidden ${
          isOverdue ? 'border-2 border-[#c45c4a]' : 'border border-[#c4a88a]/60'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 size-8 rounded-full flex items-center justify-center text-[#8b6b5c] hover:bg-[#ede8e5] transition-colors"
        >
          <X className="size-4" />
        </button>

        <div
          className={`px-6 py-5 ${
            isOverdue
              ? 'bg-gradient-to-br from-[#c45c4a] to-[#a14a3a] text-[#faf9f7]'
              : 'bg-gradient-to-br from-[#4e2b22] to-[#6b3d32] text-[#faf9f7]'
          }`}
        >
          <div className="flex items-center gap-3">
            {isOverdue ? <AlertCircle className="size-6" /> : <Clock className="size-6" />}
            <div>
              <h2 className="text-lg font-bold">
                {isOverdue ? 'Overdue invoice' : 'Invoice due soon'}
              </h2>
              <p className="text-xs opacity-90">
                {isOverdue
                  ? `${bills.length} unpaid invoice${bills.length > 1 ? 's' : ''} · ${fmt(total, currency)}`
                  : `${bills.length} invoice${bills.length > 1 ? 's' : ''} due within 3 days · ${fmt(total, currency)}`}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <ul className="space-y-2">
            {bills.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-[#fdf8f5] border border-[#ede8e5] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#4e2b22] truncate">
                    {b.invoiceNumber ?? 'Invoice'}
                  </p>
                  <p className={isOverdue ? 'text-xs text-[#c45c4a]' : 'text-xs text-[#6b3d32]'}>
                    {b.paymentDueDate
                      ? isOverdue
                        ? `Overdue by ${Math.abs(b.daysUntilDue)}d`
                        : `Due in ${b.daysUntilDue}d (${format(b.paymentDueDate, 'MMM d')})`
                      : 'No due date'}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[#4e2b22] shrink-0">
                  {fmt(b.priceCents, b.currency)}
                </span>
              </li>
            ))}
          </ul>

          <p className="text-sm text-[#6b3d32] leading-relaxed">
            {isOverdue
              ? 'New purchases and bookings are paused until you settle your invoice. Please pay at the studio or via bank transfer.'
              : 'Please pay at the studio or via bank transfer before the due date. Both methods are welcome.'}
          </p>

          <div className="flex gap-2 pt-2">
            <button
              onClick={dismiss}
              className="flex-1 rounded-lg border border-[#c4a88a] bg-[#faf9f7] px-4 py-2.5 text-sm font-semibold text-[#4e2b22] hover:bg-[#ede8e5] transition-colors"
            >
              {isOverdue ? 'I understand' : 'Got it'}
            </button>
            <Link
              href="/credits"
              onClick={dismiss}
              className="flex-1 rounded-lg bg-[#4e2b22] px-4 py-2.5 text-center text-sm font-semibold text-[#faf9f7] hover:bg-[#6b3d32] transition-colors"
            >
              View credits
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
