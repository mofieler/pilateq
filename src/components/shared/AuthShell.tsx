'use client';

import Link from 'next/link';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

interface AuthShellProps {
  children: React.ReactNode;
  showFooter?: boolean;
  maxWidthClass?: string;
  disableOuterCard?: boolean;
}

export function AuthShell({
  children,
  showFooter = true,
  maxWidthClass = 'max-w-md',
  disableOuterCard = false,
}: AuthShellProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#faf9f7] px-4 py-8 sm:py-12">
      <div className={`w-full ${maxWidthClass}`}>
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2">
            <img
              src="/logo.png"
              alt={APP_CONFIG.APP_NAME}
              className="h-16 w-auto mx-auto mb-3"
            />
          </Link>
          <div className="text-4xl font-bold text-[#4e2b22] tracking-tight">
            {APP_CONFIG.APP_NAME}
          </div>
        </div>

        {disableOuterCard ? (
          <div className="bg-[#faf9f7]">
            {children}
          </div>
        ) : (
          <div className="bg-gradient-to-br from-[#ede8e5]/60 to-[#faf9f7]/80 p-6 sm:p-8 rounded-2xl border border-[#ede8e5]/80 shadow-[0_4px_20px_rgba(78,43,34,0.04)] backdrop-blur-sm">
            {children}
          </div>
        )}

        {showFooter && (
          <footer className="mt-8 text-center">
            <nav aria-label="Legal" className="flex items-center justify-center gap-3 text-sm text-[#8b6b5c]">
              <Link
                href="/impressum"
                className="px-2 py-1 rounded transition-colors hover:text-[#4e2b22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2"
              >
                Impressum
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                href="/datenschutz"
                className="px-2 py-1 rounded transition-colors hover:text-[#4e2b22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2"
              >
                Datenschutz
              </Link>
            </nav>
          </footer>
        )}
      </div>
    </div>
  );
}
