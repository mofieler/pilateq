'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  WalletCardsIcon,
  FileText,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BillsSection } from '@/modules/billing/components/BillsSection';
import { MembershipShopSection } from '@/modules/billing/components/MembershipShopSection';
import {
  usePurchaseState,
  ProductGrid,
  CheckoutPanel,
  FilterBar,
  PurchaseSuccess,
} from '@/modules/billing/components/purchase';
import type { CreditPackage, MembershipPlan, FilterKey } from '@/modules/billing/components/purchase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WelcomeStatus {
  welcomed: boolean;
  purchased: boolean;
  loading: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreditsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  const currentTab = searchParams.get('tab') ?? 'purchase';
  const isPurchaseTab = currentTab === 'purchase';
  const isBillsTab = currentTab === 'bills';

  // Data fetching
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [memberships, setMemberships] = useState<MembershipPlan[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [welcomeStatus, setWelcomeStatus] = useState<WelcomeStatus>({
    welcomed: false,
    purchased: false,
    loading: true,
  });
  const [filter, setFilter] = useState<FilterKey>('all');

  // Purchase state
  const purchase = usePurchaseState(userId);

  // Fetch packages
  useEffect(() => {
    fetch('/api/credit-packages')
      .then((r) => r.json())
      .then((data) => {
        // API returns raw array, but handle both formats defensively
        const pkgs = Array.isArray(data) ? data : (data.packages ?? []);
        setPackages(pkgs);
        setPackagesLoading(false);
      })
      .catch(() => setPackagesLoading(false));
  }, []);

  // Fetch memberships
  useEffect(() => {
    fetch('/api/membership-plans')
      .then((r) => r.json())
      .then((data) => {
        setMemberships(data.plans ?? []);
      })
      .catch(() => {});
  }, []);

  // Fetch welcome status
  useEffect(() => {
    fetch('/api/user/welcome-status')
      .then((r) => r.json())
      .then((data) => {
        setWelcomeStatus({
          welcomed: data.welcomed ?? false,
          purchased: data.purchased ?? false,
          loading: false,
        });
      })
      .catch(() => setWelcomeStatus((s) => ({ ...s, loading: false })));
  }, []);

  // ── Success screen ─────────────────────────────────────────────────────────
  if (purchase.purchaseComplete && purchase.purchaseResult) {
    return (
      <PurchaseSuccess
        packageName={purchase.purchaseResult.packageName}
        dueDate={purchase.purchaseResult.dueDate}
        isWelcomeJourney={purchase.purchaseResult.isWelcomeJourney}
        paymentMethod={purchase.purchaseResult.paymentMethod}
        onReset={purchase.resetPurchase}
      />
    );
  }

  // ── Main page ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm font-medium text-[#6b3d32]">Credit Management</p>
        <h1 className="mt-1 text-3xl font-bold text-[#4e2b22]">
          {isBillsTab ? 'Bills & History' : 'Credits & Memberships'}
        </h1>
        <p className="mt-2 text-sm text-[#6b3d32]">
          {isBillsTab
            ? 'View your billing history and manage open invoices'
            : 'Choose between one-time credit packages or subscribe to a membership plan for recurring weekly credits'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 p-0.5">
        {([
          { key: 'purchase', label: 'Credits & Memberships', icon: WalletCardsIcon },
          { key: 'bills', label: 'Bills', icon: FileText },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => router.push(`/credits?tab=${key}`)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
              currentTab === key
                ? 'bg-[#faf9f7] text-[#4e2b22] shadow-sm ring-1 ring-[#ede8e5]'
                : 'text-[#8b6b5c] hover:text-[#6b3d32]',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* Purchase tab */}
      {isPurchaseTab && (
        <div className="lg:flex lg:gap-8 lg:items-start">
          {/* Left column: products */}
          <div className="space-y-6 lg:w-3/5">
            {/* Welcome banner */}
            {!welcomeStatus.loading && !welcomeStatus.welcomed && !welcomeStatus.purchased && (
              <div className="rounded-2xl border border-[#d4a574]/30 bg-[#d4a574]/10 p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#d4a574]/20 text-[#6b3d32]">
                    <Star className="size-4" aria-hidden />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#4e2b22]">New here? Welcome!</h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#6b3d32]">
                      <strong>Group classes (Yoga, Mat, Reformer, Chair)</strong> are open right away with any credit package.
                      <strong> Private sessions, Duo sessions, and Memberships</strong> unlock after you complete your Welcome Journey.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Active membership banner */}
            {welcomeStatus.welcomed && <MembershipShopSection />}

            {/* Filter */}
            <FilterBar active={filter} onChange={setFilter} />

            {/* Products */}
            {packagesLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-40 animate-pulse rounded-2xl bg-[#ede8e5]/40" />
                ))}
              </div>
            ) : (
              <ProductGrid
                packages={packages}
                memberships={memberships}
                selected={purchase.selection}
                onSelectPackage={purchase.selectPackage}
                onSelectMembership={purchase.selectMembership}
                filter={filter}
                welcomeStatus={{
                  welcomed: welcomeStatus.welcomed,
                  purchased: welcomeStatus.purchased,
                }}
              />
            )}
          </div>

          {/* Right column: checkout */}
          <div className="mt-6 lg:mt-0 lg:w-2/5">
            {purchase.selection ? (
              <div className="lg:sticky lg:top-6">
                <CheckoutPanel
                  selection={purchase.selection}
                  paymentMethod={purchase.paymentMethod}
                  onPaymentMethodChange={purchase.setPaymentMethod}
                  acceptedTerms={purchase.acceptedTerms}
                  onTermsChange={purchase.setAcceptedTerms}
                  acceptedWithdrawal={purchase.acceptedWithdrawal}
                  onWithdrawalChange={purchase.setAcceptedWithdrawal}
                  isProcessing={purchase.isProcessing}
                  isAuthenticated={purchase.isAuthenticated}
                  purchaseError={purchase.purchaseError}
                  onPurchase={purchase.handlePurchase}
                  welcomeStatus={{ welcomed: welcomeStatus.welcomed }}
                />
              </div>
            ) : (
              <div className="hidden lg:block lg:sticky lg:top-6">
                <div className="rounded-2xl border border-dashed border-[#ede8e5]/80 bg-[#faf9f7]/60 p-8 text-center">
                  <WalletCardsIcon className="mx-auto mb-3 size-8 text-[#c4a88a]" />
                  <p className="text-sm font-medium text-[#4e2b22]">Select a package</p>
                  <p className="mt-1 text-xs text-[#8b6b5c]">
                    Choose a credit package or membership to see your order summary and payment options.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bills tab */}
      {isBillsTab && <BillsSection isOpen={isBillsTab} />}
    </div>
  );
}
