'use client';

import { useState, useTransition } from 'react';
import { formatStudio, formatStudioTime } from '@/lib/utils/date.utils';
import { ClockIcon, Loader2Icon, XIcon } from 'lucide-react';
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
import { cancelBookingAction } from '@/modules/booking/actions/cancelBooking.action';
import {
  CancellationPolicyBanner,
  resolveCancellationPolicy,
} from '@/modules/booking/components/CancellationPolicyBanner';
import { type ClassType, type CreditType, isDuoClassType } from '@/lib/config/class-types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CancelBookingButtonProps = {
  bookingId: string;
  className: string;
  startsAt: Date;
  creditsSpent: number;
  creditType: CreditType;
  /** Remaining late-cancellation mercy uses for this calendar month (0..3). */
  mercyUsesLeft: number;
  rescheduledAt?: Date | null;
  bookedAt?: Date | null;
  classType: ClassType;
};

export type CancelBookingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  className: string;
  startsAt: Date;
  creditsSpent: number;
  creditType: CreditType;
  mercyUsesLeft: number;
  rescheduledAt?: Date | null;
  bookedAt?: Date | null;
  classType: ClassType;
  onSuccess?: () => void;
};

export function CancelBookingDialog({
  open,
  onOpenChange,
  bookingId,
  className,
  startsAt,
  creditsSpent,
  creditType,
  mercyUsesLeft,
  rescheduledAt,
  bookedAt,
  classType,
  onSuccess,
}: CancelBookingDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [duoConfirmed, setDuoConfirmed] = useState(false);

  const policy = resolveCancellationPolicy(startsAt, mercyUsesLeft, new Date(), rescheduledAt, bookedAt);
  const isBlocked = policy.state === 'blocked';
  const isLossState = policy.state === 'loss';
  const isDuo = isDuoClassType(classType);

  function handleConfirm() {
    startTransition(async () => {
      try {
        // Call server action directly - userId comes from auth() inside the action
        const result = await cancelBookingAction({
          bookingId,
          reason: 'Cancelled by user via dashboard',
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to cancel booking');
        }

        onOpenChange(false);
        toast.success('Booking cancelled', {
          description: result.data?.creditsRefunded && result.data.creditsRefunded > 0
            ? `${result.data.creditsRefunded} ${creditType} ${result.data.creditsRefunded === 1 ? 'credit' : 'credits'} refunded.`
            : result.data?.message,
        });
        onSuccess?.();
      } catch (error) {
        onOpenChange(false);
        toast.error(error instanceof Error ? error.message : 'Could not cancel booking.');
      }
    });
  }

  const isConfirmDisabled = isPending || isBlocked || (isDuo && !duoConfirmed);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next: boolean) => {
        // Block closing during pending request
        if (!next && isPending) return;
        if (!next) setDuoConfirmed(false);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            Review the cancellation policy before confirming.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Booking summary */}
        <div className="space-y-2 rounded-lg bg-[#faf9f7]/80 px-3 py-3 text-sm">
          <p className="font-semibold text-[#4e2b22]">{className}</p>
          <div className="flex items-center gap-2 text-[#6b3d32]">
            <ClockIcon className="size-4 shrink-0 text-[#c4a88a]" aria-hidden />
            <span>
              {formatStudio(startsAt, 'EEEE, d MMMM')} at {formatStudioTime(startsAt)}
            </span>
          </div>
        </div>

        {/* Policy banner */}
        <CancellationPolicyBanner
          startsAt={startsAt}
          mercyUsesLeft={mercyUsesLeft}
          creditsAtStake={creditsSpent}
          creditType={creditType}
          rescheduledAt={rescheduledAt}
          bookedAt={bookedAt}
        />

        {/* Duo warning & checkbox — hidden when cancellation is blocked */}
        {isDuo && !isBlocked && (
          <div className="rounded-xl border border-[#d4a574]/20 bg-[#d4a574]/15 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-[#b58a5c] flex items-center gap-1.5">
              ⚠️ Shared Duo Session Warning
            </h4>
            <p className="text-xs text-[#a67c52] leading-relaxed">
              This is a shared duo booking. Cancelling your spot will <strong>automatically cancel the session for your partner</strong> as well.
              {isLossState ? (
                <span> Since this cancellation is within the 24-hour late window, <strong>both you and your partner will forfeit your credits</strong>.</span>
              ) : (
                <span> Both of your credits will be returned to your balances.</span>
              )}
            </p>
            <label className="flex items-start gap-2.5 cursor-pointer pt-1 select-none">
              <input
                type="checkbox"
                checked={duoConfirmed}
                onChange={(e) => setDuoConfirmed(e.target.checked)}
                className="mt-0.5 size-4 rounded border-[#d4a574]/50 text-[#d4a574] focus:ring-[#d4a574]"
              />
              <span className="text-xs font-medium text-[#b58a5c]">
                I have spoken with my partner, and we both agree to cancel this shared session under these terms.
              </span>
            </label>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} className="min-h-[44px]">Keep booking</AlertDialogCancel>

          {!isBlocked && (
            <AlertDialogAction
              disabled={isConfirmDisabled}
              onClick={handleConfirm}
              className={
                isLossState
                  ? 'min-h-[44px] bg-[#c45c4a] text-[#faf9f7] hover:bg-[#b54a3a] focus-visible:ring-[#c45c4a] disabled:opacity-60'
                  : 'min-h-[44px] bg-[#4e2b22] text-[#faf9f7] hover:bg-[#6b3d32] focus-visible:ring-[#4e2b22] disabled:opacity-60'
              }
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                  Cancelling...
                </span>
              ) : isLossState ? (
                'Cancel & forfeit credits'
              ) : (
                'Yes, cancel booking'
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CancelBookingButton({
  bookingId,
  className,
  startsAt,
  creditsSpent,
  creditType,
  mercyUsesLeft,
  rescheduledAt,
  bookedAt,
  classType,
}: CancelBookingButtonProps) {
  const [open, setOpen] = useState(false);
  const policy = resolveCancellationPolicy(startsAt, mercyUsesLeft, new Date(), rescheduledAt, bookedAt);

  // Within 3h of class start: show info instead of cancel button
  if (policy.state === 'blocked') {
    return (
      <span className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-[#c45c4a]">
        <XIcon className="size-3.5" aria-hidden />
        Cancellation closed
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#ede8e5] bg-[#faf9f7] px-3 py-1.5 text-xs font-medium text-[#8b6b5c] transition-colors hover:border-[#c45c4a]/30 hover:bg-[#c45c4a]/10 hover:text-[#c45c4a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2"
        aria-label="Cancel booking"
      >
        <XIcon className="size-3.5" aria-hidden />
        Cancel
      </button>

      <CancelBookingDialog
        open={open}
        onOpenChange={setOpen}
        bookingId={bookingId}
        className={className}
        startsAt={startsAt}
        creditsSpent={creditsSpent}
        creditType={creditType}
        mercyUsesLeft={mercyUsesLeft}
        rescheduledAt={rescheduledAt}
        bookedAt={bookedAt}
        classType={classType}
      />
    </>
  );
}
