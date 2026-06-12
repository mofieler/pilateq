'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, CreditCard, BadgePercent, Ticket, Dumbbell, Palette } from 'lucide-react';

const ITEMS = [
  { href: '/admin/settings', label: 'General', icon: Building2, exact: true },
  { href: '/admin/settings/business-model', label: 'Business Model', icon: BadgePercent },
  { href: '/admin/settings/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/settings/class-passes', label: 'Class Passes', icon: Ticket },
  { href: '/admin/settings/class-catalog', label: 'Class Catalog', icon: Dumbbell },
  { href: '/admin/settings/branding', label: 'Branding', icon: Palette },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Studio settings" className="space-y-1">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
              active
                ? 'bg-[#4e2b22]/10 text-[#4e2b22]'
                : 'text-[#6b3d32] hover:bg-[#ede8e5]/60 hover:text-[#4e2b22]',
            ].join(' ')}
            aria-current={active ? 'page' : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
