'use client';

import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  CalendarCheck,
  CalendarX,
  CreditCard,
  Zap,
  RotateCcw,
  Shield,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  Banknote,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityType = 'booking' | 'cancellation' | 'purchase' | 'membership' | 'credit_adjustment' | 'refund' | 'admin_action';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  actorName: string | null;
  actorEmail: string | null;
  targetName: string;
  targetDetail: string;
  timestamp: Date;
  status: string;

  // Expanded details
  details: {
    /** Credit impact: how many credits of what type */
    creditImpact?: { amount: number; type: string };
    /** Class/session info for bookings */
    sessionInfo?: {
      startsAt: Date | string | null;
      instructorName: string | null;
      durationMinutes: number | null;
      capacity?: { booked: number; max: number };
    };
    /** Payment info for purchases */
    paymentInfo?: {
      priceCents: number;
      paymentMethod: string;
      paymentStatus: string;
    };
    /** Membership info for subscriptions */
    membershipInfo?: {
      planName: string;
      durationWeeks: number;
      weeklyCredits: number;
      creditType: string;
      startedAt: Date | string;
      endsAt: Date | string;
      status: string;
    };
    /** Who performed an admin action */
    adminInfo?: {
      adminName: string | null;
      reason: string | null;
    };
    /** Human-readable explanation of what happened and why */
    operationContext: string;
    /** Technical IDs for traceability (shown in a subtle, non-scary way) */
    traceIds?: {
      bookingId?: string;
      purchaseId?: string;
      transactionId?: string;
      adjustmentId?: string;
      membershipId?: string;
    };
  };
}

interface Props {
  items: ActivityItem[];
  initialLimit?: number;
}

// ─── Visual config per activity type ──────────────────────────────────────────

const TYPE_CONFIG: Record<ActivityType, { icon: React.ElementType; label: string; color: string; bg: string; border: string }> = {
  booking: {
    icon: CalendarCheck,
    label: 'Booked',
    color: 'text-[#4a7c4a]',
    bg: 'bg-[#6b8e6b]/8',
    border: 'border-[#6b8e6b]/20',
  },
  cancellation: {
    icon: CalendarX,
    label: 'Cancelled',
    color: 'text-[#c45c4a]',
    bg: 'bg-[#c45c4a]/8',
    border: 'border-[#c45c4a]/20',
  },
  purchase: {
    icon: CreditCard,
    label: 'Purchased',
    color: 'text-[#8b5a3c]',
    bg: 'bg-[#8b5a3c]/8',
    border: 'border-[#8b5a3c]/20',
  },
  membership: {
    icon: CalendarCheck,
    label: 'Subscribed',
    color: 'text-[#7a5a9e]',
    bg: 'bg-[#7a5a9e]/8',
    border: 'border-[#7a5a9e]/20',
  },
  credit_adjustment: {
    icon: Zap,
    label: 'Adjusted',
    color: 'text-[#d4a574]',
    bg: 'bg-[#d4a574]/10',
    border: 'border-[#d4a574]/25',
  },
  refund: {
    icon: RotateCcw,
    label: 'Refunded',
    color: 'text-[#6b8e6b]',
    bg: 'bg-[#6b8e6b]/8',
    border: 'border-[#6b8e6b]/20',
  },
  admin_action: {
    icon: Shield,
    label: 'Admin',
    color: 'text-[#64748b]',
    bg: 'bg-[#64748b]/8',
    border: 'border-[#64748b]/20',
  },
};

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

function formatPriceCents(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function CreditTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    pass: 'Universal Credits',
    mat_pass: 'Mat Credits',
    reformer_pass: 'Reformer Credits',
    session: 'Session Credits',
  };
  return labels[type] ?? type;
}

function PaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    stripe: 'Stripe (online)',
    pay_at_studio: 'Pay at Studio / Bank Transfer',
    bank_transfer: 'Bank Transfer',
    cash: 'Cash',
    sound_healing_credits: 'Sound Healing Credits',
  };
  return labels[method] ?? method;
}

// ─── Expanded detail rows ─────────────────────────────────────────────────────

function DetailRow({
  icon: Icon,
  label,
  children,
  highlight = false,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-md mt-0.5',
          highlight ? 'bg-[#6b8e6b]/10 text-[#4a7c4a]' : 'bg-[#ede8e5]/50 text-[#8b6b5c]',
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a6856f]">{label}</p>
        <div className="text-sm text-[#4e2b22] mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function TraceIdRow({ ids }: { ids?: ActivityItem['details']['traceIds'] }) {
  if (!ids) return null;
  const entries = Object.entries(ids).filter(([, v]) => !!v);
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-[#ede8e5]/60">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a6856f] mb-1.5">Reference IDs</p>
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, value]) => (
          <code
            key={key}
            className="inline-flex items-center rounded-md bg-[#ede8e5]/40 px-2 py-1 text-[10px] font-mono text-[#8b6b5c]"
            title={key}
          >
            {String(value)}
          </code>
        ))}
      </div>
      <p className="text-[10px] text-[#a6856f] mt-1.5">
        These IDs help trace this operation in the system if you ever need to investigate with support.
      </p>
    </div>
  );
}

// ─── Single activity card ─────────────────────────────────────────────────────

function ActivityCard({ item }: { item: ActivityItem }) {
  const [expanded, setExpanded] = useState(false);
  const config = TYPE_CONFIG[item.type];
  const Icon = config.icon;
  const isPositive = item.type === 'booking' || item.type === 'purchase';
  const isNegative = item.type === 'cancellation';

  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-200',
        expanded
          ? 'border-[#c4a88a]/30 shadow-[0_4px_20px_rgba(78,43,34,0.06)]'
          : 'border-[#ede8e5]/60 hover:border-[#c4a88a]/30',
      )}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        {/* Icon */}
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl',
            config.bg,
            config.color,
          )}
        >
          <Icon className="size-4" />
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-[#4e2b22]">{item.actorName ?? 'Unknown'}</span>
            <span className={cn('text-xs font-medium', config.color)}>{config.label.toLowerCase()}</span>
            <span className="text-sm font-medium text-[#4e2b22] truncate">{item.targetName}</span>
          </div>
          <p className="text-xs text-[#8b6b5c] mt-0.5 truncate">{item.targetDetail}</p>
          <p className="text-[11px] text-[#a6856f] mt-1">{formatTimeAgo(item.timestamp)}</p>
        </div>

        {/* Expand chevron */}
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#ede8e5] text-[#8b6b5c] mt-0.5">
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </span>
      </button>

      {/* Expanded details */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 border-t border-[#ede8e5]/40">
            <div className="pt-4 space-y-3">
              {/* ── What happened ── */}
              <DetailRow icon={FileText} label="What happened" highlight>
                <p className="text-sm leading-relaxed">{item.details.operationContext}</p>
              </DetailRow>

              {/* ── Credit impact ── */}
              {item.details.creditImpact && (
                <DetailRow icon={Zap} label="Credit impact">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                        isPositive
                          ? 'bg-[#6b8e6b]/10 text-[#4a7c4a]'
                          : isNegative
                            ? 'bg-[#c45c4a]/10 text-[#c45c4a]'
                            : 'bg-[#d4a574]/10 text-[#8b5c2a]',
                      )}
                    >
                      {isPositive ? '+' : isNegative ? '-' : '±'}
                      {Math.abs(item.details.creditImpact.amount)} {CreditTypeLabel(item.details.creditImpact.type)}
                    </span>

                  </div>
                </DetailRow>
              )}

              {/* ── Session info (bookings) ── */}
              {item.details.sessionInfo && item.details.sessionInfo.startsAt && (
                <DetailRow icon={Clock} label="Class details">
                  <div className="space-y-1">
                    <p className="text-sm">
                      {format(new Date(item.details.sessionInfo.startsAt), 'EEEE, MMM d')} at{' '}
                      {format(new Date(item.details.sessionInfo.startsAt), 'HH:mm')}
                      {item.details.sessionInfo.durationMinutes
                        ? ` · ${item.details.sessionInfo.durationMinutes} min`
                        : ''}
                    </p>
                    {item.details.sessionInfo.instructorName && (
                      <p className="text-xs text-[#8b6b5c]">
                        Instructor: {item.details.sessionInfo.instructorName}
                      </p>
                    )}
                    {item.details.sessionInfo.capacity && (
                      <p className="text-xs text-[#8b6b5c]">
                        Capacity:{' '}
                        <span className="font-medium text-[#4e2b22]">
                          {item.details.sessionInfo.capacity.booked}/{item.details.sessionInfo.capacity.max}
                        </span>{' '}
                        booked
                      </p>
                    )}
                  </div>
                </DetailRow>
              )}

              {/* ── Payment info (purchases) ── */}
              {item.details.paymentInfo && (
                <DetailRow icon={Banknote} label="Payment">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#4e2b22]">
                      {formatPriceCents(item.details.paymentInfo.priceCents)}
                    </p>
                    <p className="text-xs text-[#8b6b5c]">
                      Method: {PaymentMethodLabel(item.details.paymentInfo.paymentMethod)}
                    </p>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        item.details.paymentInfo.paymentStatus === 'paid'
                          ? 'bg-[#6b8e6b]/10 text-[#4a7c4a]'
                          : item.details.paymentInfo.paymentStatus === 'overdue'
                            ? 'bg-[#c45c4a]/10 text-[#c45c4a]'
                            : 'bg-[#d4a574]/10 text-[#8b5c2a]',
                      )}
                    >
                      {item.details.paymentInfo.paymentStatus === 'paid' && <CheckCircle2 className="size-3" />}
                      {item.details.paymentInfo.paymentStatus === 'overdue' && <AlertCircle className="size-3" />}
                      {item.details.paymentInfo.paymentStatus}
                    </span>
                  </div>
                </DetailRow>
              )}

              {/* ── Membership info ── */}
              {item.details.membershipInfo && (
                <DetailRow icon={CalendarCheck} label="Membership">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#4e2b22]">
                      {item.details.membershipInfo.planName}
                    </p>
                    <p className="text-xs text-[#8b6b5c]">
                      {item.details.membershipInfo.durationWeeks} weeks · {item.details.membershipInfo.weeklyCredits} {CreditTypeLabel(item.details.membershipInfo.creditType)}/week
                    </p>
                    <p className="text-xs text-[#8b6b5c]">
                      Valid: {format(new Date(item.details.membershipInfo.startedAt), 'MMM d, yyyy')} — {format(new Date(item.details.membershipInfo.endsAt), 'MMM d, yyyy')}
                    </p>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        item.details.membershipInfo.status === 'active'
                          ? 'bg-[#6b8e6b]/10 text-[#4a7c4a]'
                          : item.details.membershipInfo.status === 'cancelled'
                            ? 'bg-[#c45c4a]/10 text-[#c45c4a]'
                            : 'bg-[#d4a574]/10 text-[#8b5c2a]',
                      )}
                    >
                      {item.details.membershipInfo.status}
                    </span>
                  </div>
                </DetailRow>
              )}

              {/* ── Admin info (adjustments) ── */}
              {item.details.adminInfo && (
                <DetailRow icon={Shield} label="Admin action">
                  <div className="space-y-1">
                    <p className="text-sm">
                      By: <span className="font-medium text-[#4e2b22]">{item.details.adminInfo.adminName ?? 'System'}</span>
                    </p>
                    {item.details.adminInfo.reason && (
                      <p className="text-xs text-[#8b6b5c]">Reason: {item.details.adminInfo.reason}</p>
                    )}
                  </div>
                </DetailRow>
              )}

              {/* ── Actor contact ── */}
              {item.actorEmail && (
                <DetailRow icon={User} label="Contact">
                  <p className="text-sm text-[#8b6b5c]">{item.actorEmail}</p>
                </DetailRow>
              )}

              {/* ── Trace IDs ── */}
              <TraceIdRow ids={item.details.traceIds} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main feed component ──────────────────────────────────────────────────────

export function RecentActivityFeed({ items, initialLimit = 8 }: Props) {
  const [showAll, setShowAll] = useState(false);
  const visibleItems = showAll ? items : items.slice(0, initialLimit);
  const hasMore = items.length > initialLimit;

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-[#ede8e5] bg-[#faf9f7]/30">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-[#ede8e5]/50">
            <FileText className="size-5 text-[#c4a88a]" />
          </div>
          <p className="text-sm font-semibold text-[#4e2b22]">No recent activity</p>
          <p className="text-xs text-[#8b6b5c] mt-1 max-w-xs">
            Activity will appear here when students book classes, make purchases, or admins make adjustments.
          </p>
        </div>
      ) : (
        <>
          {visibleItems.map((item) => (
            <ActivityCard key={`${item.type}-${item.id}`} item={item} />
          ))}

          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full rounded-xl border border-[#ede8e5] py-2.5 text-xs font-medium text-[#8b6b5c] transition-all hover:border-[#c4a88a]/50 hover:text-[#4e2b22] hover:bg-[#faf9f7]"
            >
              {showAll ? `Show less` : `Show ${items.length - initialLimit} more activities`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
