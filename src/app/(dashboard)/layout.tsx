import Link from 'next/link';
import { getStudioConfig } from '@/lib/studio/server';
import { APP_CONFIG } from '@/constants/APP_CONFIG';
import { auth, signOut } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { ProfileCompletionOverlay } from '@/components/shared/ProfileCompletionOverlay';
import { CookieNotice } from '@/components/shared/CookieNotice';
import { InactivityWarningModal } from '@/components/shared/InactivityWarningModal';
import { BillingReminderPopup } from '@/modules/billing/components/BillingReminderPopup';
import { UserMobileNav } from './components/UserMobileNav';
import { DesktopNavLinks } from './components/DesktopNavLinks';
import { MobileBottomNav } from './components/MobileBottomNav';
import { getMyWelcomeJourneyRequest } from '@/modules/welcome/actions/welcomeRequest.actions';
import { NavProfileMenu } from '@/modules/users/components/NavProfileMenu';
import { StudioSwitcher } from '@/components/shared/StudioSwitcher';
import { getMyMembershipsAction } from '@/modules/studio/actions/memberships.actions';

const ArrowRightIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
  </svg>
);

export default async function DashboardLayout({ children }:  { children: React.ReactNode }) {
  const session = await auth();
  const studio = await getStudioConfig();
  const studioName = studio.identity.legalName || studio.identity.name || 'Your Studio';

  if (!session) redirect('/login');

  const needsProfileCompletion = (session.user as any)?.needsProfileCompletion === true;

  const membershipsResult = await getMyMembershipsAction();
  const memberships = membershipsResult.success ? membershipsResult.data : [];

  let hasOfferedSlots = false;
  try {
    const wjRes = await getMyWelcomeJourneyRequest();
    if (wjRes.success && wjRes.data?.request?.status === 'slots_offered') {
      hasOfferedSlots = true;
    }
  } catch (err) {
    console.error('Failed to get welcome request in layout:', err);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] to-[#f5f3f1] overflow-x-clip">
      <nav className="sticky top-0 z-50 border-b border-[#ede8e5]/80 bg-[#faf9f7]/90 backdrop-blur-xl px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand + nav links */}
          <div className="flex items-center gap-4">
          {/* Brand logo */}
            <Link
              href="/"
              className="flex items-center gap-2 text-base font-bold tracking-tight text-[#4e2b22] hover:text-[#6b3d32] transition-colors"
            >
              <img src="/logo.png" alt={APP_CONFIG.APP_NAME} className="h-8 w-auto" />
              <span className="hidden xs:inline">{APP_CONFIG.APP_NAME}</span>
            </Link>

            {/* Mobile hamburger — portal handles the panel */}
            <UserMobileNav hasOfferedSlots={hasOfferedSlots} />

            {/* Desktop nav links — active state handled by DesktopNavLinks (client) */}
            <DesktopNavLinks hasOfferedSlots={hasOfferedSlots} />
          </div>

          {/* Right: email + sign out */}
          <div className="flex items-center gap-3">
            <StudioSwitcher initialMemberships={memberships} />

            <NavProfileMenu
              name={session.user?.name ?? 'User'}
              email={session.user?.email ?? ''}
              avatarUrl={session.user?.image}
            />

            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button
                type="submit"
              className="rounded-lg border border-[#c4a88a]/50 bg-[#faf9f7] px-3 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold text-[#4e2b22] transition-all hover:bg-[#4e2b22] hover:text-[#faf9f7] hover:border-[#4e2b22] active:bg-[#6b3d32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2 flex items-center justify-center gap-1.5"
              >
                <ArrowRightIcon />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 flex-1 pb-24 md:pb-6">{children}</main>

      <MobileBottomNav hasOfferedSlots={hasOfferedSlots} />

      <footer className="border-t border-[#ede8e5]/60 bg-[#faf9f7]/80 px-6 py-4 mt-auto hidden md:block">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-3 items-center justify-between">
          <p className="text-xs text-[#a6856f]">
            &copy; {new Date().getFullYear()} {studioName}
          </p>
          <div className="flex gap-2 text-xs sm:text-sm flex-wrap">
            <Link href="/impressum"      className="px-2 py-1.5 rounded transition-all hover:bg-[#ede8e5]/60 text-[#8b6b5c] hover:text-[#4e2b22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2">Impressum</Link>
            <Link href="/datenschutz"    className="px-2 py-1.5 rounded transition-all hover:bg-[#ede8e5]/60 text-[#8b6b5c] hover:text-[#4e2b22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2">Privacy</Link>
            <Link href="/agb"            className="px-2 py-1.5 rounded transition-all hover:bg-[#ede8e5]/60 text-[#8b6b5c] hover:text-[#4e2b22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2">T&amp;Cs</Link>
            <Link href="/widerrufsrecht" className="px-2 py-1.5 rounded transition-all hover:bg-[#ede8e5]/60 text-[#8b6b5c] hover:text-[#4e2b22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2">Cancellation</Link>
          </div>
        </div>
      </footer>

      {needsProfileCompletion && (
        <ProfileCompletionOverlay initialName={session.user?.name ?? ''} />
      )}
      <CookieNotice />
      <BillingReminderPopup />
      <InactivityWarningModal />
    </div>
  );
}
