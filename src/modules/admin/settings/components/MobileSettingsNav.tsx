'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Building2, CreditCard, BadgePercent, Ticket, Dumbbell, Palette } from 'lucide-react';

const ITEMS = [
  { href: '/admin/settings', label: 'General', icon: Building2 },
  { href: '/admin/settings/business-model', label: 'Business Model', icon: BadgePercent },
  { href: '/admin/settings/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/settings/class-passes', label: 'Class Passes', icon: Ticket },
  { href: '/admin/settings/class-catalog', label: 'Class Catalog', icon: Dumbbell },
  { href: '/admin/settings/branding', label: 'Branding', icon: Palette },
];

export function MobileSettingsNav() {
  const router = useRouter();
  const pathname = usePathname();
  const active = ITEMS.find((item) =>
    item.href === '/admin/settings' ? pathname === item.href : pathname.startsWith(item.href)
  );

  return (
    <div className="relative">
      <select
        value={active?.href ?? '/admin/settings'}
        onChange={(e) => router.push(e.target.value)}
        aria-label="Settings section"
        className="w-full appearance-none rounded-lg border border-[#ede8e5] bg-white px-3 py-2.5 pr-10 text-sm text-[#4e2b22] focus:outline-none focus:ring-2 focus:ring-[#4e2b22]/20"
      >
        {ITEMS.map((item) => (
          <option key={item.href} value={item.href}>
            {item.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8b6b5c]">
        ▼
      </span>
    </div>
  );
}
