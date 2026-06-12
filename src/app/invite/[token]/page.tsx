import { formatStudio, formatStudioTime } from '@/lib/utils/date.utils';
import { Clock, MapPin, Users } from 'lucide-react';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { duoInviteService } from '@/modules/booking/services/duo-invite.service';
import { AcceptInviteButton } from './AcceptInviteButton';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;

  const data = await duoInviteService.getInvitePageData(token);
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Generic "not found" — avoids token enumeration
  if (!data) {
    return <InviteShell><ErrorCard message="This invite link is not valid." /></InviteShell>;
  }

  const isExpired = data.expiresAt <= new Date();
  const hasStarted = data.startsAt <= new Date();

  if (data.status === 'accepted') {
    return <InviteShell><ErrorCard message="This spot has already been claimed." /></InviteShell>;
  }
  if (data.status === 'cancelled') {
    return <InviteShell><ErrorCard message="This invite was cancelled." /></InviteShell>;
  }
  if (isExpired || data.status === 'expired') {
    return <InviteShell><ErrorCard message="This invite has expired." /></InviteShell>;
  }
  if (hasStarted) {
    return <InviteShell><ErrorCard message="This class has already started." /></InviteShell>;
  }

  const eligibility = userId
    ? await duoInviteService.checkPartnerEligibility(
        data.studioId,
        userId,
        data.sessionId,
        data.organizerUserId,
        data.creditType,
        data.creditCost,
      )
    : null;

  const creditLabel = {
    pass:          'Credit',
    mat_pass:      'Mat Credit',
    reformer_pass: 'Reformer Credit',
    session:       'Session Credit',
  }[data.creditType as import('@/lib/config/class-types').CreditType] ?? `${data.creditType} Credit`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  return (
    <InviteShell>
      <div className="w-full max-w-sm mx-auto space-y-5">
        {/* Invite card */}
        <div className="rounded-3xl border border-[#ede8e5] bg-white shadow-xl shadow-[#4e2b22]/8 overflow-hidden">
          {/* Top band */}
          <div className="bg-linear-to-br from-[#4e2b22] to-[#6b3d32] px-6 pt-8 pb-6 text-center">
            <p className="text-[#c4a88a] text-sm font-medium mb-1">You've been invited</p>
            <h1 className="text-white text-xl font-bold">
              {data.organizerFirstName} invited you
            </h1>
            <p className="text-[#ede8e5]/80 text-sm mt-1">to a Pilates session</p>
          </div>

          {/* Session details */}
          <div className="px-6 py-5 space-y-3">
            <p className="text-lg font-semibold text-[#4e2b22]">{data.sessionName}</p>

            <div className="space-y-2 text-sm text-[#6b3d32]">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-[#c4a88a] shrink-0" />
                <span>
                  {formatStudio(new Date(data.startsAt), 'EEEE, d MMMM')} · {formatStudioTime(new Date(data.startsAt))} · {data.durationMinutes} min
                </span>
              </div>
              {data.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-[#c4a88a] shrink-0" />
                  <span>{data.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Users className="size-4 text-[#c4a88a] shrink-0" />
                <span>{data.creditCost} {creditLabel}</span>
              </div>
            </div>

            {/* CTA */}
            <div className="pt-3 space-y-2">
              {!userId ? (
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
                  className="flex w-full items-center justify-center rounded-2xl bg-[#4e2b22] px-4 py-3.5 text-sm font-semibold text-white hover:bg-[#6b3d32] transition-colors"
                >
                  Sign in to Join
                </Link>
              ) : eligibility?.isSelf ? (
                <p className="rounded-2xl bg-[#ede8e5]/60 px-4 py-3 text-center text-sm text-[#8b6b5c]">
                  You cannot accept your own invite
                </p>
              ) : eligibility?.isAlreadyBooked ? (
                <p className="rounded-2xl bg-[#6b8e6b]/10 px-4 py-3 text-center text-sm font-medium text-[#4a7c4a]">
                  You're already booked for this class
                </p>
              ) : eligibility?.hasCredits ? (
                <AcceptInviteButton token={token} creditLabel={creditLabel} creditCost={data.creditCost} />
              ) : (
                <Link
                  href={`/credits?return=${encodeURIComponent(`/invite/${token}`)}`}
                  className="flex w-full items-center justify-center rounded-2xl border-2 border-[#4e2b22] px-4 py-3.5 text-sm font-semibold text-[#4e2b22] hover:bg-[#4e2b22]/5 transition-colors"
                >
                  Buy Credits to Join
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Expiry */}
        <p className="text-center text-xs text-[#a6856f] flex items-center justify-center gap-1.5">
          <Clock className="size-3.5" />
          Invite expires {formatStudio(new Date(data.expiresAt), "d MMM 'at' HH:mm")}
        </p>
      </div>
    </InviteShell>
  );
}

// ─── Shell layout ─────────────────────────────────────────────────────────────

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#c4a88a]">Pilates Studio</p>
      </div>
      {children}
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="w-full max-w-sm mx-auto text-center space-y-4">
      <div className="rounded-3xl border border-[#ede8e5] bg-white p-8 shadow-sm">
        <p className="text-[#8b6b5c]">{message}</p>
      </div>
      <Link href="/" className="text-sm text-[#8b6b5c] underline underline-offset-2 hover:text-[#4e2b22] transition-colors">
        Go to homepage
      </Link>
    </div>
  );
}
