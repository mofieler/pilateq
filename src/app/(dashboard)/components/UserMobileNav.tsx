'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStudioFeature, useBusinessModel } from '@/lib/studio';
import { createPortal } from 'react-dom';
import { MenuIcon, XIcon } from 'lucide-react';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

// ─── Nav links ────────────────────────────────────────────────────────────────

type NavLink = {
  href: string;
  label: string;
  exact: boolean;
  icon: React.ReactNode;
  feature?: Parameters<typeof useStudioFeature>[0];
  businessModel?: Parameters<typeof useBusinessModel>[0];
};

const NAV_LINKS: NavLink[] = [
  {
    href: '/',
    label: 'Dashboard',
    exact: true, // only match exactly "/"
    icon: (
      <svg className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
      </svg>
    ),
  },
  {
    href: '/book',
    label: 'Book Class',
    exact: false,
    icon: (
      <svg className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    href: '/bookings',
    label: 'My Classes',
    exact: false,
    icon: (
      <svg className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M2.25 12V6.75A2.25 2.25 0 014.5 4.5h15a2.25 2.25 0 012.25 2.25V12m-19.5 0h19.5m-19.5 0A2.25 2.25 0 004.5 14.25h15A2.25 2.25 0 0021.75 12m-19.5 0A2.25 2.25 0 004.5 9.75h15a2.25 2.25 0 012.25 2.25" />
      </svg>
    ),
  },
  {
    href: '/credits',
    label: 'Credits',
    exact: false,
    feature: 'showCreditBalance',
    businessModel: 'credits',
    icon: (
      <svg className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'My Profile',
    exact: false,
    icon: (
      <svg className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function isLinkActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  // Prevent prefix collision: /bookings must not match /book
  return pathname === href || pathname.startsWith(href + '/');
}

// ─── Drawer panel ─────────────────────────────────────────────────────────────

function MobileMenuDrawer({
  onClose,
  visible,
  hasOfferedSlots = false,
}: {
  onClose: () => void;
  visible: boolean;
  hasOfferedSlots?: boolean;
}) {
  const pathname = usePathname();
  const showCreditBalance = useStudioFeature('showCreditBalance');
  const creditsEnabled = useBusinessModel('credits');

  const visibleLinks = useMemo(
    () =>
      NAV_LINKS.filter((link) => {
        if (link.feature === 'showCreditBalance' && !showCreditBalance) return false;
        if (link.businessModel === 'credits' && !creditsEnabled) return false;
        return true;
      }),
    [showCreditBalance, creditsEnabled],
  );

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop — dimming overlay */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={[
          'fixed inset-0 z-40 bg-[#2a1410]/40 backdrop-blur-[2px] transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none invisible',
        ].join(' ')}
      />

      {/* Slide-in drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={[
          'fixed inset-x-0 top-[57px] bottom-0 z-50 flex flex-col bg-[#faf9f7]',
          'transition-transform duration-300 ease-out will-change-transform',
          'pb-[env(safe-area-inset-bottom)] overflow-y-auto overscroll-contain',
          visible ? 'translate-y-0' : '-translate-y-4 opacity-0 pointer-events-none invisible',
        ].join(' ')}
      >
        {/* Nav links */}
        <nav className="flex flex-col gap-1 p-4 pt-3" aria-label="Main navigation">
          {visibleLinks.map(({ href, label, icon, exact }) => {
            const active = isLinkActive(pathname, href, exact);
            const isBookLink = href === '/book';
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-sm font-medium transition-all duration-150 active:scale-[.98]',
                  active
                    ? 'bg-[#4e2b22]/10 text-[#4e2b22] font-semibold shadow-sm'
                    : 'text-[#6b3d32] hover:bg-[#ede8e5]/60 hover:text-[#4e2b22]',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors relative',
                    active ? 'bg-[#4e2b22]/15 text-[#4e2b22]' : 'bg-[#ede8e5]/50 text-[#8b6b5c]',
                  ].join(' ')}
                >
                  {icon}
                  {isBookLink && hasOfferedSlots && (
                    <span className="absolute -top-1 -right-1 flex size-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                  )}
                </span>
                <span className="flex-1">{label}</span>
                {active && (
                  <span className="size-1.5 rounded-full bg-[#4e2b22]" aria-hidden />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom divider line */}
        <div className="mx-4 border-t border-[#ede8e5]/80" />

        {/* Version / brand footer in drawer */}
        <p className="px-8 py-4 text-xs text-[#c4a88a]">{APP_CONFIG.APP_NAME} Studio App</p>
      </div>
    </>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function UserMobileNav({ hasOfferedSlots = false }: { hasOfferedSlots?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Ensure portal only renders client-side
  useEffect(() => setMounted(true), []);

  // Animate open/close with a tiny delay for exit animation
  useEffect(() => {
    if (open) {
      setVisible(false); // start hidden
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true)); // trigger animation
      });
      // Lock body scroll
      document.body.style.overflow = 'hidden';
    } else {
      setVisible(false);
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
      {/* Hamburger / close button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        className={[
          'sm:hidden flex size-10 items-center justify-center rounded-xl border transition-all duration-200 active:scale-95 relative',
          open
            ? 'border-[#4e2b22]/30 bg-[#4e2b22]/10 text-[#4e2b22]'
            : 'border-[#ede8e5] bg-transparent text-[#6b3d32] hover:bg-[#ede8e5]/60',
        ].join(' ')}
      >
        <span
          className={[
            'transition-all duration-200',
            open ? 'rotate-90 opacity-100' : 'rotate-0 opacity-100',
          ].join(' ')}
        >
          {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
        </span>
        {!open && hasOfferedSlots && (
          <span className="absolute -top-0.5 -right-0.5 flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
        )}
      </button>

      {/* Portal: drawer + backdrop */}
      {mounted && createPortal(
        <MobileMenuDrawer onClose={closeMenu} visible={visible} hasOfferedSlots={hasOfferedSlots} />,
        document.body,
      )}
    </>
  );
}
