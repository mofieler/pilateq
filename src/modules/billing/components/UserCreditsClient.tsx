'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatStudio } from '@/lib/utils/date.utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  adjustUserCreditsAction,
  getUserCreditTransactionsAction,
} from '@/modules/billing/actions/adminCredits.actions';
import {
  getActiveCreditPackagesAction,
  type CreditPackageRow,
} from '@/modules/billing/actions/membership.actions';
import { createManualPurchaseAction } from '@/modules/billing/actions/creditPurchase.actions';
import type { CreditType } from '@/db/schema';
import {
  Coins,
  Plus,
  Minus,
  Search,
  ChevronRight,
  ChevronDown,
  History,
  AlertCircle,
  CheckCircle2,
  User,
  Clock,
  Package,
  CalendarDays,
} from 'lucide-react';
import { UserAvatar } from '@/modules/users/components/UserAvatar';

// ─── Types ────────────────────────────────────────────────────────────────────
type CreditBalance = {
  id: string;
  creditType: string;
  balance: number;
  expiresAt: Date | null;
  updatedAt: Date;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  balances: CreditBalance[];
};

type Adjustment = {
  id: string;
  creditType: string;
  amountDelta: number;
  reason: string | null;
  createdAt: Date;
};

const CREDIT_TYPE_LABELS: Record<string, string> = {
  pass:          'Universal Credits',
  mat_pass:      'Mat Credits',
  reformer_pass: 'Reformer Credits',
  session:       'Session Credits',
};

const CREDIT_TYPES = Object.keys(CREDIT_TYPE_LABELS) as (keyof typeof CREDIT_TYPE_LABELS)[];

const CREDIT_TYPE_COLORS: Record<string, string> = {
  pass:          'bg-[#c4a88a]/20 text-[#4e2b22] border-[#c4a88a]/40',
  mat_pass:      'bg-[#8b9a6b]/20 text-[#4e5a3b] border-[#8b9a6b]/40',
  reformer_pass: 'bg-[#7a8e9e]/20 text-[#2e3b4a] border-[#7a8e9e]/40',
  session:       'bg-[#4e2b22]/10 text-[#4e2b22] border-[#4e2b22]/20',
};

function BalancePill({ creditType, balance }: { creditType: string; balance: number }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full text-xs font-semibold tabular-nums',
        CREDIT_TYPE_COLORS[creditType] ?? 'bg-[#ede8e5] text-[#6b4a3d]',
      )}
    >
      {balance} {CREDIT_TYPE_LABELS[creditType] ?? creditType}
    </Badge>
  );
}

// ─── Unified Manage Credits Form ──────────────────────────────────────────────

type ActionMode = 'add' | 'deduct' | 'grant';
type SourceMode = 'preset' | 'custom';

function ManageCreditsForm({
  userId,
  userName,
  onSuccess,
}: {
  userId: string;
  userName: string;
  onSuccess: (delta: number, creditType: string, newBalance: number) => void;
}) {
  // ── Action mode ──
  const [action, setAction] = useState<ActionMode>('add');

  // ── Source mode (only for add/grant) ──
  const [source, setSource] = useState<SourceMode>('custom');

  // ── Packages ──
  const [packages, setPackages] = useState<CreditPackageRow[]>([]);
  const [packagesLoaded, setPackagesLoaded] = useState(false);
  const [packageId, setPackageId] = useState('');

  // ── Fields ──
  const [creditType, setCreditType] = useState(CREDIT_TYPES[0]);
  const [amount, setAmount] = useState('');
  const [validityWeeks, setValidityWeeks] = useState('');
  const [startDate, setStartDate] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isWelcomeCredit, setIsWelcomeCredit] = useState(false);

  // ── Status ──
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPending, startTransition] = useTransition();

  // Load packages once
  useEffect(() => {
    if (!packagesLoaded) {
      getActiveCreditPackagesAction().then((res) => {
        if (res.success) {
          setPackages(res.data);
          // Auto-select first package if available
          if (res.data.length > 0 && !packageId) {
            setPackageId(res.data[0].id);
          }
        }
        setPackagesLoaded(true);
      });
    }
  }, [packagesLoaded, packageId]);

  // Auto-populate fields from package selection
  useEffect(() => {
    if (action === 'grant' && source === 'preset' && packageId) {
      const pkg = packages.find((p) => p.id === packageId);
      if (pkg) {
        setAmount(String(pkg.creditsAmount));
        setCreditType(pkg.creditType as any);
        setValidityWeeks(String(Math.ceil((pkg.validityDays ?? 365) / 7)));
      }
    }
  }, [packageId, source, action, packages]);

  // Reset source when switching to deduct
  useEffect(() => {
    if (action === 'deduct') {
      setSource('custom');
      setIsWelcomeCredit(false);
    }
  }, [action]);

  // Reset welcome credit when switching away from add
  useEffect(() => {
    if (action !== 'add') {
      setIsWelcomeCredit(false);
    }
  }, [action]);

  function resetForm() {
    setAmount('');
    setValidityWeeks('');
    setStartDate('');
    setReason('');
    setNotes('');
    setIsWelcomeCredit(false);
    setError('');
    // Keep packageId and source for convenience
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const isWelcome = action === 'add' && isWelcomeCredit;
    const typeToSend = isWelcome ? 'session' : creditType;
    const amtToSend = isWelcome ? 1 : parseInt(amount, 10);

    if (!isWelcome && (!amtToSend || amtToSend <= 0)) {
      setError('Enter a positive whole number.');
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required.');
      return;
    }

    // Validate start date is not in the future
    if (startDate) {
      const sd = new Date(startDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (sd > now) {
        setError('Start date cannot be in the future.');
        return;
      }
    }

    const actionLabel = action === 'add' ? 'add' : action === 'deduct' ? 'deduct' : 'grant';
    const displayAmount = isWelcome ? 1 : amtToSend;
    const displayType = isWelcome ? 'Welcome Credit' : CREDIT_TYPE_LABELS[typeToSend] ?? typeToSend;
    const confirmMessage =
      action === 'grant'
        ? `Grant ${displayAmount} ${displayType} to ${userName}?${source === 'preset' && packageId ? ' (from package)' : ''}\n\nReason: ${reason.trim()}`
        : `${actionLabel === 'add' ? 'Add' : 'Deduct'} ${displayAmount} ${displayType} for ${userName}?\n\nReason: ${reason.trim()}`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    startTransition(async () => {
      if (action === 'grant') {
        // ── Grant Package ──
        const result = await createManualPurchaseAction({
          userId,
          packageId: source === 'preset' ? packageId || undefined : undefined,
          creditsAmount: amtToSend,
          creditType: typeToSend as CreditType,
          priceCents: 0,
          currency: 'eur',
          paymentMethod: 'pay_at_studio',
          paymentStatus: 'paid',
          paidAt: startDate ? new Date(startDate).toISOString() : undefined,
          validityWeeks: validityWeeks ? parseInt(validityWeeks, 10) : undefined,
          adminNotes: reason.trim(),
          generateInvoice: false,
        });

        if (!result.success) {
          setError(result.error ?? 'Something went wrong');
          return;
        }
        if (!result.data) {
          setError('Something went wrong');
          return;
        }

        setSuccess(`+${amtToSend} ${CREDIT_TYPE_LABELS[typeToSend]}. New balance: ${result.data.newBalance}`);
        onSuccess(amtToSend, typeToSend, result.data.newBalance);
        resetForm();
      } else {
        // ── Add or Deduct ──
        const delta = action === 'add' ? amtToSend : -amtToSend;

        const result = await adjustUserCreditsAction({
          userId,
          creditType: typeToSend as CreditType,
          amountDelta: delta,
          reason: reason.trim(),
        });

        if (!result.success) {
          setError(result.error ?? 'Something went wrong');
          return;
        }

        const label = isWelcome ? 'Welcome Credit' : CREDIT_TYPE_LABELS[typeToSend];
        setSuccess(`${action === 'add' ? '+' : '-'}${amtToSend} ${label}. New balance: ${result.data.newBalance}`);
        onSuccess(delta, typeToSend, result.data.newBalance);
        resetForm();
      }
    });
  }

  // ── Derived UI state ──
  const showSourceToggle = action !== 'deduct';
  const showPackageSelect = action === 'grant' && source === 'preset';
  const showCreditFields = action !== 'grant' || source === 'custom' || !packageId;
  const isPresetLocked = action === 'grant' && source === 'preset' && !!packageId;
  const showValidity = action !== 'deduct' && !isWelcomeCredit;
  const showWelcomeCheckbox = action === 'add';
  const showNotes = action !== 'grant'; // Notes only for adjustments

  const canSubmit =
    !isPending &&
    reason.trim() &&
    (isWelcomeCredit || !!amount) &&
    !(action === 'grant' && source === 'preset' && !packageId);

  const submitLabel =
    isPending
      ? 'Saving…'
      : action === 'add'
      ? 'Add credits'
      : action === 'deduct'
      ? 'Deduct credits'
      : 'Grant package';

  const submitColor =
    action === 'add'
      ? 'bg-[#6b8e6b] hover:bg-[#4a7c4a] text-white'
      : action === 'deduct'
      ? 'bg-[#c45c4a] hover:bg-[#a33a29] text-white'
      : 'bg-[#4e2b22] hover:bg-[#3a1f18] text-white';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <p className="text-sm font-semibold text-[#4e2b22]">Manage credits for {userName}</p>

      {/* ── Action toggle: Add / Deduct / Grant ── */}
      <div className="flex rounded-xl overflow-hidden border border-[#ede8e5]">
        {([
          { key: 'add', label: 'Add', icon: Plus, color: 'bg-[#6b8e6b] text-white' },
          { key: 'deduct', label: 'Deduct', icon: Minus, color: 'bg-[#c45c4a] text-white' },
          { key: 'grant', label: 'Grant Package', icon: Package, color: 'bg-[#4e2b22] text-white' },
        ] as const).map((btn) => {
          const Icon = btn.icon;
          const active = action === btn.key;
          return (
            <button
              key={btn.key}
              type="button"
              onClick={() => setAction(btn.key)}
              className={cn(
                'flex-1 min-h-[44px] py-2 text-xs font-semibold flex items-center justify-center gap-1 transition-all',
                active ? btn.color : 'bg-[#faf9f7] text-[#6b4a3d] hover:bg-[#ede8e5]',
              )}
            >
              <Icon className="size-3" aria-hidden />
              {btn.label}
            </button>
          );
        })}
      </div>

      {/* ── Source toggle (Add / Grant only) ── */}
      {showSourceToggle && (
        <div className="flex rounded-xl overflow-hidden border border-[#ede8e5]">
          {([
            { key: 'preset' as const, label: 'From Package' },
            { key: 'custom' as const, label: 'Custom' },
          ]).map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => setSource(btn.key)}
              className={cn(
                'flex-1 min-h-[44px] py-2 text-xs font-semibold flex items-center justify-center gap-1 transition-all',
                source === btn.key
                  ? 'bg-[#4e2b22] text-white'
                  : 'bg-[#faf9f7] text-[#6b4a3d] hover:bg-[#ede8e5]',
              )}
            >
              <Package className="size-3" aria-hidden />
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Package selector ── */}
      {showPackageSelect && (
        <div>
          <label className="block text-xs font-medium text-[#6b4a3d] mb-1.5">Package</label>
          <select
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            disabled={isPending || !packagesLoaded}
            className="w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] focus:border-[#c4a88a] focus:outline-none"
          >
            {packages.length === 0 && <option value="">No packages available</option>}
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name} — {pkg.creditsAmount} {CREDIT_TYPE_LABELS[pkg.creditType] ?? pkg.creditType}
                {pkg.validityDays ? ` (${Math.ceil(pkg.validityDays / 7)}w)` : ''}
              </option>
            ))}
          </select>
          {!packagesLoaded && <p className="text-xs text-[#7a5a4a] mt-1">Loading packages…</p>}
        </div>
      )}

      {/* ── Welcome Credit checkbox ── */}
      {showWelcomeCheckbox && (
        <div className="flex items-center gap-2 py-1">
          <input
            type="checkbox"
            id={`welcome-credit-${userId}`}
            checked={isWelcomeCredit}
            onChange={(e) => {
              const checked = e.target.checked;
              setIsWelcomeCredit(checked);
              if (checked) {
                setCreditType('session');
                setAmount('1');
              }
            }}
            disabled={isPending}
            className="rounded border-[#ede8e5] text-[#4e2b22] focus:ring-[#c4a88a] focus:ring-offset-0 size-4 cursor-pointer"
          />
          <label
            htmlFor={`welcome-credit-${userId}`}
            className="text-xs font-semibold text-[#6b3d32] cursor-pointer select-none"
          >
            Welcome Credit (always exactly 1 Session Credit)
          </label>
        </div>
      )}

      {/* ── Credit Type ── */}
      <div>
        <label className="block text-xs font-medium text-[#6b4a3d] mb-1.5">Credit Type</label>
        <select
          value={isWelcomeCredit ? 'session' : creditType}
          onChange={(e) => setCreditType(e.target.value as any)}
          disabled={isWelcomeCredit || isPending || isPresetLocked}
          className={cn(
            'w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] focus:border-[#c4a88a] focus:outline-none',
            (isWelcomeCredit || isPresetLocked) && 'opacity-60 cursor-not-allowed bg-[#ede8e5]/40',
          )}
        >
          {CREDIT_TYPES.map((t) => (
            <option key={t} value={t}>{CREDIT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* ── Amount ── */}
      <div>
        <label className="block text-xs font-medium text-[#6b4a3d] mb-1.5">
          Amount <span className="text-[#c45c4a]">*</span>
        </label>
        <input
          type="number"
          min={1}
          value={isWelcomeCredit ? '1' : amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 5"
          disabled={isWelcomeCredit || isPending || isPresetLocked}
          className={cn(
            'w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] placeholder:text-[#7a5a4a] focus:border-[#c4a88a] focus:outline-none',
            (isWelcomeCredit || isPresetLocked) && 'opacity-60 cursor-not-allowed bg-[#ede8e5]/40',
          )}
        />
      </div>

      {/* ── Validity ── */}
      {showValidity && (
        <div>
          <label className="block text-xs font-medium text-[#6b4a3d] mb-1.5">
            Valid for <span className="font-normal text-[#7a5a4a]">(weeks)</span>
          </label>
          <div className="relative">
            <input
              type="number"
              min={1}
              max={156}
              value={validityWeeks}
              onChange={(e) => setValidityWeeks(e.target.value)}
              placeholder="e.g. 8"
              disabled={isPending || isPresetLocked}
              className={cn(
                'w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 pr-16 text-sm text-[#4e2b22] placeholder:text-[#7a5a4a] focus:border-[#c4a88a] focus:outline-none',
                isPresetLocked && 'opacity-60 cursor-not-allowed bg-[#ede8e5]/40',
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6b4a3d]">weeks</span>
          </div>
          <p className="mt-1 text-[10px] text-[#7a5a4a]">
            <Clock className="size-3 inline mr-0.5" aria-hidden />
            Leave empty for default validity (52 weeks). Expiry is calculated from start date (or today).
          </p>
        </div>
      )}

      {/* ── Start Date ── */}
      <div>
        <label className="block text-xs font-medium text-[#6b4a3d] mb-1.5">
          Start date <span className="font-normal text-[#7a5a4a]">(optional)</span>
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          disabled={isPending}
          max={new Date().toISOString().split('T')[0]}
          className="w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] focus:border-[#c4a88a] focus:outline-none"
        />
        <p className="mt-1 text-[10px] text-[#7a5a4a]">
          <CalendarDays className="size-3 inline mr-0.5" aria-hidden />
          Credits will be marked as acquired on this date. Defaults to today. Cannot be in the future.
        </p>
      </div>

      {/* ── Reason ── */}
      <div>
        <label className="block text-xs font-medium text-[#6b4a3d] mb-1.5">
          Reason <span className="text-[#c45c4a]">*</span>
          <span className="ml-1 font-normal">(stored in audit log)</span>
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Goodwill adjustment, trial class, corrective entry"
          disabled={isPending}
          maxLength={500}
          className="w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] placeholder:text-[#7a5a4a] focus:border-[#c4a88a] focus:outline-none"
        />
      </div>

      {/* ── Admin Notes ── */}
      {showNotes && (
        <div>
          <label className="block text-xs font-medium text-[#6b4a3d] mb-1.5">
            Admin notes <span className="text-[#7a5a4a] font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes — not shown to the student"
            disabled={isPending}
            rows={2}
            maxLength={1000}
            className="w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] placeholder:text-[#7a5a4a] focus:border-[#c4a88a] focus:outline-none resize-none"
          />
        </div>
      )}

      {/* ── Messages ── */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-[#c45c4a]/10 px-3 py-2.5 text-sm text-[#c45c4a]">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-xl bg-[#6b8e6b]/10 px-3 py-2.5 text-sm text-[#4a7c4a]">
          <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
          {success}
        </div>
      )}

      {/* ── Submit ── */}
      <Button
        type="submit"
        disabled={!canSubmit}
        className={cn('w-full min-h-[44px] rounded-xl font-semibold', submitColor)}
      >
        {submitLabel}
      </Button>
    </form>
  );
}

// ─── History Panel ────────────────────────────────────────────────────────────
function AdjustmentHistory({ userId }: { userId: string }) {
  const [history, setHistory]   = useState<Adjustment[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const [loading, setLoading]   = useState(false);

  async function load() {
    setLoading(true);
    const result = await getUserCreditTransactionsAction(userId);
    if (result.success) {
      setHistory(
        result.data.map((tx) => ({
          id: tx.id,
          creditType: tx.creditType,
          amountDelta: tx.amount,
          reason: tx.description,
          createdAt: tx.createdAt,
        })),
      );
    }
    setLoaded(true);
    setLoading(false);
  }

  if (!loaded) {
    return (
      <button
        onClick={load}
        disabled={loading}
        className="flex min-h-[44px] items-center gap-1.5 text-xs text-[#6b4a3d] hover:text-[#4e2b22] transition-colors mt-3"
      >
        <History className="size-3.5" aria-hidden />
        {loading ? 'Loading history…' : 'View adjustment history'}
      </button>
    );
  }

  if (history.length === 0) {
    return <p className="text-xs text-[#7a5a4a] mt-3">No manual adjustments yet.</p>;
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold text-[#6b4a3d] uppercase tracking-wide">Adjustment History</p>
      {history.map((h) => (
        <div key={h.id} className="flex items-start justify-between gap-3 rounded-lg bg-[#faf9f7] border border-[#ede8e5] px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'text-xs font-bold tabular-nums',
                  h.amountDelta > 0 ? 'text-[#4a7c4a]' : 'text-[#c45c4a]',
                )}
              >
                {h.amountDelta > 0 ? '+' : ''}{h.amountDelta}
              </span>
              <span className="text-xs text-[#6b4a3d]">
                {h.reason?.startsWith('[Welcome Journey]')
                  ? 'Welcome Credit'
                  : (CREDIT_TYPE_LABELS[h.creditType] ?? h.creditType)}
              </span>
            </div>
            <p className="text-xs text-[#6b3d32] mt-0.5 truncate">{h.reason ?? ''}</p>
          </div>
          <span className="text-xs text-[#7a5a4a] shrink-0 whitespace-nowrap">
            {formatStudio(new Date(h.createdAt), 'dd.MM.yy')}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────
function UserCard({ user }: { user: UserRow }) {
  const [open, setOpen]             = useState(false);
  const [balances, setBalances]     = useState(user.balances);
  const totalCredits = balances.reduce((s, b) => s + b.balance, 0);

  function handleAdjustment(delta: number, creditType: string, newBalance: number) {
    setBalances((prev) => {
      const exists = prev.find((b) => b.creditType === creditType);
      if (exists) {
        return prev.map((b) =>
          b.creditType === creditType ? { ...b, balance: newBalance, updatedAt: new Date() } : b,
        );
      }
      return [
        ...prev,
        {
          id:        crypto.randomUUID(),
          creditType,
          balance:   newBalance,
          expiresAt: null,
          updatedAt: new Date(),
        },
      ];
    });
  }

  return (
    <div
      className={cn(
        'rounded-2xl border transition-[border-color,box-shadow]',
        open
          ? 'border-[#c4a88a] shadow-[0_4px_20px_rgba(78,43,34,0.08)]'
          : 'border-[#ede8e5] hover:border-[#c4a88a]/50',
        'bg-gradient-to-br from-[#faf9f7]/90 to-[#f5f3f1]/60',
      )}
    >
      {/* Header row */}
      <button
        className="w-full flex items-center justify-between gap-4 p-4 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <UserAvatar name={user.name ?? 'User'} avatarUrl={user.avatarUrl} size="md" />
          <div>
            <p className="font-semibold text-[#4e2b22] text-sm">{user.name ?? '—'}</p>
            <p className="text-xs text-[#6b4a3d]">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {balances.length === 0 ? (
            <span className="text-xs text-[#7a5a4a]">no credits</span>
          ) : (
            <div className="flex flex-wrap gap-1 justify-end max-w-xs">
              {balances
                .filter((b) => b.balance > 0)
                .slice(0, 3)
                .map((b) => (
                  <BalancePill key={b.id} creditType={b.creditType} balance={b.balance} />
                ))}
              {balances.filter((b) => b.balance > 0).length > 3 && (
                <span className="text-xs text-[#7a5a4a]">+{balances.filter((b) => b.balance > 0).length - 3} more</span>
              )}
            </div>
          )}
          {open ? (
            <ChevronDown className="size-4 text-[#8b6b5c] shrink-0" aria-hidden />
          ) : (
            <ChevronRight className="size-4 text-[#8b6b5c] shrink-0" aria-hidden />
          )}
        </div>
      </button>

      {/* Expanded panel */}
      <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>        <div className="overflow-hidden">
        <div className="border-t border-[#ede8e5] px-4 pb-4 pt-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: balances + history */}
            <div>
              <p className="text-xs font-semibold text-[#6b4a3d] uppercase tracking-wide mb-3">
                Current Balances
              </p>
              {balances.length === 0 ? (
                <p className="text-sm text-[#7a5a4a]">No credits.</p>
              ) : (
                <div className="space-y-2">
                  {CREDIT_TYPES.map((ct) => {
                    const b = balances.find((x) => x.creditType === ct);
                    return (
                      <div
                        key={ct}
                        className="flex items-center justify-between rounded-xl border border-[#ede8e5] bg-white px-3 py-2"
                      >
                        <span className="text-sm text-[#6b3d32]">{CREDIT_TYPE_LABELS[ct]}</span>
                        <span
                          className={cn(
                            'font-bold tabular-nums text-sm',
                            (b?.balance ?? 0) > 0 ? 'text-[#4e2b22]' : 'text-[#7a5a4a]',
                          )}
                        >
                          {b?.balance ?? 0}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <AdjustmentHistory userId={user.id} />
            </div>

            {/* Right: unified manage credits form */}
            <div className="border-l border-[#ede8e5] pl-6">
              <ManageCreditsForm
                userId={user.id}
                userName={user.name ?? user.email ?? 'User'}
                onSuccess={handleAdjustment}
              />
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────
export function UserCreditsClient({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        !q ||
        (u.name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q),
    );
  }, [users, search]);

  const totalUsers   = users.length;
  const usersWithCredits = users.filter((u) => u.balances.some((b) => b.balance > 0)).length;

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total students', value: totalUsers },
          { label: 'Students with credits', value: usersWithCredits },
          { label: 'Showing', value: filtered.length },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#4e2b22]/10 to-[#6b3d32]/5 p-4"
          >
            <p className="text-xs text-[#6b4a3d]">{label}</p>
            <p className="text-2xl font-bold text-[#4e2b22]">{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#8b6b5c]" aria-hidden />
        <input
          type="text"
          placeholder="Search by name or email…"
          aria-label="Search students by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 text-[#4e2b22] placeholder:text-[#7a5a4a] focus:border-[#c4a88a] focus:outline-none"
        />
      </div>

      {/* User list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <User className="size-8 text-[#c4a88a] mx-auto mb-3" />
            <p className="text-[#6b4a3d]">No students found.</p>
          </div>
        ) : (
          filtered.map((u) => <UserCard key={u.id} user={u} />)
        )}
      </div>
    </div>
  );
}
