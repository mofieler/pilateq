import Link from 'next/link';
import {
  Layers,
  AlertCircleIcon,
  UserIcon,
  InfoIcon,
  ClockIcon,
} from 'lucide-react';
import { getClassTypeBadgeStyle } from '@/lib/config/class-types';
import type { CreditType } from '@/lib/config/class-types';
import { formatStudio } from '@/lib/utils/date.utils';

// Custom Mat Icon representing a Pilates/yoga mat
function MatIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="2" y="7" width="20" height="10" rx="1.5" />
      <path d="M6 7v10" />
      <path d="M18 7v10" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreditBalance = {
  creditType: CreditType;
  balance: number;
  expiresAt: Date | null;
};

function earliestExpiry(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

// ─── Group credit card (pass, mat_pass) ───────────────────────────────────────

function GroupCreditCard({
  balance,
  title,
  subtitle,
  icon: Icon,
  iconBgClass,
  iconTextClass,
  ringClass,
  validClasses,
}: {
  balance: CreditBalance;
  title: string;
  subtitle: string;
  icon: React.ComponentType<any>;
  iconBgClass: string;
  iconTextClass: string;
  ringClass: string;
  validClasses: Array<{ label: string; badgeStyle: string }>;
}) {
  const isLow = balance.balance > 0 && balance.balance <= 3;
  const isEmpty = balance.balance === 0;

  return (
    <div className={`flex flex-col gap-4 rounded-2xl border border-[#ede8e5]/60 bg-linear-to-br from-[#faf9f5] to-[#f5ede0] p-5 ${ringClass} shadow-[0_4px_14px_rgba(78,43,34,0.04)] transition-all duration-300 hover:shadow-[0_8px_24px_rgba(78,43,34,0.08)]`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`inline-flex size-9 items-center justify-center rounded-xl ${iconBgClass} ${iconTextClass} shadow-xs`}>
            <Icon className="size-4.5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-[#4e2b22]">{title}</p>
            <p className="text-xs text-[#6b4a3d] font-medium leading-relaxed mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-extrabold tabular-nums leading-none tracking-tight text-[#4e2b22]">
            {balance.balance}
          </p>
          <p className="text-[10px] font-semibold text-[#6b4a3d] mt-1">credits available</p>
        </div>
      </div>

      {/* Valid classes badges */}
      <div className="flex flex-col gap-1.5 border-t border-[#ede8e5]/40 pt-3">
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#7a5a4a]">Valid for classes:</p>
        <div className="flex flex-wrap gap-1.5">
          {validClasses.map((cls, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-semibold shadow-2xs ${cls.badgeStyle}`}
            >
              {cls.label}
            </span>
          ))}
        </div>
      </div>

      {title === 'Pass Credits' && (
        <div className="flex items-center gap-1.5 rounded-lg border border-[#c4a88a]/20 bg-[#c4a88a]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#6b4a3d]">
          <InfoIcon className="size-3 shrink-0" />
          Includes Pass and Reformer Pass — both valid for the same group classes.
        </div>
      )}

      {balance.expiresAt && !isEmpty && (
        <div className="flex items-center gap-1.5 rounded-lg border border-[#c4a88a]/20 bg-[#c4a88a]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#6b4a3d]">
          <ClockIcon className="size-3 shrink-0" />
          Expires {formatStudio(balance.expiresAt, 'dd.MM.yyyy')}
        </div>
      )}

      {isLow && !isEmpty && (
        <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
          <AlertCircleIcon className="size-3 shrink-0" />
          Running low — consider topping up
        </div>
      )}

      {isEmpty && (
        <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
          <AlertCircleIcon className="size-3 shrink-0" />
          No credits —{' '}
          <Link href="/credits" className="underline underline-offset-2 font-semibold text-amber-700">
            buy a pack
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Private & Duo session section ───────────────────────────────────────────

function SessionPackagesSection({
  sessionBalance,
}: {
  sessionBalance: CreditBalance;
}) {
  const isEmpty = sessionBalance.balance === 0;

  const validClasses = [
    { label: 'Reformer Private', badgeStyle: getClassTypeBadgeStyle('reformer_private') },
    { label: 'Reformer Duo', badgeStyle: getClassTypeBadgeStyle('reformer_duo') },
    { label: 'Mat Private', badgeStyle: getClassTypeBadgeStyle('mat_private') },
    { label: 'Mat Duo', badgeStyle: getClassTypeBadgeStyle('mat_duo') },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#ede8e5]/60 bg-linear-to-br from-[#faf9f5] to-[#f5ede0] p-5 ring-1 ring-[#c4a88a]/30 shadow-[0_4px_14px_rgba(78,43,34,0.04)] transition-all duration-300 hover:shadow-[0_8px_24px_rgba(78,43,34,0.08)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[#c4a88a]/20 text-[#4e2b22] shadow-xs">
            <UserIcon className="size-4.5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-[#4e2b22]">Private &amp; Duo Sessions</p>
            <p className="text-xs text-[#6b4a3d] font-medium leading-relaxed mt-0.5">Separate private/duo session credits.</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-extrabold tabular-nums leading-none tracking-tight text-[#4e2b22]">
            {sessionBalance.balance}
          </p>
          <p className="text-[10px] font-semibold text-[#6b4a3d] mt-1">credits available</p>
        </div>
      </div>

      {/* Valid classes badges */}
      <div className="flex flex-col gap-1.5 border-t border-[#ede8e5]/40 pt-3">
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#7a5a4a]">Valid for classes:</p>
        <div className="flex flex-wrap gap-1.5">
          {validClasses.map((cls, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-semibold shadow-2xs ${cls.badgeStyle}`}
            >
              {cls.label}
            </span>
          ))}
        </div>
      </div>

      {sessionBalance.expiresAt && !isEmpty && (
        <div className="flex items-center gap-1.5 rounded-lg border border-[#c4a88a]/20 bg-[#c4a88a]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#6b4a3d]">
          <ClockIcon className="size-3 shrink-0" />
          Expires {formatStudio(sessionBalance.expiresAt, 'dd.MM.yyyy')}
        </div>
      )}

      {isEmpty ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
          <AlertCircleIcon className="size-3 shrink-0" />
          No session credits —{' '}
          <Link href="/credits" className="underline underline-offset-2 font-semibold text-amber-700">
            buy a pack
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
          <AlertCircleIcon className="size-3 shrink-0" />
          Session credits available — book a private or duo class
        </div>
      )}
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function CreditBalanceDisplay({
  balances,
}: {
  balances: CreditBalance[];
}) {
  const rawPassBalance = balances.find((b) => b.creditType === 'pass')
    ?? { creditType: 'pass' as const, balance: 0, expiresAt: null };
  const rawReformerPassBalance = balances.find((b) => b.creditType === 'reformer_pass')
    ?? { creditType: 'reformer_pass' as const, balance: 0, expiresAt: null };

  // Combine Pass and Reformer Pass (as they are functionally identical group credits)
  // The combined expiry is the earliest future expiry among the two types.
  const passBalance = {
    ...rawPassBalance,
    balance: rawPassBalance.balance + rawReformerPassBalance.balance,
    expiresAt: earliestExpiry(rawPassBalance.expiresAt, rawReformerPassBalance.expiresAt),
  };

  const matPassBalance = balances.find((b) => b.creditType === 'mat_pass')
    ?? { creditType: 'mat_pass' as const, balance: 0, expiresAt: null };
  const sessionBalance = balances.find((b) => b.creditType === 'session');

  // Valid classes mapping for display — uses centralized muted palette
  const passValidClasses = [
    { label: 'Reformer Group', badgeStyle: getClassTypeBadgeStyle('reformer_group') },
    { label: 'Mat Group', badgeStyle: getClassTypeBadgeStyle('mat_group') },
    { label: 'Yoga', badgeStyle: getClassTypeBadgeStyle('yoga') },
    { label: 'Chair Pilates', badgeStyle: getClassTypeBadgeStyle('chair') },
    { label: 'Online Class', badgeStyle: getClassTypeBadgeStyle('online') },
    { label: 'Sound Healing', badgeStyle: getClassTypeBadgeStyle('sound_healing') },
  ];

  const matPassValidClasses = [
    { label: 'Mat Group', badgeStyle: getClassTypeBadgeStyle('mat_group') },
    { label: 'Yoga', badgeStyle: getClassTypeBadgeStyle('yoga') },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <GroupCreditCard
        balance={passBalance}
        title="Pass Credits"
        subtitle="Universal group class credit."
        icon={Layers}
        iconBgClass="bg-[#c4a88a]/25"
        iconTextClass="text-[#4e2b22]"
        ringClass="ring-1 ring-[#c4a88a]/30"
        validClasses={passValidClasses}
      />
      <GroupCreditCard
        balance={matPassBalance}
        title="Mat Pass Credits"
        subtitle="Restricted group class membership."
        icon={MatIcon}
        iconBgClass="bg-[#c4a88a]/25"
        iconTextClass="text-[#4e2b22]"
        ringClass="ring-1 ring-[#c4a88a]/30"
        validClasses={matPassValidClasses}
      />
      <SessionPackagesSection
        sessionBalance={sessionBalance ?? { creditType: 'session', balance: 0, expiresAt: null }}
      />
    </div>
  );
}
