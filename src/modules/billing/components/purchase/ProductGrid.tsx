'use client';

import { ProductCard } from './ProductCard';
import type { CreditPackage, MembershipPlan, Selection } from './usePurchaseState';
import type { FilterKey } from './FilterBar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductGridProps {
  packages: CreditPackage[];
  memberships: MembershipPlan[];
  selected: Selection;
  onSelectPackage: (pkg: CreditPackage) => void;
  onSelectMembership: (plan: MembershipPlan) => void;
  filter: FilterKey;
  welcomeStatus: { welcomed: boolean; purchased: boolean };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findBestValueId(pkgs: CreditPackage[]): string | null {
  if (pkgs.length < 2) return null;
  return [...pkgs].sort(
    (a, b) => a.priceCents / a.creditsAmount - b.priceCents / b.creditsAmount,
  )[0].id;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductGrid({
  packages,
  memberships,
  selected,
  onSelectPackage,
  onSelectMembership,
  filter,
  welcomeStatus,
}: ProductGridProps) {
  // Filter packages by category
  const groupPackages = packages.filter(
    (p) => p.category === 'credit' && ['pass', 'mat_pass', 'reformer_pass'].includes(p.creditType),
  );
  const sessionPackages = packages.filter(
    (p) => p.category === 'session' && p.name !== 'Welcome Journey',
  );
  const welcomePackage = packages.find((p) => p.name === 'Welcome Journey');

  const showGroup = filter === 'all' || filter === 'group';
  const showSession = filter === 'all' || filter === 'session';
  const showMembership = filter === 'all' || filter === 'membership';

  return (
    <div className="space-y-6">
      {/* Welcome Journey — hidden once completed (one-time only) */}
      {welcomePackage && !welcomeStatus.welcomed && (
        <Section
          title="Welcome Journey"
          description="Your first step — a 2-hour private introduction session."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <ProductCard
              kind="package"
              item={welcomePackage}
              selected={selected?.kind === 'package' && selected.id === welcomePackage.id}
              onSelect={() => onSelectPackage(welcomePackage)}
              badge={!welcomeStatus.purchased ? 'New Client Special' : 'Purchased'}
            />
          </div>
        </Section>
      )}

      {/* Group Classes */}
      {showGroup && groupPackages.length > 0 && (
        <Section
          title="Group Classes"
          description="Mat · Reformer · Chair · Yoga · Sound Healing"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {groupPackages.map((pkg) => (
              <ProductCard
                key={pkg.id}
                kind="package"
                item={pkg}
                selected={selected?.kind === 'package' && selected.id === pkg.id}
                onSelect={() => onSelectPackage(pkg)}
                isBestValue={pkg.id === findBestValueId(groupPackages)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Private & Duo Sessions */}
      {showSession && sessionPackages.length > 0 && welcomeStatus.welcomed && (
        <Section
          title="Private & Duo Sessions"
          description="1-on-1 or train together with a partner"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessionPackages.map((pkg) => (
              <ProductCard
                key={pkg.id}
                kind="package"
                item={pkg}
                selected={selected?.kind === 'package' && selected.id === pkg.id}
                onSelect={() => onSelectPackage(pkg)}
                isBestValue={pkg.id === findBestValueId(sessionPackages)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Memberships */}
      {showMembership && memberships.length > 0 && welcomeStatus.welcomed && (
        <Section
          title="Memberships"
          description="Recurring weekly credits at a lower rate — best for regulars (2+ classes/week)"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {memberships.map((plan) => (
              <ProductCard
                key={plan.id}
                kind="membership"
                item={plan}
                selected={selected?.kind === 'membership' && selected.id === plan.id}
                onSelect={() => onSelectMembership(plan)}
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-[#4e2b22]">{title}</h3>
        <p className="text-[11px] text-[#8b6b5c]">{description}</p>
      </div>
      {children}
    </div>
  );
}
