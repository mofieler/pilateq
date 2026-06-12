'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { Star, Clock, CheckCircle, Loader2, Send, User, X, CalendarDays, LayoutTemplate, Sparkles, UserCheck, Plus, AlertCircle } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatStudio, formatStudioTime } from '@/lib/utils/date.utils';
import { toast } from 'sonner';
import {
  WELCOME_JOURNEY_REQUEST_STATUS,
  WELCOME_JOURNEY_URGENCY_CRITICAL_HOURS,
  WELCOME_JOURNEY_URGENCY_SOON_HOURS,
} from '@/constants/BOOKING_RULES';
import {
  getPendingWelcomeJourneyRequests,
  getWelcomeJourneyRequestsForAttendance,
  getUpcomingWelcomeJourneySessions,
  offerWelcomeJourneySlots,
  getWelcomeJourneyRecommendations,
  createAndOfferWelcomeJourneySlot,
  withdrawWelcomeJourneyOffer,
} from '@/modules/welcome/actions/welcomeRequest.actions';
import { markBookingAttendedAction } from '@/modules/classes/actions/sessionStudents.actions';
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

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingRequest = {
  request: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    status: string;
    userMessage: string | null;
    offeredSessionIds: string[] | null;
    preferredSlots: string[] | null;
    expiresAt?: Date | string | null;
    warningEmailSentAt?: Date | string | null;
  };
  userName: string | null;
  userEmail: string | null;
};

type AttendanceItem = {
  requestId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  sessionId: string;
  startsAt: Date;
  endsAt: Date;
  className: string;
  bookingId: string;
};

type WjSession = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  instructorName: string | null;
  className: string;
  bookedCount: number;
  maxCapacity: number;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

import { OfferSlotsModal } from './OfferSlotsModal';

function ExpiryBadge({ expiresAt }: { expiresAt?: Date | string | null }) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [urgency, setUrgency] = useState<'normal' | 'soon' | 'critical' | 'expired'>('normal');

  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt);

    function update() {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired');
        setUrgency('expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours >= WELCOME_JOURNEY_URGENCY_SOON_HOURS) {
        setUrgency('normal');
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        setTimeLeft(`Expires in ${days}d ${remHours}h`);
      } else {
        setTimeLeft(`Expires in ${hours}h ${minutes}m`);
        if (hours < WELCOME_JOURNEY_URGENCY_CRITICAL_HOURS) {
          setUrgency('critical');
        } else {
          setUrgency('soon');
        }
      }
    }

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return null;

  const bgClass =
    urgency === 'critical'
      ? 'bg-red-50 text-red-700 border-red-200/50'
      : urgency === 'soon'
      ? 'bg-amber-50 text-amber-700 border-amber-200/50'
      : urgency === 'expired'
      ? 'bg-gray-50 text-gray-500 border-gray-200'
      : 'bg-[#4a7c4a]/5 text-[#4a7c4a] border-[#4a7c4a]/10';

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium transition-colors duration-200", bgClass)}>
      <Clock className="size-2.5" />
      {timeLeft}
    </span>
  );
}

// ─── Main dashboard card ──────────────────────────────────────────────────────

export function AdminWelcomeJourneyTasks({
  initialPendingRequests = [],
  initialAttendanceItems = [],
}: {
  initialPendingRequests?: PendingRequest[];
  initialAttendanceItems?: AttendanceItem[];
}) {
  const hasInitialActions =
    initialPendingRequests.some((r) => r.request.status === WELCOME_JOURNEY_REQUEST_STATUS.pending) ||
    initialAttendanceItems.length > 0;

  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>(initialPendingRequests);
  const [attendanceItems, setAttendanceItems] = useState<AttendanceItem[]>(initialAttendanceItems);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(hasInitialActions);
  const [offerModalRequest, setOfferModalRequest] = useState<PendingRequest | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [attendanceToConfirm, setAttendanceToConfirm] = useState<AttendanceItem | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState<string | null>(null);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [pendingRes, attendanceRes] = await Promise.all([
      getPendingWelcomeJourneyRequests(),
      getWelcomeJourneyRequestsForAttendance(),
    ]);
    if (pendingRes.success) setPendingRequests(pendingRes.data ?? []);
    if (attendanceRes.success) setAttendanceItems(attendanceRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (initialPendingRequests.length === 0 && initialAttendanceItems.length === 0) {
      void load();
    }
  }, []);

  function handleToggle() {
    if (!expanded) {
      void load();
    }
    setExpanded((v) => !v);
  }

  async function confirmMarkAttended() {
    if (!attendanceToConfirm) return;
    const bookingId = attendanceToConfirm.bookingId;
    setMarkingId(bookingId);
    try {
      const result = await markBookingAttendedAction({ bookingId });
      if (result.success) {
        toast.success('Marked as attended – student is now unlocked!');
        void load();
      } else {
        toast.error(result.error);
      }
    } finally {
      setMarkingId(null);
      setAttendanceToConfirm(null);
    }
  }

  async function handleWithdraw(requestId: string) {
    setIsWithdrawing(requestId);
    try {
      const result = await withdrawWelcomeJourneyOffer({ requestId });
      if (result.success) {
        toast.success('Offered slots withdrawn successfully.');
        void load();
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error('Failed to withdraw offered slots.');
    } finally {
      setIsWithdrawing(null);
    }
  }

  const pendingNeedAction = pendingRequests.filter(
    (r) => r.request.status === WELCOME_JOURNEY_REQUEST_STATUS.pending
  ).length;
  const awaitingStudent = pendingRequests.filter(
    (r) => r.request.status === WELCOME_JOURNEY_REQUEST_STATUS.slotsOffered
  ).length;
  const attendanceCount = attendanceItems.length;
  const needsAttention = pendingNeedAction > 0 || attendanceCount > 0;

  return (
    <div
      className={cn(
        'rounded-lg border bg-gradient-to-br p-6 transition-colors duration-300',
        needsAttention
          ? 'border-[#d4a574]/50 from-[#faf9f7]/90 to-[#fdf8f3]/60'
          : 'border-[#ede8e5]/80 from-[#faf9f7]/80 to-[#ede8e5]/40',
      )}
    >
      <button type="button" onClick={handleToggle} aria-expanded={expanded} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-xl',
              needsAttention
                ? 'bg-[#d4a574]/20 text-[#8b5c2a]'
                : 'bg-[#8b5a3c]/10 text-[#4e2b22]',
            )}
          >
            <Star className="size-4" aria-hidden />
          </span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[#4e2b22]">Welcome Journey Requests</h2>
              {needsAttention && !expanded && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#d4a574]/15 border border-[#d4a574]/30 px-2 py-0.5 text-[10px] font-bold text-[#8b5c2a] animate-pulse">
                  <AlertCircle className="size-3" aria-hidden />
                  Action needed
                </span>
              )}
            </div>
            <p className="text-sm text-[#8b6b5c]">
              {pendingNeedAction > 0 ? (
                <span className="font-semibold text-[#8b5c2a]">{pendingNeedAction} pending</span>
              ) : (
                <span>{pendingNeedAction} pending</span>
              )}
              {' · '}
              {awaitingStudent} awaiting student · {attendanceCount} attendance
            </p>
          </div>
        </div>
        <span className="text-sm text-[#8b6b5c]">{expanded ? 'Collapse' : 'Expand'}</span>
      </button>

      {expanded && (
        <div className="mt-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-[#c4a88a]" />
            </div>
          ) : (
            <>
              {pendingRequests.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b3d32]">
                    Pending Requests
                  </h3>
                  <ul className="space-y-2">
                    {pendingRequests.map((item) => (
                      <li
                        key={item.request.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#ede8e5]/60 bg-white/60 px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <User className="size-4 shrink-0 text-[#6b3d32]" aria-hidden />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#4e2b22]">
                              {item.userName ?? 'Unknown student'}
                            </p>
                            <p className="text-[10px] text-[#8b6b5c]">{item.userEmail}</p>
                            {item.request.userMessage && (
                              <p className="mt-0.5 truncate text-[10px] italic text-[#a6856f]">
                                "{item.request.userMessage}"
                              </p>
                            )}
                            {item.request.preferredSlots && item.request.preferredSlots.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {item.request.preferredSlots.map((slotStr, idx) => {
                                  const slotDate = new Date(slotStr);
                                  return (
                                    <span key={idx} className="inline-flex items-center gap-1 rounded bg-[#d4a574]/10 border border-[#d4a574]/20 px-1.5 py-0.5 text-[9px] font-semibold text-[#4e2b22]">
                                      Option {idx + 1}: {formatStudio(slotDate, 'EEE d MMM')} at {formatStudioTime(slotDate)}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {item.request.status === WELCOME_JOURNEY_REQUEST_STATUS.pending ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-10 border-[#c4a88a] px-4 text-sm text-[#6b3d32] hover:bg-[#ede8e5]"
                              onClick={() => setOfferModalRequest(item)}
                            >
                              Offer Slots
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#4a7c4a]/10 px-2 py-0.5 text-[9px] font-medium text-[#4a7c4a]">
                                <Clock className="size-2.5" aria-hidden />
                                Awaiting student
                              </span>
                              {item.request.expiresAt && (
                                <ExpiryBadge expiresAt={item.request.expiresAt} />
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-10 border-red-200 px-4 text-sm text-red-700 hover:bg-red-50 hover:text-red-800"
                                onClick={() => setWithdrawId(item.request.id)}
                                disabled={isWithdrawing === item.request.id}
                              >
                                {isWithdrawing === item.request.id ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  'Withdraw Offer'
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {attendanceItems.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b3d32]">
                    Attendance Check Needed
                  </h3>
                  <ul className="space-y-2">
                    {attendanceItems.map((item) => {
                      const classEnded = new Date(item.endsAt).getTime() <= Date.now();
                      return (
                      <li
                        key={item.bookingId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#c4a88a]/40 bg-white/60 px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <CheckCircle className="size-4 shrink-0 text-[#4a7c4a]" aria-hidden />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#4e2b22]">
                              {item.userName ?? 'Unknown'}
                            </p>
                            <p className="text-[10px] text-[#8b6b5c]">
                              {item.className} · {formatStudio(item.startsAt, 'd MMM')} ·{' '}
                              {formatStudioTime(item.startsAt)} – {formatStudioTime(item.endsAt)}
                            </p>
                            {!classEnded && (
                              <p className="mt-0.5 text-[10px] text-[#a6856f]">
                                Mark attendance after the session ends.
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="boutique"
                          className="h-8 text-xs"
                          disabled={markingId === item.bookingId || !classEnded}
                          title={
                            !classEnded
                              ? 'Available after the scheduled end time'
                              : 'Confirm attendance'
                          }
                          onClick={() => setAttendanceToConfirm(item)}
                        >
                          {markingId === item.bookingId ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            'Mark Attended'
                          )}
                        </Button>
                      </li>
                    );
                    })}
                  </ul>
                </div>
              )}

              {pendingRequests.length === 0 && attendanceItems.length === 0 && (
                <p className="py-4 text-center text-sm text-[#8b6b5c]">
                  No open Welcome Journey requests or attendance checks.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {offerModalRequest && (
        <OfferSlotsModal
          request={offerModalRequest}
          onClose={() => setOfferModalRequest(null)}
          onOffered={() => {
            setOfferModalRequest(null);
            void load();
          }}
        />
      )}

      <AlertDialog
        open={attendanceToConfirm !== null}
        onOpenChange={(open) => {
          if (!open && !markingId) setAttendanceToConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark attendance?</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-[#6b3d32]">
                <span className="block">
                  Mark{' '}
                  <span className="font-semibold text-[#4e2b22]">
                    {attendanceToConfirm?.userName ?? 'this student'}
                  </span>{' '}
                  as attended for their Welcome Journey? This unlocks their account for regular bookings and
                  cannot be undone from here.
                </span>
                {attendanceToConfirm && (
                  <span className="mt-2 block text-xs text-[#8b6b5c]">
                    Session: {attendanceToConfirm.className} ·{' '}
                    {formatStudio(attendanceToConfirm.startsAt, 'EEE d MMM')} ·{' '}
                    {formatStudioTime(attendanceToConfirm.startsAt)} –{' '}
                    {formatStudioTime(attendanceToConfirm.endsAt)}
                  </span>
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmMarkAttended();
              }}
              disabled={markingId !== null}
              className="bg-[#4e2b22] hover:bg-[#6b3d32]"
            >
              {markingId ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </span>
              ) : (
                'Yes, mark as attended'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={withdrawId !== null}
        onOpenChange={(open) => {
          if (!open && !isWithdrawing) setWithdrawId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw offered slots?</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-[#6b3d32]">
              Withdrawing will release the held Welcome Journey slots from the schedule and remove the
              instructor holds. The student will need a new offer to book.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWithdrawing !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                const id = withdrawId;
                if (!id) return;
                setWithdrawId(null);
                void handleWithdraw(id);
              }}
              disabled={isWithdrawing !== null}
              className="bg-[#4e2b22] hover:bg-[#6b3d32]"
            >
              {isWithdrawing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Withdrawing…
                </span>
              ) : (
                'Yes, withdraw'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
