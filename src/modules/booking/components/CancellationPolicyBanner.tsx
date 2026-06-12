import { addHours } from 'date-fns';
import { CANCELLATION_WINDOW_HOURS, CANCELLATION_CUTOFF_HOURS, MERCY_USES_PER_MONTH } from '@/constants/BOOKING_RULES';
import { isSelfCancellationBlocked } from '@/lib/utils/booking.utils';
import { AlertTriangleIcon, CalendarClockIcon, HeartHandshakeIcon, ShieldCheckIcon, BanIcon } from 'lucide-react';

// ─── Policy resolver ──────────────────────────────────────────────────────────

// 'blocked'      — <3h before class; cancellation is completely closed
// 'free'         — ≥24h before class, no mercy needed
// 'rescheduled'  — class was rescheduled after booking; bonus window applies
// 'mercy'        — <24h, mercy will be consumed, refund issued (still ≥2 left after)
// 'mercy_last'   — <24h, this is the LAST mercy for the month (1 left)
// 'loss'         — <24h, no mercy left this month; credits will be forfeited
export type CancellationPolicyState =
  | 'blocked'
  | 'free'
  | 'rescheduled'
  | 'mercy'
  | 'mercy_last'
  | 'loss';

export type CancellationPolicy = {
  state: CancellationPolicyState;
  hoursUntilStart: number;
  willReceiveRefund: boolean;
  mercyUsesLeft: number;       // remaining BEFORE this cancellation
  mercyUsesLeftAfter: number;  // remaining AFTER this cancellation (informational)
  mercyUsesLimit: number;
};

export function resolveCancellationPolicy(
  startsAt: Date,
  mercyUsesLeft: number,
  now: Date = new Date(),
  rescheduledAt?: Date | null,
  bookedAt?: Date | null,
): CancellationPolicy {
  const msUntilStart = startsAt.getTime() - now.getTime();
  const hoursUntilStart = Math.floor(msUntilStart / (60 * 60 * 1000));
  const isWithinWindow = msUntilStart > 0 && msUntilStart < CANCELLATION_WINDOW_HOURS * 60 * 60 * 1000;
  const classHasStarted = now >= startsAt;
  const isBlocked = isSelfCancellationBlocked(startsAt, now);

  // Mirrors server-side grace logic in cancellationService.cancel().
  const rescheduledGrace =
    !!rescheduledAt &&
    !!bookedAt &&
    rescheduledAt > bookedAt &&
    now < addHours(rescheduledAt, CANCELLATION_WINDOW_HOURS) &&
    !classHasStarted;

  const base = {
    hoursUntilStart,
    mercyUsesLeft,
    mercyUsesLimit: MERCY_USES_PER_MONTH,
  };

  if (isBlocked) {
    return { ...base, state: 'blocked', willReceiveRefund: false, mercyUsesLeftAfter: mercyUsesLeft };
  }
  if (rescheduledGrace) {
    return { ...base, state: 'rescheduled', willReceiveRefund: true, mercyUsesLeftAfter: mercyUsesLeft };
  }
  if (!isWithinWindow) {
    return { ...base, state: 'free', willReceiveRefund: true, mercyUsesLeftAfter: mercyUsesLeft };
  }
  if (mercyUsesLeft >= 2) {
    return { ...base, state: 'mercy', willReceiveRefund: true, mercyUsesLeftAfter: mercyUsesLeft - 1 };
  }
  if (mercyUsesLeft === 1) {
    return { ...base, state: 'mercy_last', willReceiveRefund: true, mercyUsesLeftAfter: 0 };
  }
  return { ...base, state: 'loss', willReceiveRefund: false, mercyUsesLeftAfter: 0 };
}

// ─── Banner ───────────────────────────────────────────────────────────────────

const VARIANTS = {
  blocked: {
    icon: BanIcon,
    container: 'border-[#c45c4a]/20 bg-[#c45c4a]/10',
    iconColor: 'text-[#c45c4a]',
    title: 'Cancellation closed',
    titleColor: 'text-[#c45c4a]',
    descColor: 'text-[#b54a38]',
  },
  free: {
    icon: ShieldCheckIcon,
    container: 'border-[#6b8e6b]/20 bg-[#6b8e6b]/10',
    iconColor: 'text-[#4a7c4a]',
    title: 'Free cancellation',
    titleColor: 'text-[#4a7c4a]',
    descColor: 'text-[#5a8a5a]',
  },
  rescheduled: {
    icon: CalendarClockIcon,
    container: 'border-[#c4a88a]/20 bg-[#c4a88a]/15',
    iconColor: 'text-[#8b5a3c]',
    title: 'Free cancellation — class was rescheduled',
    titleColor: 'text-[#6b3d32]',
    descColor: 'text-[#8b6b5c]',
  },
  mercy: {
    icon: HeartHandshakeIcon,
    container: 'border-[#d4a574]/20 bg-[#d4a574]/15',
    iconColor: 'text-[#b58a5c]',
    title: 'Late-cancellation mercy will apply',
    titleColor: 'text-[#b58a5c]',
    descColor: 'text-[#a67c52]',
  },
  mercy_last: {
    icon: AlertTriangleIcon,
    container: 'border-[#d4a574]/20 bg-[#d4a574]/15',
    iconColor: 'text-[#b58a5c]',
    title: 'Last mercy this month',
    titleColor: 'text-[#b58a5c]',
    descColor: 'text-[#a67c52]',
  },
  loss: {
    icon: AlertTriangleIcon,
    container: 'border-[#c45c4a]/20 bg-[#c45c4a]/10',
    iconColor: 'text-[#c45c4a]',
    title: 'Late cancellation — credits will not be refunded',
    titleColor: 'text-[#c45c4a]',
    descColor: 'text-[#b54a38]',
  },
} as const;

import type { CreditType } from '@/lib/config/class-types';

export type CancellationPolicyBannerProps = {
  startsAt: Date;
  /** Mercy uses still available this calendar month (0..MERCY_USES_PER_MONTH). */
  mercyUsesLeft: number;
  creditsAtStake: number;
  creditType: CreditType;
  rescheduledAt?: Date | null;
  bookedAt?: Date | null;
};

export function CancellationPolicyBanner({
  startsAt,
  mercyUsesLeft,
  creditsAtStake,
  creditType,
  rescheduledAt,
  bookedAt,
}: CancellationPolicyBannerProps) {
  const policy = resolveCancellationPolicy(startsAt, mercyUsesLeft, new Date(), rescheduledAt, bookedAt);
  const v = VARIANTS[policy.state];
  const Icon = v.icon;

  const isSession = creditType === 'session';
  const creditNoun = isSession ? 'Session credit' : 'Credit';
  const creditLabel = `${creditsAtStake} ${creditNoun}${creditsAtStake === 1 ? '' : 's'}`;
  const windowHours = CANCELLATION_WINDOW_HOURS;
  const limit = policy.mercyUsesLimit;

  let description: string;
  if (policy.state === 'blocked') {
    description = `Cancellation is closed — the class starts in less than ${CANCELLATION_CUTOFF_HOURS} hours. Please contact the studio directly if you need to cancel.`;
  } else if (policy.state === 'rescheduled') {
    description = `This class was rescheduled after you booked. You have ${windowHours} hours from the reschedule notice to cancel for a full refund of ${creditLabel}.`;
  } else if (policy.state === 'free') {
    description = `You're outside the ${windowHours}-hour window (${policy.hoursUntilStart}h remaining). You'll receive a full refund of ${creditLabel}.`;
  } else if (policy.state === 'mercy') {
    description = `You're within the ${windowHours}-hour window. ${creditLabel} will be refunded — this counts as one mercy use. You have ${policy.mercyUsesLeft} of ${limit} mercy uses left this month.`;
  } else if (policy.state === 'mercy_last') {
    description = `This is your LAST late-cancellation mercy this month. ${creditLabel} will be refunded, but any further late cancellation before the 1st will forfeit credits.`;
  } else {
    description = `You've used all ${limit} late-cancellation mercy uses this month. ${creditLabel} will be forfeited. Your quota resets on the 1st.`;
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${v.container}`}
      role={policy.state === 'loss' ? 'alert' : 'note'}
    >
      <Icon className={`size-5 shrink-0 ${v.iconColor}`} aria-hidden />
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${v.titleColor}`}>{v.title}</p>
        <p className={`mt-0.5 text-xs leading-relaxed ${v.descColor}`}>{description}</p>
      </div>
    </div>
  );
}
