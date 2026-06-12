'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { format, addMinutes } from 'date-fns';
import {
  PlusIcon, Loader2Icon, ClockIcon, UsersIcon, CreditCardIcon,
  AlertTriangleIcon, CheckCircleIcon, LightbulbIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatStudio } from '@/lib/utils/date.utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createClassSessionAction,
  checkSlotAvailabilityAction,
} from '@/modules/classes/actions/class.actions';
import type {
  TemplateOption,
  InstructorOption,
  ConflictItem,
} from '@/modules/classes/actions/class.actions';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  templates: TemplateOption[];
  instructors: InstructorOption[];
  // External control (optional)
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Pre-fill values (optional)
  initialDate?: string;
  initialTime?: string;
  // Whether to render the built-in trigger button
  showTrigger?: boolean;
  // When set, locks the instructor to this ID (instructor role)
  lockedInstructorId?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CLASS_TYPE_LABEL: Record<string, string> = {
  reformer_group:   'Reformer Group',
  reformer_private: 'Reformer Private',
  reformer_duo:     'Reformer Duo',
  mat_group:        'Mat Group',
  mat_private:      'Mat Private',
  mat_duo:          'Mat Duo',
  online:           'Online',
  sound_healing:    'Sound Healing',
  yoga:             'Yoga',
};

function todayString() {
  return format(new Date(), 'yyyy-MM-dd');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateSessionDialog({
  templates,
  instructors,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  initialDate,
  initialTime,
  showTrigger = true,
  lockedInstructorId,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [templateId, setTemplateId] = useState('');
  const [date, setDate] = useState(initialDate ?? todayString());
  const [time, setTime] = useState(initialTime ?? '09:00');
  const [instructorId, setInstructorId] = useState(lockedInstructorId ?? '');

  // Conflict check state
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const conflictCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const resolvedInstructorId = instructorId || selectedTemplate?.instructorId || null;

  function resetForm() {
    setTemplateId('');
    setDate(initialDate ?? todayString());
    setTime(initialTime ?? '09:00');
    setInstructorId(lockedInstructorId ?? '');
    setError(null);
    setConflicts([]);
    setSuggestions([]);
  }

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    if (!next) resetForm();
    if (isControlled) {
      externalOnOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  }

  // Update date/time when initialDate/initialTime props change (e.g. when user
  // clicks a different day in the week view and opens the dialog again)
  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    if (initialTime) setTime(initialTime);
  }, [initialTime]);

  // ── Conflict check ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    if (!templateId || !date || !time) {
      setConflicts([]);
      setSuggestions([]);
      return;
    }

    if (conflictCheckTimeout.current) clearTimeout(conflictCheckTimeout.current);
    conflictCheckTimeout.current = setTimeout(async () => {
      const duration = selectedTemplate?.durationMinutes;
      if (!duration) return;
      setCheckingConflicts(true);
      try {
        // Convert local date+time to UTC ISO string — browser applies local tz offset
        const startsAtISO = new Date(`${date}T${time}:00`).toISOString();
        const result = await checkSlotAvailabilityAction({
          instructorId: resolvedInstructorId ?? undefined,
          startsAtISO,
          durationMinutes: duration,
          tzOffsetMinutes: new Date().getTimezoneOffset(),
        });
        if (result.success) {
          setConflicts(result.data.conflicts);
          setSuggestions(result.data.suggestions);
        }
      } finally {
        setCheckingConflicts(false);
      }
    }, 400);

    return () => {
      if (conflictCheckTimeout.current) clearTimeout(conflictCheckTimeout.current);
    };
  }, [templateId, date, time, instructorId, open, selectedTemplate?.durationMinutes, resolvedInstructorId]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!templateId) { setError('Please select a class template.'); return; }
    if (!date) { setError('Please pick a date.'); return; }
    if (!time) { setError('Please pick a time.'); return; }
    if (!instructorId) { setError('Please select an instructor.'); return; }

    startTransition(async () => {
      // Convert local date+time to UTC ISO string — browser applies local tz offset
      const startsAtISO = new Date(`${date}T${time}:00`).toISOString();
      const result = await createClassSessionAction({
        templateId,
        startsAtISO,
        instructorId: instructorId || null,
      });

      if (result.success) {
        handleOpenChange(false);
        toast.success('Session scheduled!', {
          description: `${selectedTemplate?.name ?? 'Class'} on ${format(new Date(`${date}T${time}:00`), 'EEEE, d MMMM')} at ${time}.`,
        });
      } else {
        setError(result.error ?? 'Something went wrong.');
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const endsAtLabel = selectedTemplate
    ? format(addMinutes(new Date(`${date}T${time}:00`), selectedTemplate.durationMinutes), 'HH:mm')
    : null;

  return (
    <>
      {showTrigger && (
        <Button
          onClick={() => handleOpenChange(true)}
          disabled={templates.length === 0}
          className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title={templates.length === 0 ? 'Create class templates first' : 'Schedule a new class'}
        >
          <PlusIcon className="size-4" aria-hidden />
          New Class
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Schedule a new class</DialogTitle>
            <DialogDescription>
              Choose a template and pick a date & time. Instructor conflicts are checked in real time.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Template */}
            <div className="space-y-1.5">
              <Label htmlFor="template" className="text-[#6b3d32] font-medium">Class template *</Label>
              <select
                id="template"
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  setInstructorId('');
                }}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {CLASS_TYPE_LABEL[t.classType] ?? t.classType} · {t.durationMinutes}min
                  </option>
                ))}
              </select>
            </div>

            {/* Template preview */}
            {selectedTemplate && (
              <div className="rounded-xl border border-[#ede8e5] bg-[#faf9f7]/60 px-3.5 py-3 text-xs text-[#8b6b5c] space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <ClockIcon className="size-3.5 text-[#a6856f]" />
                  <span>{selectedTemplate.durationMinutes} min</span>
                  {endsAtLabel && <span className="opacity-60">({time} – {endsAtLabel})</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <UsersIcon className="size-3.5 text-[#a6856f]" />
                  <span>Max {selectedTemplate.maxCapacity} students</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CreditCardIcon className="size-3.5 text-[#a6856f]" />
                  <span>{selectedTemplate.creditCost} {selectedTemplate.creditType} credits</span>
                </div>
                {selectedTemplate.instructorName && (
                  <p className="text-[#6b3d32]">
                    Default instructor:{' '}
                    <span className="font-medium text-[#4e2b22]">{selectedTemplate.instructorName}</span>
                  </p>
                )}
              </div>
            )}

            {/* Date + Time row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="date" className="text-[#6b3d32] font-medium">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="time" className="text-[#6b3d32] font-medium">Time *</Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Conflict feedback */}
            {templateId && date && time && (
              <div>
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
                              onClick={() => setTime(s)}
                              className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-200 transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : resolvedInstructorId ? (
                  <div className="flex items-center gap-2 text-xs text-[#4a7c4a]">
                    <CheckCircleIcon className="size-3.5" />
                    Instructor is free at this time
                  </div>
                ) : null}
              </div>
            )}

            {/* Instructor (required) */}
            {lockedInstructorId ? (
              <div className="space-y-1.5">
                <Label className="text-[#6b3d32] font-medium">Instructor</Label>
                <div className="flex h-9 items-center rounded-md border border-input bg-[#faf9f7]/60 px-3 py-1 text-sm text-[#4e2b22]">
                  {instructors.find((i) => i.id === lockedInstructorId)?.name ?? 'You'}
                </div>
              </div>
            ) : instructors.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="instructor" className="text-[#6b3d32] font-medium">
                  Instructor *
                </Label>
                <select
                  id="instructor"
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select an instructor…</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !templateId || !instructorId}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2Icon className="size-4 animate-spin" aria-hidden />
                    Scheduling…
                  </span>
                ) : (
                  'Schedule class'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
