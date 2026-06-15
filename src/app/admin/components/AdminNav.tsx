'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useStudioFeature, useStudioFeatureFlag, useBusinessModel, useHasExternalAccessProviders } from '@/lib/studio';
import { createPortal } from 'react-dom';
import { MenuIcon, XIcon, ChevronDownIcon } from 'lucide-react';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

// ── Icons ──────────────────────────────────────────────────────────────────────

const DashboardIcon = () => (
  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const TemplateIcon = () => (
  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
  </svg>
);

const CoinsIcon = () => (
  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const MembershipIcon = () => (
  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

const PaymentIcon = () => (
  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>
);

const TicketIcon = () => (
  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25m-5.25 3h5.25m-5.25 3h5.25M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
  </svg>
);

const SyncIcon = () => (
  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.212 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.519 6.519 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const TaxIcon = () => (
  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const StatsIcon = () => (
  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

// ── Nav structure ──────────────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon: () => ReactNode;
  desc: string;
  feature?: Parameters<typeof useStudioFeature>[0];
  featureFlag?: Parameters<typeof useStudioFeatureFlag>[0];
  businessModel?: Parameters<typeof useBusinessModel>[0];
  accessProviders?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  icon: () => ReactNode;
  items: NavItem[];
};

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    id: 'scheduling',
    label: 'Scheduling',
    icon: CalendarIcon,
    items: [
      { href: '/admin/classes',      label: 'Classes',     icon: CalendarIcon, desc: 'Manage classes & sessions' },
      { href: '/admin/templates',    label: 'Templates',   icon: TemplateIcon, desc: 'Edit class templates' },
      { href: '/admin/instructors',  label: 'Instructors', icon: UsersIcon,    desc: 'Manage teachers & bios' },
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: PaymentIcon,
    items: [
      { href: '/admin/credits',      label: 'Packages',    icon: CoinsIcon,      desc: 'Credit packages & pricing', businessModel: 'credits' },
      { href: '/admin/memberships',  label: 'Memberships', icon: MembershipIcon, desc: 'Plans & member subscriptions', businessModel: 'memberships' },
      { href: '/admin/user-credits', label: 'User Credits', icon: UsersIcon,     desc: 'Balances & transactions', businessModel: 'credits' },
      { href: '/admin/payments',     label: 'Payments',    icon: PaymentIcon,    desc: 'Invoices & payment history', feature: 'showInvoices' },
      { href: '/admin/class-passes', label: 'Class Passes', icon: TicketIcon,     desc: 'Check-ins & partner reconciliation', accessProviders: true },
      { href: '/admin/tax',          label: 'Tax & Export', icon: TaxIcon,        desc: 'Annual overview for accountants', feature: 'showInvoices' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SyncIcon,
    items: [
      { href: '/admin/members', label: 'Members', icon: UsersIcon, desc: 'Invite and manage studio members' },
      { href: '/admin/settings', label: 'Studio Settings', icon: SettingsIcon, desc: 'Business model, payments, branding' },
      { href: '/admin/calendar-sync', label: 'Google Calendar', icon: SyncIcon, desc: 'Calendar synchronisation', featureFlag: 'googleCalendarSync' },
    ],
  },
];

const INSTRUCTOR_NAV_GROUPS = [
  {
    id: 'scheduling',
    label: 'Scheduling',
    icon: CalendarIcon,
    items: [
      { href: '/admin/classes', label: 'Classes', icon: CalendarIcon, desc: 'Manage your classes' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SyncIcon,
    items: [
      { href: '/admin/calendar-sync', label: 'Google Calendar', icon: SyncIcon, desc: 'Calendar synchronisation' },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

// ── Desktop hover dropdown ────────────────────────────────────────────────────

function NavDropdown({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const groupActive = group.items.some((item) => isActive(pathname, item.href));

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }
  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        className={[
          'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
          groupActive
            ? 'bg-[#4e2b22]/10 text-[#4e2b22] font-semibold'
            : 'text-[#6b3d32] hover:bg-[#ede8e5]/60 hover:text-[#4e2b22]',
        ].join(' ')}
      >
        <span className={groupActive ? 'text-[#4e2b22]' : 'text-[#8b6b5c]'}>
          <group.icon />
        </span>
        {group.label}
        <ChevronDownIcon
          className={`size-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 w-60 rounded-xl border border-[#ede8e5] bg-white shadow-lg shadow-[#4e2b22]/10 z-50 overflow-hidden"
          onMouseEnter={cancelClose}
        >
          <div className="p-1.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all',
                    active
                      ? 'bg-[#4e2b22]/10 text-[#4e2b22]'
                      : 'text-[#6b3d32] hover:bg-[#ede8e5]/50 hover:text-[#4e2b22]',
                  ].join(' ')}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={`mt-0.5 shrink-0 ${active ? 'text-[#4e2b22]' : 'text-[#8b6b5c]'}`}>
                    <item.icon />
                  </span>
                  <div>
                    <p className="text-sm font-medium leading-tight">{item.label}</p>
                    <p className="text-xs text-[#8b6b5c] mt-0.5">{item.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mobile slide-in drawer ────────────────────────────────────────────────────

const NAV_HEADER_HEIGHT = 57; // px — matches the sticky nav height

function MobileDrawer({
  onClose,
  visible,
  navGroups,
  role,
}: {
  onClose: () => void;
  visible: boolean;
  navGroups: NavGroup[];
  role: 'admin' | 'instructor';
}) {
  const pathname = usePathname();
  const isDashboard = pathname === '/admin';

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={[
          'fixed inset-0 z-40 bg-[#2a1410]/40 backdrop-blur-[2px] transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        style={{ top: NAV_HEADER_HEIGHT }}
        className={[
          'fixed inset-x-0 bottom-0 z-50 flex flex-col bg-[#faf9f7] overflow-y-auto overscroll-contain',
          'pb-[env(safe-area-inset-bottom)]',
          'transition-transform duration-300 ease-out will-change-transform',
          visible ? 'translate-y-0' : '-translate-y-2 opacity-0 pointer-events-none',
        ].join(' ')}
      >
        <nav className="flex flex-col gap-1 p-4 pt-3" aria-label="Admin navigation">
          {/* Dashboard */}
          <Link
            href="/admin"
            onClick={onClose}
            aria-current={isDashboard ? 'page' : undefined}
            className={[
              'flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-sm font-medium transition-all active:scale-[.98]',
              isDashboard
                ? 'bg-[#4e2b22]/10 text-[#4e2b22] font-semibold'
                : 'text-[#6b3d32] hover:bg-[#ede8e5]/60 hover:text-[#4e2b22]',
            ].join(' ')}
          >
            <span className={[
              'flex size-9 shrink-0 items-center justify-center rounded-xl',
              isDashboard ? 'bg-[#4e2b22]/15 text-[#4e2b22]' : 'bg-[#ede8e5]/50 text-[#8b6b5c]',
            ].join(' ')}>
              <DashboardIcon />
            </span>
            <span className="flex-1">Dashboard</span>
            {isDashboard && <span aria-hidden className="size-1.5 rounded-full bg-[#4e2b22]" />}
          </Link>

          {/* Nav groups */}
          {navGroups.map((group) => (
            <div key={group.id} className="mt-4">
              <p className="mb-1 px-4 text-[10px] font-bold uppercase tracking-widest text-[#c4a88a]">
                {group.label}
              </p>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'flex items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-medium transition-all active:scale-[.98]',
                      active
                        ? 'bg-[#4e2b22]/10 text-[#4e2b22] font-semibold'
                        : 'text-[#6b3d32] hover:bg-[#ede8e5]/60 hover:text-[#4e2b22]',
                    ].join(' ')}
                  >
                    <span className={[
                      'flex size-9 shrink-0 items-center justify-center rounded-xl',
                      active ? 'bg-[#4e2b22]/15 text-[#4e2b22]' : 'bg-[#ede8e5]/50 text-[#8b6b5c]',
                    ].join(' ')}>
                      <item.icon />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="leading-tight">{item.label}</p>
                      <p className="text-[11px] text-[#8b6b5c] mt-0.5 truncate">{item.desc}</p>
                    </div>
                    {active && <span aria-hidden className="size-1.5 rounded-full bg-[#4e2b22]" />}
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Analytics — admin only */}
          {role === 'admin' && (
            <div className="mt-4">
              <p className="mb-1 px-4 text-[10px] font-bold uppercase tracking-widest text-[#c4a88a]">
                Analytics
              </p>
              {(() => {
                const active = isActive(pathname, '/admin/statistics');
                return (
                  <Link
                    href="/admin/statistics"
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'flex items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-medium transition-all active:scale-[.98]',
                      active
                        ? 'bg-[#4e2b22]/10 text-[#4e2b22] font-semibold'
                        : 'text-[#6b3d32] hover:bg-[#ede8e5]/60 hover:text-[#4e2b22]',
                    ].join(' ')}
                  >
                    <span className={[
                      'flex size-9 shrink-0 items-center justify-center rounded-xl',
                      active ? 'bg-[#4e2b22]/15 text-[#4e2b22]' : 'bg-[#ede8e5]/50 text-[#8b6b5c]',
                    ].join(' ')}>
                      <StatsIcon />
                    </span>
                    <div className="flex-1">
                      <p className="leading-tight">Statistics</p>
                      <p className="text-[11px] text-[#8b6b5c] mt-0.5">Activity & student insights</p>
                    </div>
                    {active && <span aria-hidden className="size-1.5 rounded-full bg-[#4e2b22]" />}
                  </Link>
                );
              })()}
            </div>
          )}
        </nav>

        <div className="mx-4 border-t border-[#ede8e5]/80" />
        <p className="px-8 py-4 text-xs text-[#c4a88a]">{APP_CONFIG.APP_NAME} Admin</p>
      </div>
    </>
  );
}

// ── Main AdminNav ──────────────────────────────────────────────────────────────

export function AdminNav({ role }: { role: 'admin' | 'instructor' }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const isDashboard = pathname === '/admin';
  const creditsEnabled = useBusinessModel('credits');
  const membershipEnabled = useBusinessModel('memberships');
  const showInvoices = useStudioFeature('showInvoices');
  const googleCalendarSyncEnabled = useStudioFeatureFlag('googleCalendarSync');
  const hasExternalAccessProviders = useHasExternalAccessProviders();

  const navGroups = useMemo<NavGroup[]>(() => {
    if (role === 'instructor') return INSTRUCTOR_NAV_GROUPS;
    return ADMIN_NAV_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.businessModel === 'credits' && !creditsEnabled) return false;
          if (item.businessModel === 'memberships' && !membershipEnabled) return false;
          if (item.feature === 'showInvoices' && !showInvoices) return false;
          if (item.featureFlag === 'googleCalendarSync' && !googleCalendarSyncEnabled) return false;
          if (item.accessProviders && !hasExternalAccessProviders) return false;
          return true;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [role, creditsEnabled, membershipEnabled, showInvoices]);

  useEffect(() => setMounted(true), []);

  // Animate + scroll lock
  useEffect(() => {
    if (mobileOpen) {
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      document.body.style.overflow = 'hidden';
    } else {
      setVisible(false);
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const closeMenu = useCallback(() => setMobileOpen(false), []);

  return (
    <>
      {/* ── Desktop ── */}
      <div className="hidden lg:flex items-center gap-0.5 ml-4">
        <Link
          href="/admin"
          aria-current={isDashboard ? 'page' : undefined}
          className={[
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
            isDashboard
              ? 'bg-[#4e2b22]/10 text-[#4e2b22] font-semibold'
              : 'text-[#6b3d32] hover:bg-[#ede8e5]/60 hover:text-[#4e2b22]',
          ].join(' ')}
        >
          <span className={isDashboard ? 'text-[#4e2b22]' : 'text-[#8b6b5c]'}>
            <DashboardIcon />
          </span>
          Dashboard
        </Link>

        {navGroups.map((group) => (
          <NavDropdown key={group.id} group={group} />
        ))}

        {/* Statistics — admin only */}
        {role === 'admin' && (() => {
          const active = isActive(pathname, '/admin/statistics');
          return (
            <Link
              href="/admin/statistics"
              aria-current={active ? 'page' : undefined}
              className={[
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                active
                  ? 'bg-[#4e2b22]/10 text-[#4e2b22] font-semibold'
                  : 'text-[#6b3d32] hover:bg-[#ede8e5]/60 hover:text-[#4e2b22]',
              ].join(' ')}
            >
              <span className={active ? 'text-[#4e2b22]' : 'text-[#8b6b5c]'}>
                <StatsIcon />
              </span>
              Statistics
            </Link>
          );
        })()}
      </div>

      {/* ── Mobile hamburger ── */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileOpen}
        className={[
          'lg:hidden ml-3 flex size-10 items-center justify-center rounded-xl border transition-all duration-200 active:scale-95',
          mobileOpen
            ? 'border-[#4e2b22]/30 bg-[#4e2b22]/10 text-[#4e2b22]'
            : 'border-[#ede8e5] bg-transparent text-[#6b3d32] hover:bg-[#ede8e5]/60',
        ].join(' ')}
      >
        <span className="transition-transform duration-200">
          {mobileOpen ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
        </span>
      </button>

      {/* ── Mobile drawer portal ── */}
      {mounted && createPortal(
        <MobileDrawer onClose={closeMenu} visible={visible} navGroups={navGroups} role={role} />,
        document.body,
      )}
    </>
  );
}
