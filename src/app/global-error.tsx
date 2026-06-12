'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex items-center justify-center bg-[#faf9f7] px-4 py-8 font-sans antialiased">
        <div className="w-full max-w-md rounded-2xl border border-[#ede8e5] bg-gradient-to-br from-[#ede8e5]/60 to-[#faf9f7]/80 p-6 sm:p-8 shadow-[0_4px_20px_rgba(78,43,34,0.08)] text-center">
          <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-full bg-[#4e2b22]/10">
            <span className="text-2xl" aria-hidden="true">
              ✕
            </span>
          </div>

          <h1 className="text-2xl font-bold text-[#4e2b22] mb-2">
            {APP_CONFIG.APP_NAME}
          </h1>
          <p className="text-[#6b3d32] mb-6">
            Something went wrong on our side.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex w-full sm:w-auto items-center justify-center min-h-[44px] px-5 rounded-xl bg-gradient-to-br from-[#4e2b22] to-[#6b3d32] text-sm font-semibold text-[#faf9f7] shadow-[0_4px_14px_rgba(78,43,34,0.25)] hover:from-[#5a3228] hover:to-[#7a4538] hover:shadow-[0_6px_20px_rgba(78,43,34,0.35)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2"
            >
              Try again
            </button>
            <a
              href="/"
              className="inline-flex w-full sm:w-auto items-center justify-center min-h-[44px] px-4 rounded-xl border border-[#c4a88a]/40 bg-[#ede8e5]/60 text-sm font-semibold text-[#4e2b22] hover:bg-[#ede8e5] hover:border-[#c4a88a]/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2"
            >
              Go to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
