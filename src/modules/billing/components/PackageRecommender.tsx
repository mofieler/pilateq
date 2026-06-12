'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangleIcon } from 'lucide-react';
import {
  recommendationStatus,
  type Intent,
  type Frequency,
} from '@/modules/billing/lib/packageRecommendation';
import type { CreditType } from '@/lib/config/class-types';
import { RECOMMENDER_COPY } from '@/constants/PACKAGE_RECOMMENDATIONS';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecommenderPackage = {
  id: string;
  creditsAmount: number;
  validityWeeks: number;
  creditType: CreditType;
};

export type RecommenderDecision<T extends RecommenderPackage> = {
  pkg: T;
  /** True when the package should not even be rendered (mat-only filter). */
  hidden: boolean;
  /** True when the package is rendered but visually greyed-out. */
  disabled: boolean;
  /** Short reason text to display under a disabled card. Null for active cards. */
  disabledReason: string | null;
};

// ─── Toggle UI ────────────────────────────────────────────────────────────────

function ToggleGroup<V extends string>({
  value, onChange, options,
}: {
  value: V;
  onChange: (v: V) => void;
  options: { value: V; label: string }[];
}) {
  return (
    <div className="inline-flex flex-wrap gap-2" role="group">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-full px-4 sm:px-5 py-2.5 text-sm font-medium transition-all border min-h-[44px] sm:min-h-auto',
              active
                ? 'bg-[#4e2b22] text-white border-[#4e2b22] shadow-sm'
                : 'bg-white text-[#4e2b22] border-[#c4a88a]/40 hover:border-[#4e2b22] active:bg-[#f5f3f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22]',
            )}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Recommender hook ─────────────────────────────────────────────────────────

/**
 * Decides per-package visibility/disabled state. Pure derivation — the
 * component renders whatever you pass back.
 */
export function usePackageRecommender<T extends RecommenderPackage>(
  packages: T[],
  intent: Intent,
  frequency: Frequency,
): RecommenderDecision<T>[] {
  return useMemo(
    () => packages.map((pkg) => {
      const status = recommendationStatus(pkg, intent, frequency);
      if (status.kind === 'hide') {
        return { pkg, hidden: true, disabled: false, disabledReason: null };
      }
      if (status.kind === 'disabled') {
        return {
          pkg,
          hidden: false,
          disabled: true,
          disabledReason: RECOMMENDER_COPY.disabledReasons[status.reasonKey],
        };
      }
      return { pkg, hidden: false, disabled: false, disabledReason: null };
    }),
    [packages, intent, frequency],
  );
}

// ─── Top-level controls (renders the two toggles + hint) ──────────────────────

export type PackageRecommenderControlsProps = {
  intent: Intent;
  frequency: Frequency;
  onIntentChange: (intent: Intent) => void;
  onFrequencyChange: (frequency: Frequency) => void;
};

export function PackageRecommenderControls({
  intent, frequency, onIntentChange, onFrequencyChange,
}: PackageRecommenderControlsProps) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-[#8b6b5c]">
          {RECOMMENDER_COPY.intentLabel}
        </p>
        <ToggleGroup<Intent>
          value={intent}
          onChange={onIntentChange}
          options={[
            { value: 'all',      label: RECOMMENDER_COPY.intentOptions.all },
            { value: 'mat_only', label: RECOMMENDER_COPY.intentOptions.mat_only },
          ]}
        />
      </div>

      {intent === 'all' && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-[#8b6b5c]">
            {RECOMMENDER_COPY.frequencyLabel}
          </p>
          <ToggleGroup<Frequency>
            value={frequency}
            onChange={onFrequencyChange}
            options={[
              { value: 'once',     label: RECOMMENDER_COPY.frequencyOptions.once },
              { value: 'multiple', label: RECOMMENDER_COPY.frequencyOptions.multiple },
            ]}
          />
        </div>
      )}

      {intent === 'mat_only' && (
        <p className="text-xs italic text-[#a6856f] max-w-md">
          {RECOMMENDER_COPY.matOnlyHint}
        </p>
      )}
    </div>
  );
}

// ─── Disabled-package caption (placed below a disabled card) ──────────────────

export function DisabledPackageCaption({ reason }: { reason: string }) {
  return (
    <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-[#a05c3d] text-center">
      <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden />
      {reason}
    </p>
  );
}

// ─── Stand-alone state holder (for pages that want everything wrapped) ────────

export function useRecommenderState(initial?: { intent?: Intent; frequency?: Frequency }) {
  const [intent, setIntent] = useState<Intent>(initial?.intent ?? 'all');
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? 'multiple');
  return { intent, frequency, setIntent, setFrequency };
}
