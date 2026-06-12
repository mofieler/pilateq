'use client';

import { CheckCircle, Clock, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CreditPackage, MembershipPlan } from './usePurchaseState';
import { SESSION_SUBTYPE_LABELS } from '@/lib/config/class-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatValidity(days: number): string {
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks !== 1 ? 's' : ''}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductCardProps {
  kind: 'package' | 'membership';
  item: CreditPackage | MembershipPlan;
  selected: boolean;
  onSelect: () => void;
  isBestValue?: boolean;
  badge?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductCard({ kind, item, selected, onSelect, isBestValue, badge }: ProductCardProps) {
  const isPackage = kind === 'package';
  const pkg = isPackage ? (item as CreditPackage) : null;
  const plan = !isPackage ? (item as MembershipPlan) : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex h-full w-full flex-col gap-3 rounded-2xl border p-5 text-left transition-all duration-200',
        selected
          ? 'border-[#4e2b22] bg-[#4e2b22]/[0.03] shadow-[0_8px_28px_rgba(78,43,34,0.12)] ring-1 ring-[#4e2b22]/20'
          : 'border-[#ede8e5]/80 bg-white/70 hover:border-[#c4a88a]/60 hover:shadow-[0_4px_20px_rgba(78,43,34,0.07)]',
      )}
    >
      {/* Selection / Best value / Badge indicator */}
      {selected ? (
        <CheckCircle className="absolute right-3.5 top-3.5 size-5 text-[#4e2b22]" aria-hidden />
      ) : badge ? (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#c4a88a]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[#4e2b22]">
          {badge}
        </span>
      ) : isBestValue ? (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#4a7c4a]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#4a7c4a]">
          <Star className="size-2.5 fill-[#4a7c4a]" aria-hidden />
          Best value
        </span>
      ) : null}

      {/* Name + description */}
      <div className={cn('pr-14', selected && 'pr-16')}>
        <h4 className="text-base font-bold text-[#4e2b22]">{item.name}</h4>
        {item.description && (
          <p className="mt-0.5 text-[11px] text-[#8b6b5c] leading-relaxed">{item.description}</p>
        )}
      </div>

      {/* Price */}
      <div>
        <p className="text-2xl font-bold tracking-tight text-[#4e2b22]">
          {formatPrice(item.priceCents, item.currency)}
        </p>
        <p className="mt-0.5 text-[11px] text-[#8b6b5c]">
          {isPackage && pkg
            ? `${pkg.creditsAmount} ${pkg.category === 'session' ? 'sessions' : 'credits'} · ${formatPrice(pkg.priceCents / pkg.creditsAmount, pkg.currency)} each`
            : `${plan!.weeklyCredits} credits/week · ${plan!.durationWeeks} weeks`
          }
        </p>
      </div>

      {/* Key metrics row */}
      <div className="mt-auto grid grid-cols-3 gap-2">
        {isPackage && pkg ? (
          <>
            <MetricBox label={pkg.category === 'session' ? 'Sessions' : 'Credits'} value={String(pkg.creditsAmount)} />
            <MetricBox label="Validity" value={formatValidity(pkg.validityDays)} />
            <MetricBox label="Type" value={pkg.creditType === 'session' ? 'Session' : 'Group'} />
          </>
        ) : plan ? (
          <>
            <MetricBox label="Weekly" value={`${plan.weeklyCredits} cr`} />
            <MetricBox label="Duration" value={`${plan.durationWeeks}w`} />
            <MetricBox label="Total" value={`${plan.weeklyCredits * plan.durationWeeks} cr`} />
          </>
        ) : null}
      </div>

      {/* Session subtype indicator for memberships */}
      {!isPackage && plan?.sessionSubtype && (
        <div className="mt-1 rounded-lg bg-[#4e2b22]/[0.03] px-2.5 py-1.5 text-center">
          <p className="text-[10px] font-semibold text-[#4e2b22]">
            {SESSION_SUBTYPE_LABELS[plan.sessionSubtype]} only
          </p>
        </div>
      )}

      {/* Validity footnote */}
      <div className="flex items-center gap-1.5 text-[11px] text-[#a6856f]">
      </div>

      {/* Validity footnote */}
      <div className="flex items-center gap-1.5 text-[11px] text-[#a6856f]">
        <Clock className="size-3 shrink-0" aria-hidden />
        {isPackage && pkg
          ? `Valid for ${formatValidity(pkg.validityDays)} from purchase`
          : `Credits granted every 7 days for ${plan!.durationWeeks} weeks`
        }
      </div>
    </button>
  );
}

// ─── Metric box sub-component ─────────────────────────────────────────────────

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/60 p-2 text-center">
      <p className="text-[10px] text-[#8b6b5c] uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold text-[#4e2b22]">{value}</p>
    </div>
  );
}
