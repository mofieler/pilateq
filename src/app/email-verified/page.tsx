import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

export default async function EmailVerifiedPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const supportEmail = `support@${new URL(APP_CONFIG.APP_URL).hostname}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4 py-8">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center size-20 rounded-full bg-[#4a7c4a]/10 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-10 text-[#4a7c4a]">
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-[#4e2b22] mb-3">Your email is verified</h1>
        <p className="text-[#6b3d32] mb-6 leading-relaxed">
          Your email address has been successfully verified. You can now sign in to your account and start managing your studio.
        </p>

        <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6 text-left mb-6">
          <p className="text-sm text-[#6b3d32] font-medium mb-3">What&apos;s next?</p>
          <ul className="text-sm text-[#8b6b5c] space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-[#4a7c4a] mt-0.5">✓</span>
              <span>Sign in to your account</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#4a7c4a] mt-0.5">✓</span>
              <span>Complete your studio setup</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#4a7c4a] mt-0.5">✓</span>
              <span>Schedule your first classes</span>
            </li>
          </ul>
        </div>

        <Link
          href={isLoggedIn ? '/admin' : '/login?verified=true'}
          className="inline-flex items-center justify-center rounded-xl bg-[#4e2b22] px-6 py-3 text-sm font-semibold text-[#faf9f7] shadow-sm hover:bg-[#6b3d32] transition-colors min-h-[44px]"
        >
          {isLoggedIn ? 'Go to dashboard' : 'Sign in'}
        </Link>

        <p className="text-sm text-[#8b6b5c] mt-6">
          Need help?{' '}
          <a href={`mailto:${supportEmail}`} className="text-[#4e2b22] font-medium hover:text-[#6b3d32] transition-colors">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
