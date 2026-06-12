'use client';

import Link from 'next/link';
import { BanknoteIcon, CreditCard, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useStudioConfig } from '@/lib/studio';
import { OrderSummary } from './OrderSummary';
import type { Selection, PaymentMethod } from './usePurchaseState';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckoutPanelProps {
  selection: Selection;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (m: PaymentMethod) => void;
  acceptedTerms: boolean;
  onTermsChange: (v: boolean) => void;
  acceptedWithdrawal: boolean;
  onWithdrawalChange: (v: boolean) => void;
  isProcessing: boolean;
  isAuthenticated: boolean;
  purchaseError: string | null;
  onPurchase: () => void;
  welcomeStatus: { welcomed: boolean };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CheckoutPanel({
  selection,
  paymentMethod,
  onPaymentMethodChange,
  acceptedTerms,
  onTermsChange,
  acceptedWithdrawal,
  onWithdrawalChange,
  isProcessing,
  isAuthenticated,
  purchaseError,
  onPurchase,
  welcomeStatus,
}: CheckoutPanelProps) {
  const studioConfig = useStudioConfig();
  const stripeEnabled = studioConfig.paymentProviders.some(
    (p) => p.provider === 'stripe' && p.enabled && p.credentials?.secretKey
  );
  const isMembership = selection?.kind === 'membership';
  const canPurchase = isAuthenticated && acceptedTerms && acceptedWithdrawal && !isProcessing;

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
          <BanknoteIcon className="size-4" aria-hidden />
        </span>
        <h2 className="text-lg font-semibold text-[#4e2b22]">Order Summary</h2>
      </div>

      {/* Payment method selector */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <PaymentMethodCard
          method="stripe"
          isSelected={paymentMethod === 'stripe'}
          onSelect={() => onPaymentMethodChange('stripe')}
          disabled={!stripeEnabled || isMembership}
        />
        <PaymentMethodCard
          method="pay_at_studio"
          isSelected={paymentMethod === 'pay_at_studio'}
          onSelect={() => onPaymentMethodChange('pay_at_studio')}
        />
      </div>

      {/* Order details */}
      <div className="rounded-2xl border border-[#ede8e5]/80 bg-linear-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-5">
        <h3 className="mb-4 font-semibold text-[#4e2b22]">Details</h3>
        <OrderSummary selection={selection} />
      </div>

      {/* Warning for unwelcomed users buying non-WJ packages */}
      {!welcomeStatus.welcomed && selection?.kind === 'package' && selection.item.name !== 'Welcome Journey' && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-800">
            Private &amp; duo sessions require Welcome Journey
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-700">
            Your credits work for <strong>all group classes</strong> (Yoga, Mat, Reformer, Chair) right away.
            Private sessions, duo sessions, and memberships unlock after you complete your Welcome Journey.
            {selection.item.validityWeeks <= 7 && (
              <> This package expires in just <strong>{selection.item.validityWeeks} weeks</strong> — make sure you can complete your Welcome Journey in time.</>
            )}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-amber-700">
            <Link href="/welcome-journey" className="font-semibold underline underline-offset-2 text-amber-800">
              Start your Welcome Journey →
            </Link>
          </p>
        </div>
      )}

      {/* Payment info */}
      {paymentMethod === 'pay_at_studio' && (
        <div className="mt-4 rounded-xl bg-[#d4a574]/10 p-4">
          <p className="text-sm text-[#6b3d32]">
            <span className="font-medium">Pay at Studio or via Bank Transfer:</span>{' '}
            {selection?.kind === 'membership'
              ? 'Your membership starts immediately and credits are granted every 7 days.'
              : "We'll reserve your credits. They will be activated once the studio confirms your payment."}
            {' '}Please pay within <strong>14 days</strong> — bring the amount to the studio or transfer to the bank account on your invoice.
            An invoice (PDF) will be emailed to you.
          </p>
        </div>
      )}
      {paymentMethod === 'stripe' && (
        <div className="mt-4 rounded-xl bg-[#635bff]/10 p-4">
          <p className="text-sm text-[#6b3d32]">
            <span className="font-medium">Card payment via Stripe:</span>{' '}
            You will be redirected to Stripe's secure checkout. Credits are added automatically once payment is confirmed.
          </p>
        </div>
      )}

      {/* Error */}
      {purchaseError && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{purchaseError}</p>
        </div>
      )}

      {/* Legal checkboxes */}
      <div className="mt-5 space-y-3">
        <CheckboxRow
          checked={acceptedTerms}
          onChange={onTermsChange}
        >
          I have read and accept the{' '}
          <Link href="/agb" target="_blank" className="text-[#4e2b22] underline underline-offset-2">
            General Terms &amp; Conditions
          </Link>{' '}
          – including the Liability Waiver and Cancellation Policy – and the{' '}
          <Link href="/datenschutz" target="_blank" className="text-[#4e2b22] underline underline-offset-2">
            Privacy Policy
          </Link>.
        </CheckboxRow>

        <CheckboxRow
          checked={acceptedWithdrawal}
          onChange={onWithdrawalChange}
        >
          I expressly consent to the immediate performance of the contract and acknowledge
          that I lose my statutory 14-day right of withdrawal once the credits are credited
          to my account.
        </CheckboxRow>

        <div className="rounded-lg bg-[#ede8e5]/30 p-3 text-xs leading-relaxed text-[#6b3d32]">
          <strong>Right of Withdrawal:</strong> By purchasing, you request the service begins
          immediately. You waive your 14-day right of withdrawal once credits are provisioned.{' '}
          <Link href="/widerrufsrecht" target="_blank" className="text-[#4e2b22] underline underline-offset-2">
            Terms of Cancellation
          </Link>
        </div>
      </div>

      {/* CTA */}
      <Button
        variant="boutique"
        className="mt-5 w-full min-h-[44px]"
        onClick={onPurchase}
        disabled={!canPurchase}
      >
        {isProcessing ? (
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Processing…
          </span>
        ) : !isAuthenticated ? (
          'Please sign in'
        ) : selection?.kind === 'membership' ? (
          'Subscribe now – binding order'
        ) : (
          'Buy now – binding order'
        )}
      </Button>
      <p className="mt-2 text-center text-[10px] leading-snug text-[#a6856f]">
        By clicking this button you place a binding order. Payment is due at the studio or via bank transfer within 14 days.
      </p>
    </section>
  );
}

// ─── Payment method card ──────────────────────────────────────────────────────

function PaymentMethodCard({
  method,
  isSelected,
  onSelect,
  disabled = false,
}: {
  method: PaymentMethod;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const isStripe = method === 'stripe';
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className={cn(
        'relative flex min-h-[44px] items-center gap-3 rounded-xl border p-3.5 text-left transition-all',
        isSelected
          ? 'border-[#4e2b22] bg-[#4e2b22]/5 shadow-sm'
          : 'border-[#ede8e5]/80 bg-white/60 hover:border-[#c4a88a]/40',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
        isStripe ? 'bg-[#635bff]/10 text-[#635bff]' : 'bg-[#4e2b22]/10 text-[#4e2b22]',
      )}>
        {isStripe ? <CreditCard className="size-4" aria-hidden /> : <BanknoteIcon className="size-4" aria-hidden />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#4e2b22]">
          {isStripe ? 'Card / Stripe' : 'Pay at Studio'}
        </p>
        <p className="text-[11px] text-[#8b6b5c]">
          {isStripe ? (disabled ? 'Not configured' : 'Secure card payment') : 'Cash or bank transfer'}
        </p>
      </div>
    </button>
  );
}

// ─── Checkbox row ─────────────────────────────────────────────────────────────

function CheckboxRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-[#c4a88a] text-[#4e2b22] focus:ring-[#4e2b22] shrink-0"
      />
      <span className="text-xs leading-relaxed text-[#6b3d32]">{children}</span>
    </label>
  );
}
