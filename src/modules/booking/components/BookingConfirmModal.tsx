'use client';

import { useState, useTransition } from 'react';
import { formatStudio, formatStudioTime } from '@/lib/utils/date.utils';
import { ClockIcon, CreditCardIcon, Loader2Icon, MapPinIcon, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { createBookingAction } from '@/modules/booking/actions/createBooking.action';
import { createDuoInviteAction } from '@/modules/booking/actions/createDuoInvite.action';
import { CANCELLATION_WINDOW_HOURS } from '@/constants/BOOKING_RULES';
import { DuoInviteShareSheet } from './DuoInviteShareSheet';
import { CreditTypeDot } from './CreditTypeDot';
import type { ServiceErrorCode } from '@/modules/billing/services/credit.service';
import type { ClassSessionCardProps } from './ClassSessionCard';
import { getAcceptedCreditTypes, getCreditTypeLabel } from '@/lib/config/class-types';
import { useStudioFeatureFlag } from '@/lib/studio';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingConfirmModalProps {
  session: ClassSessionCardProps | null;
  onClose: () => void;
}

type Step = 'confirm' | 'duo-share' | 'duo-invite-error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CREDIT_LABEL: Record<string, string> = {
  pass:          'Credit',
  mat_pass:      'Mat Credit',
  reformer_pass: 'Reformer Credit',
  session:       'Session Credit',
};

function errorHint(code: ServiceErrorCode | undefined): string | React.ReactNode | undefined {
  switch (code) {
    case 'INSUFFICIENT_CREDITS':
      return 'Top up your credits to book more classes.';
    case 'CLASS_FULL':
      return 'Try joining the waitlist instead.';
    case 'BOOKING_ALREADY_EXISTS':
      return 'This class is already in your upcoming bookings.';
    case 'WAIVER_REQUIRED':
      return (
        <span>
          Please sign the liability waiver before booking.{' '}
          <a href="/waiver" className="underline underline-offset-2 hover:text-amber-900">
            Sign waiver →
          </a>
        </span>
      );
    case 'OVERDUE_BILLS':
      return 'You have overdue invoices. Settle them at the studio or via bank transfer before booking.';
    default:
      return undefined;
  }
}

function isDuoClass(classType: ClassSessionCardProps['classType']): boolean {
  return classType === 'reformer_duo' || classType === 'mat_duo';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingConfirmModal({ session, onClose }: BookingConfirmModalProps) {
  const duoBookingEnabled = useStudioFeatureFlag('duoBooking');
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>('confirm');
  const [duoInvite, setDuoInvite] = useState<{ token: string; expiresAt: Date } | null>(null);
  const [newBookingId, setNewBookingId] = useState<string | null>(null);
  const [duoInviteError, setDuoInviteError] = useState<string | null>(null);

  // Pre-booking credit sufficiency check
  const canAfford = session?.canAfford ?? true;

  // Compute total compatible balance from accepted credit types
  const acceptedTypes = session ? getAcceptedCreditTypes(session.classType) : [];
  const compatibleBalance = session
    ? acceptedTypes.reduce((sum, ct) => sum + (session.userCreditBalances?.[ct] ?? 0), 0)
    : 0;
  const acceptedTypeLabels = acceptedTypes.map((ct) => getCreditTypeLabel(ct));

  function handleClose() {
    setStep('confirm');
    setDuoInvite(null);
    setNewBookingId(null);
    setDuoInviteError(null);
    onClose();
  }

  async function tryCreateDuoInvite(bookingId: string) {
    const invite = await createDuoInviteAction({ bookingId });
    if (invite.success && invite.data) {
      setDuoInvite(invite.data);
      setDuoInviteError(null);
      setStep('duo-share');
      return true;
    }
    setDuoInviteError(invite.error ?? 'Could not create duo invite. Please try again.');
    setStep('duo-invite-error');
    return false;
  }

  function handleConfirm() {
    if (!session) return;

    startTransition(async () => {
      const result = await createBookingAction({ sessionId: session.id });

      if (!result.success) {
        handleClose();
        toast.error(result.error, { description: errorHint(result.code) });
        return;
      }

      const bookingId = result.data?.id;

      // For duo classes, generate an invite link before closing
      if (duoBookingEnabled && isDuoClass(session.classType) && bookingId) {
        setNewBookingId(bookingId);
        const ok = await tryCreateDuoInvite(bookingId);
        if (ok) return;
        return;
      }

      handleClose();
      toast.success('Booking confirmed!', {
        description: `See you at ${session.name} on ${formatStudio(session.startsAt, 'EEEE, d MMMM')}.`,
      });
    });
  }

  return (
    <AlertDialog
      open={session !== null}
      onOpenChange={(open: boolean) => {
        if (!open && !isPending) handleClose();
      }}
    >
      <AlertDialogContent className={step === 'duo-share' ? 'p-0 overflow-hidden' : ''}>
        {step === 'duo-share' && duoInvite && session ? (
          <DuoInviteShareSheet
            sessionName={session.name}
            startsAt={session.startsAt}
            inviteToken={duoInvite.token}
            expiresAt={duoInvite.expiresAt}
            onDone={() => {
              handleClose();
              toast.success('Booking confirmed!', {
                description: `See you at ${session.name} on ${formatStudio(session.startsAt, 'EEEE, d MMMM')}.`,
              });
            }}
          />
        ) : step === 'duo-invite-error' && session ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Booking confirmed!</AlertDialogTitle>
              <AlertDialogDescription>
                Your spot in {session.name} is reserved.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-[#d4a574]/20 bg-[#d4a574]/15 px-3 py-2.5 text-sm text-[#b58a5c]">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">We couldn&apos;t create your duo invite</p>
                  <p className="mt-0.5 text-xs opacity-90">
                    {duoInviteError ?? 'Please try again or copy the invite link later from My Bookings.'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#8b6b5c]">
                You can still invite your duo partner later from your booking history.
              </p>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleClose} disabled={isPending} className="min-h-[44px]">
                Close
              </AlertDialogCancel>
              {newBookingId && (
                <AlertDialogAction
                  disabled={isPending}
                  onClick={() => newBookingId && startTransition(() => { tryCreateDuoInvite(newBookingId); })}
                  className="min-h-[44px] bg-[#4e2b22] text-[#faf9f7] hover:bg-[#6b3d32] focus-visible:ring-[#4e2b22]"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2Icon className="size-4 animate-spin" aria-hidden />
                      Retrying…
                    </span>
                  ) : (
                    'Retry invite'
                  )}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </>
        ) : session ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{session.name}</AlertDialogTitle>
              <AlertDialogDescription>with {session.instructorName}</AlertDialogDescription>
            </AlertDialogHeader>

            {duoBookingEnabled && isDuoClass(session.classType) && (
              <p className="text-xs text-[#6b4a3d] flex items-center gap-1.5 -mt-1">
                <span className="text-[#c4a88a]">●</span>
                After booking you'll get a link to invite your duo partner
              </p>
            )}

            {/* Session details */}
            <div className="space-y-2.5 rounded-lg bg-[#faf9f7]/80 px-3 py-3 text-sm text-[#6b3d32]">
              <div className="flex items-center gap-2">
                <ClockIcon className="size-4 shrink-0 text-[#c4a88a]" aria-hidden />
                <span>
                  {formatStudio(session.startsAt, 'EEEE, d MMMM')} at{' '}
                  {formatStudioTime(session.startsAt)}
                  {' · '}
                  {session.durationMinutes} min
                </span>
              </div>

              {session.location && (
                <div className="flex items-center gap-2">
                  <MapPinIcon className="size-4 shrink-0 text-[#c4a88a]" aria-hidden />
                  <span>{session.location}</span>
                </div>
              )}

              <div className="flex items-start gap-2">
                <CreditCardIcon className="mt-0.5 size-4 shrink-0 text-[#c4a88a]" aria-hidden />
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <CreditTypeDot creditType={session.creditType} size={8} />
                    This class costs {session.creditCost}{' '}
                    {session.creditType === 'session' ? 'Session Credit' : 'Credit'}
                    {session.creditCost === 1 ? '' : 's'}
                  </span>
                  <span
                    className={
                      canAfford
                        ? 'text-xs font-medium text-[#4a7c4a]'
                        : 'text-xs font-medium text-[#c45c4a]'
                    }
                  >
                    You have {compatibleBalance} compatible credit{compatibleBalance === 1 ? '' : 's'} (
                    {acceptedTypeLabels.join(', ')}) · {session.creditCost} will be deducted
                  </span>
                </div>
              </div>
            </div>

            {session.requiresWelcomeJourney && (
              <div className="rounded-lg border border-[#d4a574]/20 bg-[#d4a574]/15 px-3 py-2.5 text-sm text-[#b58a5c]">
                <p className="font-medium">Welcome Journey required</p>
                <p className="mt-0.5 text-xs opacity-90">
                  This class requires a completed Welcome Journey. Yoga classes are open to everyone — no intro needed!
                </p>
                <a
                  href="/welcome-journey"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#8b5a3c] underline underline-offset-2 hover:text-[#6b3d32]"
                >
                  Start your Welcome Journey request →
                </a>
              </div>
            )}

            {!session.requiresWelcomeJourney && !canAfford && (
              <div className="rounded-lg border border-[#c45c4a]/20 bg-[#c45c4a]/8 px-3 py-2.5 text-sm text-[#c45c4a]">
                <p className="font-medium flex items-center gap-1.5">
                  <AlertCircle className="size-4" aria-hidden />
                  Insufficient credits
                </p>
                <p className="mt-0.5 text-xs opacity-90">
                  You need {session.creditCost} compatible credit
                  {session.creditCost === 1 ? '' : 's'} but only have {compatibleBalance} (
                  {acceptedTypeLabels.join(', ')}). Purchase more credits to book this class.
                </p>
              </div>
            )}

            <p className="text-xs text-[#8b6b5c]">
              Free cancellation up to {CANCELLATION_WINDOW_HOURS} hours before the class starts.
            </p>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending} className="min-h-[44px]">
                Cancel
              </AlertDialogCancel>
              {session.requiresWelcomeJourney ? (
                <a
                  href="/welcome-journey"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-[#d4a574] px-4 py-2 text-sm font-medium text-[#faf9f7] hover:bg-[#c49a68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a574] focus-visible:ring-offset-2"
                >
                  Start Welcome Journey →
                </a>
              ) : !canAfford ? (
                <a
                  href="/credits?tab=purchase"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-[#c45c4a] px-4 py-2 text-sm font-medium text-white hover:bg-[#b54a3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c45c4a] focus-visible:ring-offset-2"
                >
                  Get Credits →
                </a>
              ) : (
                <AlertDialogAction
                  disabled={isPending}
                  onClick={handleConfirm}
                  className="min-h-[44px] bg-[#4e2b22] text-[#faf9f7] hover:bg-[#6b3d32] focus-visible:ring-[#4e2b22]"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2Icon className="size-4 animate-spin" aria-hidden />
                      Booking...
                    </span>
                  ) : (
                    'Confirm Booking'
                  )}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
