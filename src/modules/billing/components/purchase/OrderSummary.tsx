'use client';

import { format, addDays } from 'date-fns';
import type { Selection } from './usePurchaseState';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface OrderSummaryProps {
  selection: Selection;
}

export function OrderSummary({ selection }: OrderSummaryProps) {
  if (!selection) return null;

  return (
    <div className="space-y-2 text-sm">
      {selection.kind === 'package' ? (
        <PackageRows pkg={selection.item} />
      ) : (
        <MembershipRows plan={selection.item} />
      )}

      {/* Total */}
      <div className="border-t border-[#ede8e5] pt-2 mt-2">
        <div className="flex justify-between">
          <span className="font-semibold text-[#4e2b22]">Total</span>
          <span className="text-lg font-bold text-[#4e2b22]">
            {formatPrice(selection.item.priceCents, selection.item.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Package rows ─────────────────────────────────────────────────────────────

function PackageRows({ pkg }: { pkg: Extract<Selection, { kind: 'package' }>['item'] }) {
  return (
    <>
      <SummaryRow label="Package" value={pkg.name} />
      <SummaryRow
        label={pkg.category === 'session' ? 'Sessions' : 'Credits'}
        value={String(pkg.creditsAmount)}
      />
      <SummaryRow
        label="Valid until"
        value={format(addDays(new Date(), pkg.validityDays), 'd MMM yyyy')}
      />
    </>
  );
}

// ─── Membership rows ──────────────────────────────────────────────────────────

function MembershipRows({ plan }: { plan: Extract<Selection, { kind: 'membership' }>['item'] }) {
  return (
    <>
      <SummaryRow label="Plan" value={plan.name} />
      <SummaryRow label="Credits per week" value={`${plan.weeklyCredits} Credits`} />
      <SummaryRow label="Duration" value={`${plan.durationWeeks} weeks`} />
      <SummaryRow
        label="Valid until"
        value={format(addDays(new Date(), plan.durationWeeks * 7), 'd MMM yyyy')}
      />
    </>
  );
}

// ─── Shared row ───────────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#6b3d32]">{label}</span>
      <span className="font-medium text-[#4e2b22]">{value}</span>
    </div>
  );
}
