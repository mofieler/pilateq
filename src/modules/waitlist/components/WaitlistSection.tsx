'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Clock, MapPin, User, ListOrdered, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';
import { leaveWaitlistAction, type WaitlistEntry } from '../actions/waitlist.actions';
import { useRouter } from 'next/navigation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CLASS_TYPE_LABEL: Record<string, string> = {
  reformer_group:   'Reformer Group',
  reformer_private: 'Reformer Private',
  reformer_duo:     'Reformer Duo',
  mat_group:        'Mat Group',
  mat_private:      'Mat Private',
  mat_duo:          'Mat Duo',
  chair:            'Chair Pilates',
  online:           'Online Class',
  sound_healing:    'Sound Healing',
  yoga:             'Yoga',
};

function OrdinalPosition({ position }: { position: number }) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = position % 100;
  const suffix = suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0];
  return (
    <span className="text-2xl font-bold text-[#4e2b22] tabular-nums">
      {position}<sup className="text-sm">{suffix}</sup>
    </span>
  );
}

// ─── Single Waitlist Card ─────────────────────────────────────────────────────

function WaitlistCard({ entry }: { entry: WaitlistEntry }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const isOffered = entry.status === 'offered';
  const offerExpired = entry.offerExpiresAt ? entry.offerExpiresAt < new Date() : false;
  const offerTimeLeft = entry.offerExpiresAt && !offerExpired
    ? formatDistanceToNow(entry.offerExpiresAt, { addSuffix: false })
    : null;

  const classDate = format(entry.startsAt, 'EEE, d MMM');
  const classTime = format(entry.startsAt, 'HH:mm');

  function handleLeave() {
    if (!confirmLeave) {
      setConfirmLeave(true);
      // Auto-reset the confirm state after 4 seconds
      setTimeout(() => setConfirmLeave(false), 4000);
      return;
    }
    startTransition(async () => {
      const result = await leaveWaitlistAction(entry.id);
      if (result.success) {
        toast.success('Removed from waitlist.');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Failed to leave waitlist.');
        setConfirmLeave(false);
      }
    });
  }

  return (
    <div className={[
      'relative rounded-2xl border p-5 transition-all',
      isOffered
        ? 'border-amber-200 bg-gradient-to-br from-amber-50/90 to-orange-50/60 shadow-[0_4px_20px_rgba(251,191,36,0.12)]'
        : 'border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#f5f3f1]/70',
    ].join(' ')}>

      {/* Offered badge — prominent call to action */}
      {isOffered && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-100 border border-amber-200 px-3.5 py-2.5">
          <AlertCircle className="size-4 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-800">Spot available — action required!</p>
            {offerTimeLeft && (
              <p className="text-xs text-amber-700 mt-0.5">
                Offer expires in <span className="font-semibold">{offerTimeLeft}</span>
              </p>
            )}
          </div>
          <Link
            href="/book"
            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
          >
            Book now →
          </Link>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        {/* Position indicator */}
        <div className="flex flex-col items-center justify-center min-w-[56px] rounded-xl bg-[#ede8e5]/60 px-3 py-2 text-center">
          <OrdinalPosition position={entry.position} />
          <span className="text-[10px] text-[#8b6b5c] font-medium mt-0.5 uppercase tracking-wide">in queue</span>
        </div>

        {/* Class details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-medium text-[#8b6b5c] rounded-full bg-[#ede8e5]/60 px-2.5 py-0.5">
              {CLASS_TYPE_LABEL[entry.classType] ?? entry.classType}
            </span>
            {!isOffered && (
              <span className="flex items-center gap-1 text-[10px] text-[#a6856f]">
                <ListOrdered className="size-3" /> Waitlisted
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-[#4e2b22] leading-tight">{entry.className}</h3>

          <div className="mt-2 space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-[#6b3d32]">
              <Clock className="size-3.5 text-[#c4a88a] shrink-0" />
              <span className="font-medium">{classDate}</span>
              <span className="text-[#8b6b5c]">at {classTime} ({entry.durationMinutes} min)</span>
            </div>
            {entry.instructorName && (
              <div className="flex items-center gap-2 text-[#6b3d32]">
                <User className="size-3.5 text-[#c4a88a] shrink-0" />
                <span>{entry.instructorName}</span>
              </div>
            )}
            {entry.location && (
              <div className="flex items-center gap-2 text-[#6b3d32]">
                <MapPin className="size-3.5 text-[#c4a88a] shrink-0" />
                <span>{entry.location}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leave waitlist */}
      <div className="mt-4 pt-4 border-t border-[#ede8e5]/60 flex items-center justify-between gap-3">
        <p className="text-xs text-[#a6856f]">
          {isOffered
            ? 'Book the class to confirm your spot, or leave the waitlist below.'
            : 'You\'ll be notified when a spot opens up.'}
        </p>
        <button
          type="button"
          onClick={handleLeave}
          disabled={isPending}
          className={[
            'shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
            confirmLeave
              ? 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'
              : 'bg-[#ede8e5]/60 text-[#6b3d32] hover:bg-[#ede8e5] border border-transparent',
            isPending ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          {isPending
            ? <><Loader2 className="size-3.5 animate-spin" /> Leaving…</>
            : confirmLeave
              ? <><AlertCircle className="size-3.5" /> Confirm leave?</>
              : 'Leave waitlist'
          }
        </button>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function WaitlistEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#c4a88a]/30 bg-gradient-to-br from-[#faf9f7]/60 to-[#ede8e5]/30 py-10 text-center">
      <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-[#ede8e5]/60 ring-1 ring-[#c4a88a]/20">
        <CheckCircle className="size-7 text-[#c4a88a]" />
      </div>
      <p className="text-sm font-semibold text-[#4e2b22]">No active waitlists</p>
      <p className="mt-1 text-xs text-[#8b6b5c]">You&apos;ll appear here when you join a fully booked class.</p>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function WaitlistSection({ entries }: { entries: WaitlistEntry[] }) {
  const offeredCount = entries.filter((e) => e.status === 'offered').length;

  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
          <ListOrdered className="size-4" />
        </span>
        <h2 className="text-lg font-semibold text-[#4e2b22]">
          Waitlists
          {entries.length > 0 && (
            <span className={[
              'ml-2 rounded-full px-2.5 py-0.5 text-xs font-semibold',
              offeredCount > 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-[#ede8e5] text-[#6b3d32]',
            ].join(' ')}>
              {entries.length}
            </span>
          )}
        </h2>
        {offeredCount > 0 && (
          <span className="ml-auto text-xs font-medium text-amber-700 bg-amber-100 rounded-full px-2.5 py-1">
            ⚡ {offeredCount} spot{offeredCount > 1 ? 's' : ''} available!
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <WaitlistEmpty />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <WaitlistCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </section>
  );
}
