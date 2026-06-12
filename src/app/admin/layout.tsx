import Link from 'next/link';
import { auth, signOut } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { AdminNav } from './components/AdminNav';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

const ArrowRightIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
  </svg>
);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'admin' && session.user.role !== 'instructor') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] to-[#f5f3f1] overflow-x-clip">
      <nav className="sticky top-0 z-50 border-b border-[#ede8e5]/80 bg-[#faf9f7]/90 backdrop-blur-xl px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Brand + nav links */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src="/logo.png" alt={APP_CONFIG.APP_NAME} className="h-8 w-auto shrink-0" />
            <h1 className="hidden xs:block text-xl font-bold text-[#4e2b22] whitespace-nowrap">{APP_CONFIG.APP_NAME}</h1>
            <span className="rounded-full bg-[#4e2b22] px-2.5 py-1 text-xs font-semibold text-[#faf9f7] whitespace-nowrap shrink-0">
              {session.user.role === 'instructor' ? 'Instructor' : 'Admin'}
            </span>

            <AdminNav role={session.user.role as 'admin' | 'instructor'} />
          </div>

          {/* Right: email + sign out */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden lg:flex items-center gap-2 rounded-full bg-[#ede8e5]/60 px-3 py-2">
              <div className="size-7 rounded-full bg-gradient-to-br from-[#4e2b22] to-[#6b3d32] flex items-center justify-center text-[#faf9f7] text-xs font-semibold">
                {session.user?.name?.charAt(0) || session.user?.email?.charAt(0)}
              </div>
              <p className="text-xs font-semibold text-[#4e2b22] truncate max-w-[140px]">
                {session.user?.email}
              </p>
            </div>

            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
      <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg border border-[#c4a88a]/50 bg-[#faf9f7] text-xs sm:text-sm font-semibold text-[#4e2b22] transition-all hover:bg-[#4e2b22] hover:text-[#faf9f7] hover:border-[#4e2b22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2 active:bg-[#3a1f19] active:border-[#3a1f19]"
              >
                <ArrowRightIcon />
                <span className="hidden sm:inline">Sign out</span>
                <span className="sm:hidden">Out</span>
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}
