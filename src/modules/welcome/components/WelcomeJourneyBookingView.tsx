'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Clock, Calendar, MapPin, User, Send, Loader2, CheckCircle, XCircle, ArrowRight, ChevronLeft, ChevronRight, Plus, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatStudio, formatStudioTime } from '@/lib/utils/date.utils';
import { fromZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';
import {
  WELCOME_JOURNEY_REQUEST_STATUS,
  WELCOME_JOURNEY_URGENCY_CRITICAL_HOURS,
  WELCOME_JOURNEY_URGENCY_SOON_HOURS,
  STUDIO_TIMEZONE,
} from '@/constants/BOOKING_RULES';
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
import {
  createWelcomeJourneyRequest,
  getMyWelcomeJourneyRequest,
  rejectOfferedSlots,
  bookOfferedWelcomeJourneySlot,
} from '@/modules/welcome/actions/welcomeRequest.actions';
import type { ServiceResult } from '@/modules/billing/services/credit.service';

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestWithSlots = {
  request: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    status: string;
    userMessage: string | null;
    offeredSessionIds: string[] | null;
    expiresAt?: Date | string | null;
  };
  offeredSessions: Array<{
    id: string;
    startsAt: Date;
    endsAt: Date;
    instructorName: string | null;
    className: string;
    location: string | null;
  }>;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ExpiresCountdown({ expiresAt }: { expiresAt?: Date | string | null }) {
  const [label, setLabel] = useState<string>('');
  const [state, setState] = useState<'ok' | 'soon' | 'critical' | 'expired'>('ok');

  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt);

    function update() {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setLabel('Expired');
        setState('expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours >= WELCOME_JOURNEY_URGENCY_SOON_HOURS) {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        setLabel(`Expires in ${days}d ${remHours}h`);
        setState('ok');
      } else {
        setLabel(`Expires in ${hours}h ${minutes}m`);
        setState(hours < WELCOME_JOURNEY_URGENCY_CRITICAL_HOURS ? 'critical' : 'soon');
      }
    }

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt || !label) return null;

  const bgClass =
    state === 'critical'
      ? 'bg-red-50 text-red-700 border-red-200/60'
      : state === 'soon'
      ? 'bg-amber-50 text-amber-800 border-amber-200/60'
      : state === 'expired'
      ? 'bg-gray-50 text-gray-600 border-gray-200'
      : 'bg-[#4a7c4a]/5 text-[#4a7c4a] border-[#4a7c4a]/15';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${bgClass}`}
    >
      <Clock className="size-3" />
      {label}
    </span>
  );
}

function RequestForm({ onSubmitted, waiverSigned }: { onSubmitted: () => void; waiverSigned: boolean }) {
  const [message, setMessage] = useState('');
  const [preferredSlots, setPreferredSlots] = useState<Date[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthName = currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysArray: (Date | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(new Date(year, month, d));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isPast = (d: Date | null) => {
    if (!d) return true;
    const check = new Date(d);
    check.setHours(0, 0, 0, 0);
    return check < today;
  };

  const isSelected = (d: Date | null) => {
    if (!d || !selectedDate) return false;
    return d.getDate() === selectedDate.getDate() && 
           d.getMonth() === selectedDate.getMonth() && 
           d.getFullYear() === selectedDate.getFullYear();
  };

  const hasPreferredSlot = (d: Date | null) => {
    if (!d) return false;
    return preferredSlots.some(
      s => s.getDate() === d.getDate() && 
           s.getMonth() === d.getMonth() && 
           s.getFullYear() === d.getFullYear()
    );
  };

  const handlePrevMonth = () => {
    const prev = new Date(year, month - 1, 1);
    if (prev.getMonth() < today.getMonth() && prev.getFullYear() <= today.getFullYear()) return;
    setCurrentMonth(prev);
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };

  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', 
    '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
  ];

  const handleSelectSlot = (time: string) => {
    if (!selectedDate) return;
    if (preferredSlots.length >= 3) {
      toast.error('You can select up to 3 preferences');
      return;
    }

    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}T${time}:00`;
    const utcDate = fromZonedTime(dateStr, STUDIO_TIMEZONE);

    if (preferredSlots.some(s => s.getTime() === utcDate.getTime())) {
      toast.error('This preferred time is already added');
      return;
    }

    setPreferredSlots([...preferredSlots, utcDate]);
    setSelectedDate(null);
    toast.success('Preference added');
  };

  const handleRemoveSlot = (index: number) => {
    setPreferredSlots(preferredSlots.filter((_, i) => i !== index));
  };

  function handleSubmit() {
    if (preferredSlots.length === 0) {
      toast.error('Please choose at least 1 preferred date and time');
      return;
    }
    startTransition(async () => {
      const result = await createWelcomeJourneyRequest({
        message: message || undefined,
        preferredSlots: preferredSlots.map(d => d.toISOString()),
      });
      if (result.success) {
        toast.success('Request sent!', {
          description: "We'll get back to you with available time slots.",
        });
        onSubmitted();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="rounded-2xl border border-[#d4a574]/30 bg-[#d4a574]/10 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#d4a574]/20 text-[#6b3d32]">
            <Star className="size-5" aria-hidden />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#4e2b22]">Request Your Welcome Journey</h3>
            <p className="mt-1 text-xs leading-relaxed text-[#6b3d32]">
              Your 2-hour private introduction session. Choose <strong>up to 3 preferred days and times</strong> using the calendar, and we will prepare options for you.
            </p>
          </div>
        </div>

        {/* Step 1 Calendar */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#ede8e5] pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4e2b22]">
              1. Choose Days &amp; Times
            </span>
            <span className="text-xs font-semibold text-[#8b6b5c]">
              {preferredSlots.length} of 3 selected
            </span>
          </div>

          <div className="rounded-xl border border-[#ede8e5] bg-white p-4 shadow-[0_2px_8px_rgba(78,43,34,0.02)]">
            {/* Calendar Month Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-[#4e2b22]">{monthName}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  disabled={year === today.getFullYear() && month === today.getMonth()}
                  aria-label="Previous month"
                  className="rounded-lg p-1 text-[#6b3d32] hover:bg-[#faf9f7] disabled:opacity-30"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="Next month"
                  className="rounded-lg p-1 text-[#6b3d32] hover:bg-[#faf9f7]"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayName, idx) => (
                <div key={idx} className="font-semibold text-[#8b6b5c] py-1">
                  {dayName}
                </div>
              ))}

              {daysArray.map((day, idx) => {
                if (!day) return <div key={idx} />;
                const past = isPast(day);
                const selected = isSelected(day);
                const isPreferred = hasPreferredSlot(day);

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (!past && preferredSlots.length < 3) {
                        setSelectedDate(day);
                      }
                    }}
                    disabled={past || preferredSlots.length >= 3}
                    className={`
                      aspect-square w-full rounded-lg flex flex-col items-center justify-center relative font-medium transition-all text-xs
                      ${past ? 'text-gray-300 cursor-not-allowed' : 'text-[#4e2b22] hover:bg-[#faf9f7]'}
                      ${selected ? 'bg-[#4e2b22] text-white hover:bg-[#4e2b22]' : ''}
                      ${isPreferred && !selected ? 'border border-[#d4a574] bg-[#d4a574]/10 font-bold' : ''}
                    `}
                  >
                    <span>{day.getDate()}</span>
                    {isPreferred && (
                      <span className={`absolute bottom-1 size-1 rounded-full ${selected ? 'bg-white' : 'bg-[#d4a574]'}`} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Time Slot Picker for selected date */}
            {selectedDate && preferredSlots.length < 3 && (
              <div className="mt-4 border-t border-[#ede8e5]/80 pt-4 animate-in fade-in duration-200">
                <p className="text-xs font-semibold text-[#6b3d32] mb-3">
                  Select a preferred start time for {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}:
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {timeSlots.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => handleSelectSlot(time)}
                      className="min-h-[44px] rounded-lg border border-[#ede8e5] py-2 text-center text-xs font-medium text-[#4e2b22] hover:bg-[#faf9f7] hover:border-[#c4a88a] active:bg-[#ede8e5]"
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {preferredSlots.length >= 3 && (
              <div className="mt-4 border-t border-[#ede8e5]/80 pt-3 text-center text-xs text-[#8b6b5c] font-medium">
                Maximum 3 preferences selected. Remove a preference below if you want to change them.
              </div>
            )}
          </div>

          {/* Selected Slots List */}
          {preferredSlots.length > 0 && (
            <div className="space-y-2 mt-4">
              <span className="text-[11px] font-bold text-[#8b6b5c] uppercase">Your Preferred Times:</span>
              <div className="space-y-2">
                {preferredSlots.map((slot, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-[#ede8e5] bg-white px-4 py-3 shadow-[0_2px_6px_rgba(78,43,34,0.02)]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-[#d4a574]/20 text-[11px] font-bold text-[#6b3d32]">
                        {idx + 1}
                      </span>
                      <div className="text-xs">
                        <span className="font-bold text-[#4e2b22]">
                          {formatStudio(slot, 'EEEE, d MMMM')}
                        </span>
                        <span className="text-[#8b6b5c] ml-1">
                          at {formatStudioTime(slot)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(idx)}
                      disabled={isPending}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Remove preference"
                      aria-label="Remove preference"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notice down */}
          <div className="flex items-start gap-2 rounded-xl bg-amber-50/50 border border-amber-200/40 p-3 mt-4 text-[11px] leading-relaxed text-[#8b6b5c]">
            <Info className="size-3.5 text-[#d4a574] shrink-0 mt-0.5" />
            <p>
              <strong>Notice:</strong> We do our best to accommodate your preferences, but final slots depend on teacher availability. We will offer you the closest available options.
            </p>
          </div>
        </div>

        {/* Step 2 Additional notes */}
        <div className="mt-6 space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[#4e2b22]">
            2. Additional notes <span className="font-normal text-[#8b6b5c]">(optional)</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Any specific requests, injuries, or instructor preferences..."
            className="w-full rounded-xl border border-[#ede8e5] bg-white/70 px-4 py-3 text-xs text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none focus:ring-1 focus:ring-[#c4a88a]"
            rows={2}
          />
        </div>

        <Button
          variant="boutique"
          className="mt-6 w-full min-h-[44px]"
          onClick={handleSubmit}
          disabled={preferredSlots.length === 0 || isPending || !waiverSigned}
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Sending Request...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Send className="size-4" />
              {preferredSlots.length === 0
                ? 'Choose Preferred Times Above'
                : `Send Request with ${preferredSlots.length} preference${preferredSlots.length > 1 ? 's' : ''}`}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

function PendingState() {
  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="inline-flex items-center justify-center size-16 rounded-full bg-[#d4a574]/15 mb-4">
        <Clock className="size-8 text-[#d4a574]" />
      </div>
      <h3 className="text-lg font-bold text-[#4e2b22]">Request Received</h3>
      <p className="mt-2 text-sm text-[#6b3d32]">
        We're preparing your time slots. You'll receive an email as soon as options are ready.
      </p>
      <div className="mt-6 rounded-xl border border-[#ede8e5]/60 bg-[#faf9f7]/60 p-4">
        <p className="text-xs text-[#8b6b5c]">
          Usually takes less than 24 hours. If you're in a hurry, feel free to call the studio.
        </p>
      </div>
    </div>
  );
}

function SlotsOffered({ data, onRefresh, waiverSigned }: { data: RequestWithSlots; onRefresh: () => void; waiverSigned: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectMessage, setRejectMessage] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [sessionToConfirm, setSessionToConfirm] =
    useState<RequestWithSlots['offeredSessions'][number] | null>(null);

  const expiresAt = data.request.expiresAt;
  const isExpired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;

  function handleBook(sessionId: string) {
    startTransition(async () => {
      const result = await bookOfferedWelcomeJourneySlot({
        requestId: data.request.id,
        sessionId,
      });
      if (result.success) {
        toast.success('Welcome Journey booked!', {
          description: 'See you at your introduction session.',
        });
        router.push('/bookings');
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectOfferedSlots({
        requestId: data.request.id,
        newMessage: rejectMessage || undefined,
      });
      if (result.success) {
        toast.success('Feedback sent', {
          description: "We'll prepare new time slots for you.",
        });
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const optionCount = data.offeredSessions.length;
  const optionWord = optionCount === 1 ? 'option' : 'options';

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center size-16 rounded-full bg-[#4a7c4a]/10 mb-4">
          <Calendar className="size-8 text-[#4a7c4a]" />
        </div>
        <h3 className="text-lg font-bold text-[#4e2b22]">Pick Your Time Slot</h3>
        <p className="mt-1 text-sm text-[#6b3d32]">
          {optionCount === 1
            ? "We've prepared a time slot for your Welcome Journey. If it works for you, go ahead and book it below."
            : `We've prepared ${optionCount} ${optionWord} for your Welcome Journey. Choose one of the times below — whichever works best.`}
        </p>
        {expiresAt && (
          <div className="mt-3 flex justify-center">
            <ExpiresCountdown expiresAt={expiresAt} />
          </div>
        )}
        {isExpired && (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs text-gray-700">
            This offered slot has expired. Please request a new time below.
          </div>
        )}
      </div>

      <div className="space-y-3">
        {data.offeredSessions.map((s: RequestWithSlots['offeredSessions'][number]) => (
          <div
            key={s.id}
            className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#f5f3f1]/80 p-5 shadow-[0_4px_14px_rgba(78,43,34,0.04)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-[#4e2b22]">
                  {formatStudio(s.startsAt, 'EEEE, d MMMM yyyy')}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-[#6b3d32]">
                  <Clock className="size-3.5 shrink-0" />
                  {formatStudioTime(s.startsAt)} – {formatStudioTime(s.endsAt)}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-[#6b3d32]">
                  <User className="size-3.5 shrink-0" />
                  with {s.instructorName ?? 'TBA'}
                </p>
                {s.location && (
                  <p className="flex items-center gap-1.5 text-xs text-[#6b3d32]">
                    <MapPin className="size-3.5 shrink-0" />
                    {s.location}
                  </p>
                )}
              </div>
              <Button
                variant="boutique"
                size="sm"
                onClick={() => setSessionToConfirm(s)}
                disabled={isPending || isExpired || !waiverSigned}
                className="shrink-0 min-h-[44px]"
              >
                {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Book'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {!showRejectForm ? (
        <button
          type="button"
          onClick={() => setShowRejectForm(true)}
          className="mx-auto block rounded-lg px-3 py-2 text-sm text-[#8b6b5c] underline underline-offset-2 hover:text-[#6b3d32]"
        >
          {optionCount === 1 ? "This doesn't work for me" : 'None of these work for me'}
        </button>
      ) : (
        <div className="rounded-xl border border-[#ede8e5]/60 bg-[#faf9f7]/60 p-4 space-y-3">
          <p className="text-xs font-medium text-[#4e2b22]">
            Let us know what would work better:
          </p>
          <textarea
            value={rejectMessage}
            onChange={(e) => setRejectMessage(e.target.value)}
            placeholder="e.g. I need a weekend slot..."
            className="w-full rounded-lg border border-[#ede8e5] bg-white/70 px-3 py-2 text-xs text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none focus:ring-1 focus:ring-[#c4a88a]"
            rows={2}
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowRejectForm(false)}>
              Cancel
            </Button>
            <Button
              variant="boutique"
              size="sm"
              className="flex-1"
              onClick={handleReject}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Send Feedback'}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog
        open={sessionToConfirm !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setSessionToConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm booking?</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-[#6b3d32]">
              Booking this date will secure your Welcome Journey and release all other offered options.
              {sessionToConfirm && (
                <span className="mt-2 block text-xs text-[#8b6b5c]">
                  {formatStudio(sessionToConfirm.startsAt, 'EEEE, d MMMM yyyy')} ·{' '}
                  {formatStudioTime(sessionToConfirm.startsAt)} –{' '}
                  {formatStudioTime(sessionToConfirm.endsAt)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                const s = sessionToConfirm;
                if (!s) return;
                setSessionToConfirm(null);
                handleBook(s.id);
              }}
              disabled={isPending || isExpired || !waiverSigned}
              className="bg-[#4e2b22] hover:bg-[#6b3d32]"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Booking…
                </span>
              ) : (
                'Yes, book'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BookedState() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="inline-flex items-center justify-center size-16 rounded-full bg-[#4a7c4a]/10 mb-4">
        <CheckCircle className="size-8 text-[#4a7c4a]" />
      </div>
      <h3 className="text-lg font-bold text-[#4e2b22]">You're All Set!</h3>
      <p className="mt-2 text-sm text-[#6b3d32]">
        Your Welcome Journey is booked. You can view the details in your bookings.
      </p>
      <Button
        variant="boutique"
        className="mt-6"
        onClick={() => router.push('/bookings')}
      >
        View My Booking <ArrowRight className="ml-2 size-4" />
      </Button>
    </div>
  );
}

function ExpiredState({ onRequestAgain }: { onRequestAgain: () => void }) {
  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="inline-flex items-center justify-center size-16 rounded-full bg-gray-100 mb-4">
        <XCircle className="size-8 text-gray-500" />
      </div>
      <h3 className="text-lg font-bold text-[#4e2b22]">Your offered slots expired</h3>
      <p className="mt-2 text-sm text-[#6b3d32]">
        The held slots were released. Request new options and we’ll send fresh times.
      </p>
      <div className="mt-6">
        <Button variant="boutique" onClick={onRequestAgain}>
          Request new slots
        </Button>
      </div>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function WelcomeJourneyBookingView({
  hasSignedWaiver,
}: {
  hasSignedWaiver?: boolean;
}) {
  const waiverSigned = hasSignedWaiver ?? true;
  const [data, setData] = useState<RequestWithSlots | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);

  async function load() {
    setLoading(true);
    const result = await getMyWelcomeJourneyRequest();
    if (result.success) {
      setData(result.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <p className="text-sm font-medium text-[#6b3d32]">Book a Class</p>
        <h1 className="mt-1 text-3xl font-bold text-[#4e2b22]">Welcome Journey</h1>
        <p className="mt-2 text-sm text-[#6b3d32] max-w-md mx-auto">
          Start with your 2-hour private introduction session. Once you attend,
          all other classes and packages will unlock.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-[#c4a88a]" />
        </div>
      ) : !data ? (
        <RequestForm onSubmitted={load} waiverSigned={waiverSigned} />
      ) : data.request.status === WELCOME_JOURNEY_REQUEST_STATUS.pending ? (
        <PendingState />
      ) : data.request.status === WELCOME_JOURNEY_REQUEST_STATUS.slotsOffered ? (
        <SlotsOffered data={data} onRefresh={load} waiverSigned={waiverSigned} />
      ) : data.request.status === WELCOME_JOURNEY_REQUEST_STATUS.booked ||
        data.request.status === WELCOME_JOURNEY_REQUEST_STATUS.attended ? (
        <BookedState />
      ) : data.request.status === WELCOME_JOURNEY_REQUEST_STATUS.expired ? (
        showRequestForm ? (
          <RequestForm
            onSubmitted={() => {
              setShowRequestForm(false);
              load();
            }}
            waiverSigned={waiverSigned}
          />
        ) : (
          <ExpiredState onRequestAgain={() => setShowRequestForm(true)} />
        )
      ) : (
        <RequestForm onSubmitted={load} waiverSigned={waiverSigned} />
      )}
    </div>
  );
}
