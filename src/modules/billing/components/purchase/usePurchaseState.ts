'use client';

import { useState, useCallback, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import type { CreditType } from '@/lib/config/class-types';
import { subscribeMembershipAction } from '@/modules/billing/actions/membership.actions';

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreditPackage {
  id: string;
  name: string;
  description: string | null;
  creditsAmount: number;
  creditType: CreditType;
  category: 'credit' | 'session';
  priceCents: number;
  currency: string;
  validityDays: number;
  validityWeeks: number;
  isActive: boolean;
  sortOrder: number;
}

export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  creditType: CreditType;
  sessionSubtype: 'private' | 'duo' | null;
  weeklyCredits: number;
  durationWeeks: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
  sortOrder: number;
}

export type Selection =
  | { kind: 'package'; id: string; item: CreditPackage }
  | { kind: 'membership'; id: string; item: MembershipPlan }
  | null;

export type PaymentMethod = 'stripe' | 'pay_at_studio';

export interface PurchaseResult {
  success: boolean;
  packageName: string;
  dueDate: string;
  isWelcomeJourney: boolean;
  paymentMethod: PaymentMethod;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePurchaseState(userId: string | undefined) {
  const router = useRouter();
  const { status } = useSession();

  const [selection, setSelection] = useState<Selection>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pay_at_studio');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedWithdrawal, setAcceptedWithdrawal] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());

  // Reset error when selection changes
  const selectPackage = useCallback((pkg: CreditPackage) => {
    setSelection({ kind: 'package', id: pkg.id, item: pkg });
    setPurchaseError(null);
  }, []);

  const selectMembership = useCallback((plan: MembershipPlan) => {
    setSelection({ kind: 'membership', id: plan.id, item: plan });
    setPurchaseError(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setPurchaseError(null);
  }, []);

  const resetPurchase = useCallback(() => {
    setPurchaseComplete(false);
    setPurchaseResult(null);
    setSelection(null);
    setAcceptedTerms(false);
    setAcceptedWithdrawal(false);
    setIdempotencyKey(generateIdempotencyKey());
  }, []);

  // ── Purchase handler ────────────────────────────────────────────────────────
  const handlePurchase = useCallback(async () => {
    if (!selection || !userId) return;
    if (!acceptedTerms || !acceptedWithdrawal) {
      setPurchaseError('Please accept all required terms before purchasing.');
      return;
    }

    setIsProcessing(true);
    setPurchaseError(null);

    try {
      if (selection.kind === 'package') {
        const pkg = selection.item;

        // Stripe checkout: create a session and redirect to Stripe.
        if (paymentMethod === 'stripe') {
          const res = await fetch('/api/payments/stripe/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              packageId: pkg.id,
              successUrl: `${window.location.origin}/credits?stripe=success`,
              cancelUrl: `${window.location.origin}/credits?stripe=cancel`,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Checkout failed (${res.status})`);
          }

          const data = await res.json();
          if (!data.redirectUrl) throw new Error('No redirect URL from Stripe');
          window.location.href = data.redirectUrl;
          return;
        }

        const res = await fetch('/api/credit-purchases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packageId: pkg.id,
            userId,
            paymentMethod,
            acceptedTerms: true,
            acceptedWithdrawal: true,
            idempotencyKey,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Purchase failed (${res.status})`);
        }

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Purchase failed');

        setPurchaseResult({
          success: true,
          packageName: pkg.name,
          dueDate: data.dueDate ? format(new Date(data.dueDate), 'MMMM d, yyyy') : 'Paid',
          isWelcomeJourney: pkg.name === 'Welcome Journey',
          paymentMethod,
        });
        setPurchaseComplete(true);
      } else {
        // Membership
        const plan = selection.item;
        const res = await subscribeMembershipAction({
          planId: plan.id,
          acceptedTerms: true,
          acceptedWithdrawalWaiver: true,
        });

        if (!res.success) throw new Error(res.error || 'Subscription failed');

        setPurchaseResult({
          success: true,
          packageName: plan.name,
          dueDate: format(addDays(new Date(), 14), 'MMMM d, yyyy'),
          isWelcomeJourney: false,
          paymentMethod: 'pay_at_studio',
        });
        setPurchaseComplete(true);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Purchase failed. Please try again.';
      setPurchaseError(msg);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  }, [selection, userId, paymentMethod, acceptedTerms, acceptedWithdrawal]);

  return {
    selection,
    selectPackage,
    selectMembership,
    clearSelection,
    paymentMethod,
    setPaymentMethod,
    acceptedTerms,
    setAcceptedTerms,
    acceptedWithdrawal,
    setAcceptedWithdrawal,
    isProcessing,
    purchaseComplete,
    purchaseResult,
    purchaseError,
    handlePurchase,
    resetPurchase,
    isAuthenticated: status === 'authenticated',
  };
}
