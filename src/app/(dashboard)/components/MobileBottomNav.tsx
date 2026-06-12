'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, CalendarDays, ListOrdered, CreditCard } from 'lucide-react';

interface Props {
  hasOfferedSlots?: boolean;
}

const TABS = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/book', label: 'Book', icon: CalendarDays },
  { href: '/bookings', label: 'My Classes', icon: ListOrdered },
  { href: '/credits', label: 'Credits', icon: CreditCard },
];

export function MobileBottomNav({ hasOfferedSlots = false }: Props) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Top border / hairline */}
      <div className="h-px bg-[#ede8e5]/80" />
      <div className="flex items-center justify-around bg-[#faf9f7]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)]">
        {TABS.map((tab) => {
          const isActive = tab.href === '/'
            ? pathname === '/'
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[64px] relative"
            >
              <div className="relative">
                <Icon
                  className={`size-5 transition-colors ${
                    isActive ? 'text-[#4e2b22]' : 'text-[#a6856f]'
                  }`}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                {/* Badge for offered waitlist slots */}
                {tab.href === '/bookings' && hasOfferedSlots && (
                  <span className="absolute -top-1 -right-1.5 flex size-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] transition-colors ${
                  isActive
                    ? 'font-bold text-[#4e2b22]'
                    : 'font-medium text-[#a6856f]'
                }`}
              >
                {tab.label}
              </span>
              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-[#c4a88a]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
