import Link from 'next/link';
import { CreditCard, CalendarDays, Heart, Sparkles } from 'lucide-react';

interface Props {
  studioName?: string;
  welcomeJourneyPending?: boolean;
}

export function EmptyDashboard({ studioName = 'the studio', welcomeJourneyPending = false }: Props) {
  return (
    <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7] to-[#f5ede0] p-8 md:p-10 shadow-[0_4px_20px_rgba(78,43,34,0.04)] text-center">
      {/* Icon */}
      <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d4a574]/20 to-[#c4a88a]/30 ring-1 ring-[#c4a88a]/20">
        <Sparkles className="size-8 text-[#c4a88a]" />
      </div>

      {/* Headline */}
      <h2 className="text-xl font-bold text-[#4e2b22]">
        Welcome to {studioName}!
      </h2>
      <p className="mt-2 text-sm text-[#8b6b5c] max-w-md mx-auto leading-relaxed">
        Ready to start your Pilates journey? Follow these simple steps to book your first class.
      </p>

      {/* 3-step guide */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3 max-w-2xl mx-auto">
        <div className="flex flex-col items-center gap-2.5 rounded-xl bg-white/60 border border-[#ede8e5]/60 p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#c4a88a]/15">
            <CreditCard className="size-4 text-[#6b3d32]" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#4e2b22]">1. Buy Credits</p>
            <p className="text-[11px] text-[#8b6b5c] mt-0.5">Choose a credit pack that fits your goals</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2.5 rounded-xl bg-white/60 border border-[#ede8e5]/60 p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#c4a88a]/15">
            <CalendarDays className="size-4 text-[#6b3d32]" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#4e2b22]">2. Book a Class</p>
            <p className="text-[11px] text-[#8b6b5c] mt-0.5">Pick a time that works for your schedule</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2.5 rounded-xl bg-white/60 border border-[#ede8e5]/60 p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#c4a88a]/15">
            <Heart className="size-4 text-[#6b3d32]" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#4e2b22]">3. Show Up & Enjoy</p>
            <p className="text-[11px] text-[#8b6b5c] mt-0.5">Arrive a few minutes early and have fun!</p>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        {welcomeJourneyPending ? (
          <Link
            href="/welcome-journey"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#d4a574] px-5 py-2.5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(212,165,116,0.3)] transition-all hover:bg-[#c4a88a] hover:shadow-[0_6px_20px_rgba(212,165,116,0.4)] hover:-translate-y-0.5"
          >
            <Sparkles className="size-3.5" />
            Complete Welcome Journey
          </Link>
        ) : (
          <>
            <Link
              href="/credits"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4e2b22] px-5 py-2.5 text-xs font-bold text-[#faf9f7] shadow-[0_4px_14px_rgba(78,43,34,0.25)] transition-all hover:bg-[#6b3d32] hover:shadow-[0_6px_20px_rgba(78,43,34,0.35)] hover:-translate-y-0.5"
            >
              <CreditCard className="size-3.5" />
              Buy Credits
            </Link>
            <Link
              href="/book"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#c4a88a]/50 bg-white px-5 py-2.5 text-xs font-bold text-[#4e2b22] transition-all hover:bg-[#faf9f7] hover:border-[#c4a88a]"
            >
              <CalendarDays className="size-3.5" />
              Book First Class
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
