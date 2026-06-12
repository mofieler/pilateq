// Pure logic for the Paquita-style purchase recommender. No React/DOM here —
// keeps the rule set unit-testable and lets the component stay thin.

import type { CreditType } from '@/lib/config/class-types';

export type Intent = 'all' | 'mat_only';
export type Frequency = 'once' | 'multiple';

export type RecommendationStatus =
  | { kind: 'show' }
  | { kind: 'hide' }
  | { kind: 'disabled'; reasonKey: 'heads_up_validity_short' };

// Threshold: packs offering more than 4 credits per week on average are designed
// for committed practitioners (multiple classes per week). Packs at or below
// 4 credits/week suit light practitioners: mat-only (3 cr/week) or all-classes
// once-a-week (~4 cr/week avg).
const MAX_CREDITS_PER_WEEK_FOR_LIGHT = 4;

type PackageInput = {
  creditsAmount: number;
  validityWeeks: number;
  creditType: CreditType;
};

/**
 * Decides whether a package card should be shown or hidden given the user's
 * selected intent + frequency.
 *
 * Rules:
 *   - 'session' packages never participate — they're a separate section.
 *   - 'mat_only'  → hide pass packs whose average credits/week exceed 4.
 *   - 'all' + 'once' → hide pass packs whose average credits/week exceed 4.
 *   - 'all' + 'multiple' → show every pass pack.
 *
 * This keeps Essence (15cr/5wk = 3.0/wk) and Empower (30cr/7wk = ~4.3/wk)
 * visible for light practitioners, while hiding larger packs like Bloom
 * (50cr/9wk = ~5.6/wk) and Return to Life (100cr/12wk = ~8.3/wk).
 */
export function recommendationStatus(
  pkg: PackageInput,
  intent: Intent,
  frequency: Frequency,
): RecommendationStatus {
  if (pkg.creditType === 'session') return { kind: 'show' };

  // Light practitioner paths — only small/medium packs make sense.
  if (intent === 'mat_only' || (intent === 'all' && frequency === 'once')) {
    const creditsPerWeek = pkg.creditsAmount / pkg.validityWeeks;
    if (creditsPerWeek > MAX_CREDITS_PER_WEEK_FOR_LIGHT) {
      return { kind: 'hide' };
    }
    return { kind: 'show' };
  }

  // Heavy practitioner — everything is fair game.
  return { kind: 'show' };
}
