'use client';

import { formatStudio, formatStudioTime } from '@/lib/utils/date.utils';
import { ClockIcon, MapPinIcon, CheckCircleIcon, UserIcon, XIcon, BanIcon } from 'lucide-react';
import { isSelfCancellationBlocked } from '@/lib/utils/booking.utils';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { ClassSessionCardProps } from './ClassSessionCard';

export interface BookedClassModalProps {
  session: ClassSessionCardProps | null;
  onClose: () => void;
  onCancel?: (session: ClassSessionCardProps) => void;
}

export function BookedClassModal({ session, onClose, onCancel }: BookedClassModalProps) {
  if (!session || !session.bookingId) return null;

  const isBlocked = isSelfCancellationBlocked(session.startsAt);

  return (
    <AlertDialog open={!!session} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="border-emerald-500 overflow-hidden">
        <AlertDialogHeader>
          <div className="flex items-start justify-between mb-2">
            <AlertDialogTitle className="text-xl">{session.name}</AlertDialogTitle>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
              <CheckCircleIcon className="size-4" />
              Booked
            </span>
          </div>
          <AlertDialogDescription>
            You're successfully booked for this class. 
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Session details */}
        <div className="space-y-3 rounded-xl bg-slate-50 px-4 py-3.5 text-sm my-4 text-slate-700 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <ClockIcon className="size-4 shrink-0 text-slate-400" aria-hidden />
            <span className="font-medium">
              {formatStudio(session.startsAt, 'EEEE, d MMMM')} at{' '}
              {formatStudioTime(session.startsAt)}
              {' · '}
              {session.durationMinutes} min
            </span>
          </div>

          <div className="flex items-center gap-3">
            <UserIcon className="size-4 shrink-0 text-slate-400" aria-hidden />
            <span>with <span className="font-medium">{session.instructorName}</span></span>
          </div>

          {session.location && (
            <div className="flex items-center gap-3">
              <MapPinIcon className="size-4 shrink-0 text-slate-400" aria-hidden />
              <span>{session.location}</span>
            </div>
          )}
        </div>

        <AlertDialogFooter className="sm:flex-row-reverse sm:justify-start gap-3 mt-6 sm:space-x-0">
          <AlertDialogCancel onClick={onClose} className="mt-0 w-full sm:w-auto">
            Close
          </AlertDialogCancel>
          {onCancel && (
            isBlocked ? (
              <span className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600">
                <BanIcon className="size-3.5" aria-hidden />
                Cancellation closed
              </span>
            ) : (
              <button
                onClick={() => {
                  onCancel(session);
                  onClose();
                }}
                className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95 cursor-pointer"
                aria-label="Cancel booking"
              >
                <XIcon className="size-3.5" aria-hidden />
                Cancel Booking
              </button>
            )
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
