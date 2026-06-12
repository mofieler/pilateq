'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import {
  Loader2Icon,
  Trash2Icon,
  CalendarClockIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  LightbulbIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatStudio } from '@/lib/utils/date.utils';
import { fromZonedTime } from 'date-fns-tz';
import { STUDIO_TIMEZONE } from '@/constants/BOOKING_RULES';
import {
  checkSlotAvailabilityAction,
  cancelClassSessionAction,
  deleteClassSessionAction,
  type ConflictItem,
} from '@/modules/classes/actions/class.actions';
import {
  getSessionStudentsAction,
  removeStudentFromSessionAction,
  markBookingAttendedAction,
  type SessionStudent,
} from '@/modules/classes/actions/class.actions';
import { rescheduleClassSessionAction } from '@/modules/classes/actions/classSession.actions';
import { UserAvatar } from '@/modules/users/components/UserAvatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  sessionId: string;
  sessionTitle: string;
  startsAt: Date;
  endsAt: Date;
  instructorName: string;
  instructorId: string | null;
  durationMinutes: number;
  bookedCount: number;
  maxCapacity: number;
  status: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
};

type DialogMode = 'remove' | 'cancel' | 'delete' | null;

export function SessionDetailModal({
  sessionId,
  sessionTitle,
  startsAt,
  endsAt,
  instructorName,
  instructorId,
  durationMinutes,
  bookedCount,
  maxCapacity,
  status,
  open,
  onOpenChange,
  canEdit = true,
}: Props) {
  const [students, setStudents] = useState<SessionStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Remove student dialog
  const [removeDialog, setRemoveDialog] = useState<DialogMode>(null);
  const [selectedStudent, setSelectedStudent] = useState<SessionStudent | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [removeError, setRemoveError] = useState('');
  const [attendingId, setAttendingId] = useState<string | null>(null);
  const [studentToMarkAttended, setStudentToMarkAttended] = useState<SessionStudent | null>(null);

  // Cancel / delete session
  const [actionDialog, setActionDialog] = useState<DialogMode>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reschedule form
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(formatStudio(startsAt, 'yyyy-MM-dd'));
  const [rescheduleTime, setRescheduleTime] = useState(formatStudio(startsAt, 'HH:mm'));
  const [rescheduleError, setRescheduleError] = useState('');

  // Conflict check state
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const conflictCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset reschedule form whenever the modal opens (possibly for a different session)
  useEffect(() => {
    if (open) {
      setRescheduleOpen(false);
      setRescheduleDate(formatStudio(startsAt, 'yyyy-MM-dd'));
      setRescheduleTime(formatStudio(startsAt, 'HH:mm'));
      setRescheduleError('');
      setConflicts([]);
      setSuggestions([]);
    }
  }, [open, startsAt]);

  // Debounced availability check
  useEffect(() => {
    if (!open || !rescheduleOpen || !rescheduleDate || !rescheduleTime) {
      setConflicts([]);
      setSuggestions([]);
      return;
    }

    if (conflictCheckTimeout.current) clearTimeout(conflictCheckTimeout.current);
    conflictCheckTimeout.current = setTimeout(async () => {
      setCheckingConflicts(true);
      try {
        const startsAtISO = fromZonedTime(`${rescheduleDate}T${rescheduleTime}:00`, STUDIO_TIMEZONE).toISOString();
        const result = await checkSlotAvailabilityAction({
          instructorId: instructorId || undefined,
          startsAtISO,
          durationMinutes,
          tzOffsetMinutes: new Date().getTimezoneOffset(),
          excludeSessionId: sessionId,
        });
        if (result.success) {
          setConflicts(result.data.conflicts);
          setSuggestions(result.data.suggestions);
        }
      } catch (err) {
        console.error('Failed to check slot availability:', err);
      } finally {
        setCheckingConflicts(false);
      }
    }, 400);

    return () => {
      if (conflictCheckTimeout.current) clearTimeout(conflictCheckTimeout.current);
    };
  }, [open, rescheduleOpen, rescheduleDate, rescheduleTime, instructorId, durationMinutes, sessionId]);

  // Load students when modal opens
  useEffect(() => {
    if (!open) return;

    setLoading(true);
    (async () => {
      const result = await getSessionStudentsAction(sessionId);
      if (result.success) {
        setStudents(result.data);
      } else {
        toast.error('Failed to load students');
      }
      setLoading(false);
    })();
  }, [open, sessionId]);

  function openRemoveDialog(student: SessionStudent) {
    setSelectedStudent(student);
    setRemoveReason('');
    setRemoveError('');
    setRemoveDialog('remove');
  }

  function handleReschedule() {
    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleError('Please enter a valid date and time.');
      return;
    }
    setRescheduleError('');
    const startsAtISO = fromZonedTime(`${rescheduleDate}T${rescheduleTime}:00`, STUDIO_TIMEZONE).toISOString();

    startTransition(async () => {
      const result = await rescheduleClassSessionAction({ id: sessionId, startsAtISO });
      if (result.success) {
        const studentNote = bookedCount > 0
          ? ` ${bookedCount} student${bookedCount !== 1 ? 's' : ''} notified by email.`
          : '';
        toast.success(`Class rescheduled successfully.${studentNote}`);
        setRescheduleOpen(false);
        onOpenChange(false);
      } else {
        setRescheduleError(result.error ?? 'Failed to reschedule.');
      }
    });
  }

  function handleRemoveStudent() {
    if (!selectedStudent) return;

    setRemoveError('');
    const reason = removeReason.trim();
    if (!reason || reason.length < 3) {
      setRemoveError('Please provide a reason (at least 3 characters)');
      return;
    }

    startTransition(async () => {
      const result = await removeStudentFromSessionAction({
        bookingId: selectedStudent.bookingId,
        reason,
      });

      if (result.success) {
        toast.success(`${selectedStudent.name ?? 'Student'} has been removed and notified via email.`);
        setRemoveDialog(null);
        setStudents(students.filter((s) => s.bookingId !== selectedStudent.bookingId));
      } else {
        setRemoveError(result.error ?? 'Failed to remove student');
      }
    });
  }

  async function confirmMarkAttended() {
    const student = studentToMarkAttended;
    if (!student) return;
    setAttendingId(student.bookingId);
    const result = await markBookingAttendedAction({ bookingId: student.bookingId });
    setAttendingId(null);
    setStudentToMarkAttended(null);

    if (result.success) {
      toast.success(`${student.name ?? 'Student'} marked as attended.`);
      setStudents((prev) =>
        prev.map((s) => (s.bookingId === student.bookingId ? { ...s, bookingStatus: 'attended' } : s)),
      );
    } else {
      toast.error(result.error ?? 'Failed to mark as attended.');
    }
  }

  const classHasEnded = endsAt.getTime() <= Date.now();

  const canCancel = canEdit && (status === 'scheduled' || status === 'in_progress');
  const canDelete = canEdit && (status === 'cancelled' || status === 'scheduled');

  function handleCancelSession() {
    setActionError(null);
    startTransition(async () => {
      const result = await cancelClassSessionAction({
        sessionId,
        reason: 'Cancelled by administrator',
      });
      if (result.success) {
        toast.success('Session cancelled. Booked students have been refunded.');
        setActionDialog(null);
        onOpenChange(false);
      } else {
        setActionError(result.error ?? 'Failed to cancel session.');
      }
    });
  }

  function handleDeleteSession() {
    setActionError(null);
    startTransition(async () => {
      const result = await deleteClassSessionAction({ id: sessionId });
      if (result.success) {
        toast.success(bookedCount > 0
          ? 'Session deleted and students refunded.'
          : 'Session deleted.'
        );
        setActionDialog(null);
        onOpenChange(false);
      } else {
        setActionError(result.error ?? 'Failed to delete session.');
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>{sessionTitle}</DialogTitle>
            <DialogDescription>
              {formatStudio(startsAt, 'EEEE, d MMMM yyyy')} · {formatStudio(startsAt, 'HH:mm')} – {formatStudio(endsAt, 'HH:mm')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Session info */}
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div>
                <div className="text-slate-600 font-medium">Instructor</div>
                <div className="text-slate-900">{instructorName}</div>
              </div>
              <div>
                <div className="text-slate-600 font-medium">Capacity</div>
                <div className="text-slate-900">
                  {bookedCount} / {maxCapacity} booked
                </div>
              </div>
            </div>

            {/* Reschedule section */}
            {canEdit && status !== 'cancelled' && (
              <div className="rounded-lg border border-[#ede8e5]">
                <button
                  type="button"
                  onClick={() => setRescheduleOpen((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[#4e2b22] hover:bg-[#faf9f7] rounded-lg transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <CalendarClockIcon className="size-4" />
                    Reschedule class
                  </span>
                  <ChevronDownIcon className={['size-4 text-[#8b6b5c] transition-transform', rescheduleOpen ? 'rotate-180' : ''].join(' ')} />
                </button>

                {rescheduleOpen && (
                  <div className="border-t border-[#ede8e5] px-4 pb-4 pt-3 space-y-3">
                    {bookedCount > 0 && (
                      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                        <strong>{bookedCount} student{bookedCount !== 1 ? 's' : ''}</strong> will receive an email with the new time and a free 24-hour cancellation window.
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="reschedule-date" className="text-xs">New date</Label>
                        <Input
                          id="reschedule-date"
                          type="date"
                          value={rescheduleDate}
                          onChange={(e) => setRescheduleDate(e.target.value)}
                          disabled={isPending}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="reschedule-time" className="text-xs">New time</Label>
                        <Input
                          id="reschedule-time"
                          type="time"
                          value={rescheduleTime}
                          onChange={(e) => setRescheduleTime(e.target.value)}
                          disabled={isPending}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    {/* Conflict feedback */}
                    {rescheduleDate && rescheduleTime && (
                      <div className="py-1">
                        {checkingConflicts ? (
                          <div className="flex items-center gap-2 text-xs text-[#8b6b5c]">
                            <Loader2Icon className="size-3.5 animate-spin" />
                            Checking availability…
                          </div>
                        ) : conflicts.length > 0 ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
                            {conflicts.some((c) => c.type === 'studio_session') ? (
                              <div className="flex items-center gap-2 text-xs font-semibold text-red-700">
                                <AlertTriangleIcon className="size-3.5 shrink-0" />
                                Studio is busy at this time
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                                <AlertTriangleIcon className="size-3.5 shrink-0" />
                                Instructor has a conflict at this time
                              </div>
                            )}
                            <ul className="space-y-1">
                              {conflicts.map((c, i) => (
                                <li key={i} className={c.type === 'studio_session' ? 'text-[11px] text-red-600 font-medium' : 'text-[11px] text-amber-700'}>
                                  {c.type === 'gcal_block' ? '📅' : c.type === 'studio_session' ? '🏢' : '🏃'}{' '}
                                  {c.summary} · {formatStudio(c.startsAt, 'HH:mm')}–{formatStudio(c.endsAt, 'HH:mm')}
                                </li>
                              ))}
                            </ul>
                            {suggestions.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 mb-1">
                                  <LightbulbIcon className="size-3" />
                                  Free slots on this day:
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                  {suggestions.map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() => setRescheduleTime(s)}
                                      className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-200 transition-colors"
                                    >
                                      {s}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : instructorId ? (
                          <div className="flex items-center gap-2 text-xs text-[#4a7c4a]">
                            <CheckCircleIcon className="size-3.5 text-[#4a7c4a]" />
                            Instructor is free at this time
                          </div>
                        ) : null}
                      </div>
                    )}

                    {rescheduleError && (
                      <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                        {rescheduleError}
                      </div>
                    )}
                    <Button
                      type="button"
                      onClick={handleReschedule}
                      disabled={isPending}
                      className="w-full bg-[#4e2b22] hover:bg-[#6b3d32] text-white text-sm"
                    >
                      {isPending ? (
                        <span className="flex items-center gap-2">
                          <Loader2Icon className="size-4 animate-spin" />
                          Rescheduling…
                        </span>
                      ) : (
                        'Confirm reschedule & notify students'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Students list */}
            <div className="space-y-3">
              <h3 className="font-semibold text-[#4e2b22]">Booked Students ({students.length})</h3>

              {loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2Icon className="size-4 animate-spin" />
                  Loading students…
                </div>
              ) : students.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
                  No students booked for this session.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {students.map((student) => (
                    <div
                      key={student.bookingId}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <UserAvatar
                        name={student.name ?? 'User'}
                        avatarUrl={student.avatarUrl}
                        size="sm"
                        className="mr-3"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">{student.name}</div>
                        <div className="text-xs text-slate-600 truncate">{student.email}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {student.creditsSpent} {student.creditType} credits · Booked{' '}
                          {format(student.bookedAt, 'dd MMM')}
                          {student.bookingStatus === 'attended' && (
                            <span className="ml-2 font-medium text-green-700">· Attended</span>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="ml-3 flex items-center gap-1">
                          {student.bookingStatus !== 'attended' && (
                            <button
                              type="button"
                              onClick={() => setStudentToMarkAttended(student)}
                              disabled={attendingId === student.bookingId || !classHasEnded}
                              className="p-2 hover:bg-green-50 rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none"
                              title={
                                !classHasEnded
                                  ? 'Mark attendance after the class ends'
                                  : 'Mark as attended'
                              }
                            >
                              {attendingId === student.bookingId ? (
                                <Loader2Icon className="size-4 animate-spin text-green-600" />
                              ) : (
                                <CheckCircleIcon className="size-4 text-green-600" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openRemoveDialog(student)}
                            disabled={isPending || student.bookingStatus === 'attended'}
                            className="p-2 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
                            title={
                              student.bookingStatus === 'attended'
                                ? 'Remove is disabled for attended bookings'
                                : 'Remove from class'
                            }
                          >
                            <Trash2Icon className="size-4 text-red-600" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            {(canCancel || canDelete) && (
              <div className="flex items-center gap-2 mr-auto">
                {canCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    onClick={() => { setActionError(null); setActionDialog('cancel'); }}
                    disabled={isPending}
                  >
                    Cancel session
                  </Button>
                )}
                {canDelete && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    onClick={() => { setActionError(null); setActionDialog('delete'); }}
                    disabled={isPending}
                  >
                    Delete session
                  </Button>
                )}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel session confirmation */}
      <AlertDialog open={actionDialog === 'cancel'} onOpenChange={(v) => { if (!isPending && !v) setActionDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
            <AlertDialogDescription>
              All booked students will receive a full credit refund automatically. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep session</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleCancelSession} disabled={isPending}>
              {isPending ? 'Cancelling…' : 'Yes, cancel session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete session confirmation */}
      <AlertDialog open={actionDialog === 'delete'} onOpenChange={(v) => { if (!isPending && !v) setActionDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              {bookedCount > 0
                ? `This session has ${bookedCount} booked student${bookedCount !== 1 ? 's' : ''}. They will be automatically cancelled and receive a full credit refund (including session credits). This cannot be undone.`
                : 'The session record will be permanently removed. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep session</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteSession} disabled={isPending}>
              {isPending
                ? (bookedCount > 0 ? 'Cancelling & deleting…' : 'Deleting…')
                : (bookedCount > 0 ? `Refund ${bookedCount} student${bookedCount !== 1 ? 's' : ''} & delete` : 'Delete session')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove student confirmation */}
      <AlertDialog open={removeDialog === 'remove'} onOpenChange={(v) => {
        if (!isPending && !v) setRemoveDialog(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedStudent?.name ?? 'student'} from class?</AlertDialogTitle>
            <AlertDialogDescription>
              They will receive an email notification and {selectedStudent?.creditsSpent} {selectedStudent?.creditType} credit(s) will be refunded.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="reason" className="text-sm font-medium">
                Reason for removal *
              </Label>
              <Input
                id="reason"
                placeholder="e.g., Requested cancellation, Medical reasons, etc."
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                disabled={isPending}
                className="text-sm"
              />
              <p className="text-xs text-slate-600">This will be included in the email notification to the student.</p>
            </div>
            {removeError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {removeError}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveStudent}
              disabled={isPending || !removeReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin" />
                  Removing…
                </span>
              ) : (
                'Remove & Notify'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={studentToMarkAttended !== null}
        onOpenChange={(v) => {
          if (!v && !attendingId) setStudentToMarkAttended(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark attendance?</AlertDialogTitle>
            <AlertDialogDescription>
              Mark {studentToMarkAttended?.name ?? 'this student'} as attended for this class? This updates
              their booking record and may complete their Welcome Journey if this was their intro session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={attendingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-700 hover:bg-green-800"
              disabled={attendingId !== null}
              onClick={(e) => {
                e.preventDefault();
                void confirmMarkAttended();
              }}
            >
              {attendingId ? (
                <span className="flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin" />
                  Saving…
                </span>
              ) : (
                'Yes, mark as attended'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
