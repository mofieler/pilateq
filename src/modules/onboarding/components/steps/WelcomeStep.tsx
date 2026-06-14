'use client';

import { SparklesIcon } from '@heroicons/react/24/outline';

export function WelcomeStep() {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#4e2b22]/10">
        <SparklesIcon className="size-8 text-[#4e2b22]" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-[#4e2b22]">Welcome to PilatesOS</h2>
        <p className="mt-2 text-[#8b6b5c]">
          Let&apos;s set up your studio in a few simple steps. You can pause and continue anytime —
          your progress is saved automatically.
        </p>
      </div>
      <ul className="mx-auto max-w-md space-y-3 text-left text-sm text-[#6b3d32]">
        <li className="flex items-start gap-3 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/60 p-4">
          <span className="font-bold text-[#4e2b22]">1.</span>
          <span>Tell us about your studio identity and brand.</span>
        </li>
        <li className="flex items-start gap-3 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/60 p-4">
          <span className="font-bold text-[#4e2b22]">2.</span>
          <span>Choose your business model and payment methods.</span>
        </li>
        <li className="flex items-start gap-3 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/60 p-4">
          <span className="font-bold text-[#4e2b22]">3.</span>
          <span>Build your class catalog and launch your studio.</span>
        </li>
      </ul>
    </div>
  );
}
