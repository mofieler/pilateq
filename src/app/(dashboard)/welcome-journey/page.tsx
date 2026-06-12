import Link from 'next/link';
import { Star, ArrowRight, ShieldAlert } from 'lucide-react';
import { auth } from '@/lib/auth/auth';
import { WelcomeJourneyBookingView } from '@/modules/welcome/components/WelcomeJourneyBookingView';
import { hasPurchasedWelcomeJourney } from '@/modules/welcome/actions/welcomeRequest.actions';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function WelcomeJourneyPage() {
  const authSession = await auth();
  const userId = authSession?.user?.id ?? '';

  if (!userId) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#ede8e5]/80 bg-[#faf9f7] p-8 text-center">
          <h1 className="text-xl font-bold text-[#4e2b22]">Welcome Journey</h1>
          <p className="mt-2 text-sm text-[#8b6b5c]">Please sign in to access your Welcome Journey.</p>
        </div>
      </div>
    );
  }

  const purchaseResult = await hasPurchasedWelcomeJourney();
  const hasPurchased = purchaseResult.success && purchaseResult.data;

  const [userRow] = await db
    .select({ hasSignedWaiver: users.hasSignedWaiver })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const hasSignedWaiver = userRow?.hasSignedWaiver ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#4e2b22]">Welcome Journey</h1>
        <p className="mt-2 text-sm text-[#8b6b5c]">
          Your private introduction to Pilates — request slots, view offers, and confirm your session.
        </p>
      </div>

      {/* Blocking waiver banner */}
      {!hasSignedWaiver && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-[0_4px_12px_rgba(120,80,20,0.08)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <ShieldAlert className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-bold text-amber-900">Please sign the liability waiver before booking your Welcome Journey.</h3>
              <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                Signing the waiver is required before you can purchase or book your introduction session.
              </p>
            </div>
          </div>
          <Link
            href="/waiver"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-bold text-amber-50 shadow-[0_4px_14px_rgba(120,80,20,0.25)] transition-all hover:bg-amber-800 hover:shadow-[0_6px_20px_rgba(120,80,20,0.35)] hover:-translate-y-0.5"
          >
            Sign Waiver
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      {!hasPurchased ? (
        <div className="mx-auto max-w-lg rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#ede8e5]/40 p-10 text-center shadow-[0_4px_20px_rgba(78,43,34,0.03)]">
          <div className="inline-flex size-16 items-center justify-center rounded-full bg-[#d4a574]/15">
            <Star className="size-8 text-[#d4a574]" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-[#4e2b22]">Purchase Your Welcome Journey First</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#6b3d32]">
            To request your private introduction session, you&apos;ll need to purchase the Welcome Journey package first.
            It&apos;s a one-time 2-hour session that unlocks all Pilates apparatus classes for you.
          </p>
          <div className="mt-6 space-y-3">
            {hasSignedWaiver ? (
              <Link
                href="/credits?tab=purchase"
                className="inline-flex items-center gap-2 rounded-xl bg-[#4e2b22] px-6 py-3 text-sm font-bold text-[#faf9f7] shadow-[0_4px_14px_rgba(78,43,34,0.25)] transition-all hover:bg-[#6b3d32] hover:-translate-y-0.5"
              >
                Buy Welcome Journey
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-[#4e2b22]/40 px-6 py-3 text-sm font-bold text-[#faf9f7] shadow-none"
              >
                Buy Welcome Journey
                <ArrowRight className="size-4" />
              </button>
            )}
            <p className="text-xs text-[#8b6b5c]">
              Already bought it? It may take a moment to appear — refresh the page.
            </p>
          </div>
        </div>
      ) : (
        <WelcomeJourneyBookingView hasSignedWaiver={hasSignedWaiver} />
      )}
    </div>
  );
}
