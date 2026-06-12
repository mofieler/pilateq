'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function LoadingPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header skeleton */}
      <header className="sticky top-0 z-50 border-b border-[#ede8e5]/80 bg-[#faf9f7]/90 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg bg-[#ede8e5]" />
            <Skeleton className="hidden sm:block h-5 w-24 rounded-md bg-[#ede8e5]" />
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <Skeleton className="h-4 w-16 rounded-md bg-[#ede8e5]" />
            <Skeleton className="h-4 w-16 rounded-md bg-[#ede8e5]" />
            <Skeleton className="h-4 w-16 rounded-md bg-[#ede8e5]" />
          </div>
          <Skeleton className="h-9 w-20 rounded-lg bg-[#ede8e5]" />
        </div>
      </header>

      {/* Content skeleton */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 pb-24 md:pb-6">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48 rounded-xl bg-[#ede8e5]" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-[#ede8e5] bg-gradient-to-br from-[#ede8e5]/40 to-[#faf9f7]/80 p-5 shadow-[0_4px_20px_rgba(78,43,34,0.04)]">
              <Skeleton className="h-5 w-3/4 rounded-lg bg-[#ede8e5] mb-4" />
              <Skeleton className="h-4 w-full rounded-md bg-[#ede8e5] mb-2" />
              <Skeleton className="h-4 w-5/6 rounded-md bg-[#ede8e5] mb-4" />
              <Skeleton className="h-9 w-28 rounded-lg bg-[#ede8e5]" />
            </div>

            <div className="rounded-2xl border border-[#ede8e5] bg-gradient-to-br from-[#ede8e5]/40 to-[#faf9f7]/80 p-5 shadow-[0_4px_20px_rgba(78,43,34,0.04)]">
              <Skeleton className="h-5 w-2/3 rounded-lg bg-[#ede8e5] mb-4" />
              <Skeleton className="h-4 w-full rounded-md bg-[#ede8e5] mb-2" />
              <Skeleton className="h-4 w-4/5 rounded-md bg-[#ede8e5] mb-4" />
              <Skeleton className="h-9 w-24 rounded-lg bg-[#ede8e5]" />
            </div>

            <div className="rounded-2xl border border-[#ede8e5] bg-gradient-to-br from-[#ede8e5]/40 to-[#faf9f7]/80 p-5 shadow-[0_4px_20px_rgba(78,43,34,0.04)] sm:col-span-2 lg:col-span-1">
              <Skeleton className="h-5 w-3/4 rounded-lg bg-[#ede8e5] mb-4" />
              <Skeleton className="h-4 w-full rounded-md bg-[#ede8e5] mb-2" />
              <Skeleton className="h-4 w-5/6 rounded-md bg-[#ede8e5] mb-4" />
              <Skeleton className="h-9 w-32 rounded-lg bg-[#ede8e5]" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
