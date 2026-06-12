'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, User, Package, Banknote, FileText, CheckCircle, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CreditType } from '@/lib/config/class-types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditPackage {
  id: string;
  name: string;
  creditsAmount: number;
  creditType: CreditType;
  priceCents: number;
  currency: string;
  validityWeeks: number;
}

interface Student {
  id: string;
  name: string | null;
  email: string | null;
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

const CREDIT_TYPE_LABELS: Record<CreditType, string> = {
  pass: 'Universal Credits',
  mat_pass: 'Mat Credits',
  reformer_pass: 'Reformer Credits',
  session: 'Session Credits',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  pay_at_studio: 'Pay at Studio',
  stripe: 'Stripe (online)',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AddManualPaymentModal({ onClose, onCreated }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [customCredits, setCustomCredits] = useState(1);
  const [customCreditType, setCustomCreditType] = useState<CreditType>('pass');
  const [customPriceCents, setCustomPriceCents] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'pay_at_studio'>('cash');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>('paid');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [generateInvoice, setGenerateInvoice] = useState(true);
  const [error, setError] = useState('');

  // Fetch students and packages on mount
  useEffect(() => {
    async function load() {
      try {
        const [studentsRes, packagesRes] = await Promise.all([
          fetch('/api/admin/students'), // We'll need to create this or use existing endpoint
          fetch('/api/credit-packages'),
        ]);

        if (studentsRes.ok) setStudents(await studentsRes.json());
        if (packagesRes.ok) setPackages(await packagesRes.json());
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  // If no student API exists, fetch from admin purchases data or create simple fetch
  // For now, fallback: if students empty after load, show a text input for userId
  const showStudentInput = students.length === 0;

  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase();
    if (!q) return students.slice(0, 8);
    return students.filter(
      (s) =>
        (s.name ?? '').toLowerCase().includes(q) ||
        (s.email ?? '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [students, studentSearch]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const selectedPackage = packages.find((p) => p.id === selectedPackageId);

  const finalCredits = isCustom ? customCredits : (selectedPackage?.creditsAmount ?? 0);
  const finalCreditType = isCustom ? customCreditType : (selectedPackage?.creditType ?? 'pass');
  const finalPriceCents = isCustom ? customPriceCents : (selectedPackage?.priceCents ?? 0);
  const isValid = selectedStudentId && (selectedPackageId || isCustom) && finalCredits > 0 && finalPriceCents >= 0;

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    setError('');

    try {
      const body = {
        userId: selectedStudentId,
        packageId: isCustom ? undefined : selectedPackageId,
        creditsAmount: finalCredits,
        creditType: finalCreditType,
        priceCents: finalPriceCents,
        currency: selectedPackage?.currency ?? 'eur',
        paymentMethod,
        paymentStatus,
        paidAt: paymentStatus === 'paid' ? new Date(paidDate).toISOString() : null,
        paymentDueDate: paymentStatus === 'pending' && dueDate ? new Date(dueDate).toISOString() : null,
        adminNotes: adminNotes || undefined,
        generateInvoice,
      };

      const res = await fetch('/api/admin/purchases/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to create payment');
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#ede8e5] bg-[#faf9f7] shadow-[0_20px_60px_rgba(78,43,34,0.15)] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#ede8e5]/60 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#4e2b22]">Add Manual Payment</h2>
            <p className="text-xs text-[#8b6b5c]">Create a payment record and grant credits</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg border border-[#ede8e5] text-[#8b6b5c] transition-colors hover:border-[#c4a88a] hover:text-[#4e2b22]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-[#c45c4a]/30 bg-[#c45c4a]/5 px-4 py-3 text-sm text-[#c45c4a]">
              {error}
            </div>
          )}

          {/* Student */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8b6b5c]">
              <User className="size-3.5" />
              Student <span className="text-[#c45c4a]">*</span>
            </label>
            {showStudentInput ? (
              <input
                type="text"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                placeholder="User UUID"
                className="w-full rounded-xl border border-[#ede8e5] bg-white/60 px-3 py-2.5 text-sm text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none"
              />
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#8b6b5c]" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className="w-full rounded-xl border border-[#ede8e5] bg-white/60 pl-9 pr-3 py-2.5 text-sm text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none"
                  />
                </div>
                {selectedStudent ? (
                  <div className="flex items-center justify-between rounded-xl bg-[#4a7c4a]/5 border border-[#6b8e6b]/20 px-3 py-2">
                    <span className="text-sm font-medium text-[#4e2b22]">{selectedStudent.name ?? 'Unknown'}</span>
                    <span className="text-xs text-[#8b6b5c]">{selectedStudent.email}</span>
                    <button
                      type="button"
                      onClick={() => { setSelectedStudentId(''); setStudentSearch(''); }}
                      className="ml-2 text-[#8b6b5c] hover:text-[#c45c4a]"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-[#ede8e5] bg-white/60">
                    {filteredStudents.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedStudentId(s.id)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#ede8e5]/40 transition-colors"
                      >
                        <span className="text-[#4e2b22]">{s.name ?? 'Unknown'}</span>
                        <span className="text-xs text-[#8b6b5c]">{s.email}</span>
                      </button>
                    ))}
                    {filteredStudents.length === 0 && (
                      <p className="px-3 py-2 text-xs text-[#a6856f]">No students found</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Package / Custom toggle */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8b6b5c]">
              <Package className="size-3.5" />
              Package <span className="text-[#c45c4a]">*</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setIsCustom(false); setCustomCredits(1); setCustomPriceCents(0); }}
                className={cn(
                  'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all',
                  !isCustom
                    ? 'border-[#4e2b22] bg-[#4e2b22] text-[#faf9f7]'
                    : 'border-[#ede8e5] text-[#8b6b5c] hover:border-[#c4a88a]',
                )}
              >
                Existing Package
              </button>
              <button
                type="button"
                onClick={() => { setIsCustom(true); setSelectedPackageId(''); }}
                className={cn(
                  'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all',
                  isCustom
                    ? 'border-[#4e2b22] bg-[#4e2b22] text-[#faf9f7]'
                    : 'border-[#ede8e5] text-[#8b6b5c] hover:border-[#c4a88a]',
                )}
              >
                Custom
              </button>
            </div>

            {!isCustom ? (
              <select
                value={selectedPackageId}
                onChange={(e) => setSelectedPackageId(e.target.value)}
                className="w-full rounded-xl border border-[#ede8e5] bg-white/60 px-3 py-2.5 text-sm text-[#4e2b22] focus:border-[#c4a88a] focus:outline-none"
              >
                <option value="">Select a package…</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} · {pkg.creditsAmount} {CREDIT_TYPE_LABELS[pkg.creditType]} · {formatPrice(pkg.priceCents, pkg.currency)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-[#a6856f]">Credits</label>
                  <input
                    type="number"
                    min={1}
                    value={customCredits}
                    onChange={(e) => setCustomCredits(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full rounded-xl border border-[#ede8e5] bg-white/60 px-3 py-2 text-sm text-[#4e2b22] focus:border-[#c4a88a] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-[#a6856f]">Type</label>
                  <select
                    value={customCreditType}
                    onChange={(e) => setCustomCreditType(e.target.value as CreditType)}
                    className="w-full rounded-xl border border-[#ede8e5] bg-white/60 px-3 py-2 text-sm text-[#4e2b22] focus:border-[#c4a88a] focus:outline-none"
                  >
                    {(Object.keys(CREDIT_TYPE_LABELS) as CreditType[]).map((t) => (
                      <option key={t} value={t}>{CREDIT_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-[#a6856f]">Price (€)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={(customPriceCents / 100).toFixed(2)}
                    onChange={(e) => setCustomPriceCents(Math.round(parseFloat(e.target.value) * 100) || 0)}
                    className="w-full rounded-xl border border-[#ede8e5] bg-white/60 px-3 py-2 text-sm text-[#4e2b22] focus:border-[#c4a88a] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Payment method */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8b6b5c]">
              <Banknote className="size-3.5" />
              Payment Method
            </label>
            <div className="flex gap-2">
              {(['cash', 'bank_transfer', 'pay_at_studio'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={cn(
                    'flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                    paymentMethod === method
                      ? 'border-[#4e2b22] bg-[#4e2b22] text-[#faf9f7]'
                      : 'border-[#ede8e5] text-[#8b6b5c] hover:border-[#c4a88a]',
                  )}
                >
                  {PAYMENT_METHOD_LABELS[method]}
                </button>
              ))}
            </div>
          </div>

          {/* Payment status */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8b6b5c]">
              <CheckCircle className="size-3.5" />
              Status
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaymentStatus('paid')}
                className={cn(
                  'flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                  paymentStatus === 'paid'
                    ? 'border-[#6b8e6b] bg-[#6b8e6b] text-white'
                    : 'border-[#ede8e5] text-[#8b6b5c] hover:border-[#6b8e6b]/50',
                )}
              >
                Paid
              </button>
              <button
                type="button"
                onClick={() => setPaymentStatus('pending')}
                className={cn(
                  'flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                  paymentStatus === 'pending'
                    ? 'border-[#d4a574] bg-[#d4a574] text-white'
                    : 'border-[#ede8e5] text-[#8b6b5c] hover:border-[#d4a574]/50',
                )}
              >
                Pending
              </button>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8b6b5c]">
              {paymentStatus === 'paid' ? 'Paid Date' : 'Due Date'}
            </label>
            <input
              type="date"
              value={paymentStatus === 'paid' ? paidDate : dueDate}
              onChange={(e) => paymentStatus === 'paid' ? setPaidDate(e.target.value) : setDueDate(e.target.value)}
              className="w-full rounded-xl border border-[#ede8e5] bg-white/60 px-3 py-2.5 text-sm text-[#4e2b22] focus:border-[#c4a88a] focus:outline-none"
            />
          </div>

          {/* Admin notes */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8b6b5c]">
              <FileText className="size-3.5" />
              Admin Notes
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Paid in cash, receipt #42…"
              rows={2}
              className="w-full rounded-xl border border-[#ede8e5] bg-white/60 px-3 py-2 text-sm text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none resize-none"
            />
          </div>

          {/* Generate invoice */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={generateInvoice}
              onChange={(e) => setGenerateInvoice(e.target.checked)}
              className="size-4 rounded border-[#ede8e5] text-[#4e2b22] accent-[#4e2b22]"
            />
            <span className="text-sm text-[#4e2b22]">Generate invoice automatically</span>
          </label>

          {/* Summary */}
          <div className="rounded-xl border border-[#ede8e5]/60 bg-[#ede8e5]/20 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a6856f] mb-1">Summary</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#8b6b5c]">Credits to grant:</span>
              <span className="font-semibold text-[#4e2b22]">{finalCredits} {CREDIT_TYPE_LABELS[finalCreditType]}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-[#8b6b5c]">Amount:</span>
              <span className="font-semibold text-[#4e2b22]">{formatPrice(finalPriceCents, selectedPackage?.currency ?? 'eur')}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-[#ede8e5]/60 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#ede8e5] py-2.5 text-sm font-medium text-[#8b6b5c] transition-all hover:border-[#c4a88a] hover:text-[#4e2b22]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className={cn(
              'flex-1 rounded-xl py-2.5 text-sm font-semibold text-[#faf9f7] transition-all',
              isValid && !submitting
                ? 'bg-gradient-to-br from-[#4e2b22] to-[#6b3d32] hover:shadow-md'
                : 'bg-[#ede8e5] text-[#a6856f] cursor-not-allowed',
            )}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Creating…
              </span>
            ) : (
              'Create Payment'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
