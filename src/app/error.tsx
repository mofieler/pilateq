'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4 py-8">
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
          <Button
            onClick={reset}
            variant="boutique"
            className="w-full sm:w-auto min-h-[44px]"
          >
            Try again
          </Button>
          <Link
            href="/"
            className="inline-flex w-full sm:w-auto items-center justify-center min-h-[44px] px-4 rounded-xl border border-[#c4a88a]/40 bg-[#ede8e5]/60 text-sm font-semibold text-[#4e2b22] hover:bg-[#ede8e5] hover:border-[#c4a88a]/60 transition-all"
          >
            Go to home
          </Link>
        </div>
      </div>
    </div>
  );
}
