'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { BadgeCheckIcon, RefreshCwIcon, CalendarIcon } from 'lucide-react';
import { getMyMembershipAction } from '@/modules/billing/actions/membership.actions';
import type { MyMembership } from '@/modules/billing/actions/membership.actions';
import { LEGACY_CREDIT_TYPE_LABELS, SESSION_SUBTYPE_LABELS } from '@/lib/config/class-types';

const CREDIT_TYPE_LABEL = LEGACY_CREDIT_TYPE_LABELS;
const SESSION_SUBTYPE_LABEL = SESSION_SUBTYPE_LABELS;

// ─── Active membership banner ─────────────────────────────────────────────────

function ActiveMembershipBanner({ membership }: { membership: MyMembership }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-[#faf9f7]/80 p-5">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <BadgeCheckIcon className="size-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-base font-semibold text-[#4e2b22]">{membership.planName}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          </div>
          {membership.planDescription && (
            <p className="text-sm text-[#8b6b5c] mb-3">{membership.planDescription}</p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="rounded-lg bg-white/70 p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <RefreshCwIcon className="size-3 text-[#8b6b5c]" />
                <p className="text-[10px] font-medium text-[#8b6b5c] uppercase tracking-wide">Weekly credits</p>
              </div>
              <p className="text-sm font-bold text-[#4e2b22]">
                {membership.weeklyCredits}{' '}
                {membership.sessionSubtype && membership.creditType === 'session'
                  ? SESSION_SUBTYPE_LABEL[membership.sessionSubtype]
                  : CREDIT_TYPE_LABEL[membership.creditType]}
              </p>
            </div>
            <div className="rounded-lg bg-white/70 p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <CalendarIcon className="size-3 text-[#8b6b5c]" />
                <p className="text-[10px] font-medium text-[#8b6b5c] uppercase tracking-wide">Valid until</p>
              </div>
              <p className="text-sm font-bold text-[#4e2b22]">
                {format(membership.endsAt, 'd MMM yyyy')}
              </p>
            </div>
            <div className="rounded-lg bg-white/70 p-2.5 col-span-2 sm:col-span-1">
              <p className="text-[10px] font-medium text-[#8b6b5c] uppercase tracking-wide">Status</p>
              <p className="text-sm font-bold text-emerald-700">Renewing</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-white/60 p-3">
        <p className="text-xs text-[#6b3d32] leading-relaxed">
          Your membership runs until <strong>{format(membership.endsAt, 'd MMM yyyy')}</strong> and cannot be cancelled early.
          Credits already on your account remain valid. Once your membership expires, you can purchase a new one anytime.
        </p>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function MembershipShopSection() {
  const [myMembership, setMyMembership] = useState<MyMembership | null | undefined>(undefined);

  useEffect(() => {
    getMyMembershipAction().then((membership) => {
      setMyMembership(membership ?? null);
    });
  }, []);

  if (myMembership === undefined) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 rounded-2xl bg-[#ede8e5]/50" />
      </div>
    );
  }

  if (!myMembership) return null;

  return <ActiveMembershipBanner membership={myMembership} />;
}
