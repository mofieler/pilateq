'use client';

import Link from 'next/link';
import { BanknoteIcon, CreditCard, AlertCircle, Loader2, Building2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEnabledPaymentProviders } from '@/lib/studio';
import type { PaymentProvider } from '@/lib/studio/studio.config.schema';
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
  const enabledProviders = useEnabledPaymentProviders();
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
        {enabledProviders.map((provider) => (
          <PaymentMethodCard
            key={provider.provider}
            method={provider.provider}
            displayName={provider.displayName}
            description={provider.description}
            isSelected={paymentMethod === provider.provider}
            onSelect={() => onPaymentMethodChange(provider.provider)}
            disabled={isMembership && provider.provider !== 'pay_at_studio'}
          />
        ))}
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
      {paymentMethod && <PaymentInfo method={paymentMethod} selection={selection} />}

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

function providerMeta(method: PaymentMethod) {
  switch (method) {
    case 'stripe':
      return { icon: CreditCard, label: 'Card / Stripe', fallbackDesc: 'Secure card payment', color: 'text-[#635bff] bg-[#635bff]/10' };
    case 'paypal':
      return { icon: Wallet, label: 'PayPal', fallbackDesc: 'Pay with your PayPal account', color: 'text-[#003087] bg-[#003087]/10' };
    case 'sepa':
      return { icon: Building2, label: 'SEPA Direct Debit', fallbackDesc: 'Direct debit from your bank account', color: 'text-[#4e2b22] bg-[#4e2b22]/10' };
    case 'bank_transfer':
      return { icon: Building2, label: 'Bank Transfer', fallbackDesc: 'Transfer manually to our account', color: 'text-[#4e2b22] bg-[#4e2b22]/10' };
    case 'cash':
      return { icon: BanknoteIcon, label: 'Cash', fallbackDesc: 'Pay with cash at the studio', color: 'text-[#4e2b22] bg-[#4e2b22]/10' };
    case 'pay_at_studio':
    default:
      return { icon: BanknoteIcon, label: 'Pay at Studio', fallbackDesc: 'Cash or bank transfer', color: 'text-[#4e2b22] bg-[#4e2b22]/10' };
  }
}

function PaymentMethodCard({
  method,
  displayName,
  description,
  isSelected,
  onSelect,
  disabled = false,
}: {
  method: PaymentMethod;
  displayName?: string;
  description?: string;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const meta = providerMeta(method);
  const Icon = meta.icon;
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
      <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-lg', meta.color)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#4e2b22]">{displayName || meta.label}</p>
        <p className="text-[11px] text-[#8b6b5c]">{disabled ? 'Not available for memberships' : (description || meta.fallbackDesc)}</p>
      </div>
    </button>
  );
}

function PaymentInfo({ method, selection }: { method: PaymentMethod; selection: Selection }) {
  switch (method) {
    case 'stripe':
      return (
        <div className="mt-4 rounded-xl bg-[#635bff]/10 p-4">
          <p className="text-sm text-[#6b3d32]">
            <span className="font-medium">Card payment via Stripe:</span>{' '}
            You will be redirected to Stripe's secure checkout. Credits are added automatically once payment is confirmed.
          </p>
        </div>
      );
    case 'paypal':
    case 'sepa':
      return (
        <div className="mt-4 rounded-xl bg-[#4e2b22]/5 p-4">
          <p className="text-sm text-[#6b3d32]">
            <span className="font-medium">Online payment:</span>{' '}
            You will be redirected to complete payment. Credits are activated once the payment is confirmed.
          </p>
        </div>
      );
    case 'pay_at_studio':
    case 'bank_transfer':
    case 'cash':
    default:
      return (
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
      );
  }
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
