'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  CheckCircle,
  Loader2,
  Send,
  X,
  Sparkles,
  CalendarDays,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatStudio, formatStudioTime } from '@/lib/utils/date.utils';
import {
  getUpcomingWelcomeJourneySessions,
  getWelcomeJourneyRecommendations,
  offerWelcomeJourneySlots,
  createAndOfferWelcomeJourneySlot,
} from '@/modules/welcome/actions/welcomeRequest.actions';

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

type WjSession = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  instructorName: string | null;
  className: string;
  bookedCount: number;
  maxCapacity: number;
};

interface OfferSlotsModalProps {
  request: PendingRequest;
  onClose: () => void;
  onOffered: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OfferSlotsModal({ request, onClose, onOffered }: OfferSlotsModalProps) {
  const [sessions, setSessions] = useState<WjSession[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Recommendations state
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [selectedInstructors, setSelectedInstructors] = useState<Record<number, string>>({});
  const [creatingIndex, setCreatingIndex] = useState<number | null>(null);

  useEffect(() => {
    getUpcomingWelcomeJourneySessions().then((res) => {
      if (res.success) setSessions(res.data ?? []);
      setLoading(false);
    });

    getWelcomeJourneyRecommendations(request.request.id).then((res) => {
      if (res.success && res.data) {
        setRecommendations(res.data.preferredSlots);
        const initialSelected: Record<number, string> = {};
        res.data.preferredSlots.forEach((slot: any, idx: number) => {
          if (slot.availableInstructors.length > 0) {
            initialSelected[idx] = slot.availableInstructors[0].id;
          }
        });
        setSelectedInstructors(initialSelected);
      }
      setLoadingRecs(false);
    });
  }, [request.request.id]);

  function toggleSession(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  function handleOffer() {
    startTransition(async () => {
      const result = await offerWelcomeJourneySlots({
        requestId: request.request.id,
        sessionIds: selectedIds,
      });
      if (result.success) {
        toast.success('Slots offered!');
        onOffered();
      } else {
        toast.error(result.error);
      }
    });
  }

  const handleCreateAndOffer = async (startsAt: Date, idx: number) => {
    const instructorId = selectedInstructors[idx];
    if (!instructorId) {
      toast.error('Please select an instructor first');
      return;
    }
    setCreatingIndex(idx);
    try {
      const res = await createAndOfferWelcomeJourneySlot({
        requestId: request.request.id,
        startsAtISO: startsAt.toISOString(),
        instructorId,
      });
      if (res.success) {
        toast.success('Session created and offered to student!');
        onOffered();
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      console.error('[OfferSlotsModal] One-click create failed:', err);
      toast.error('Failed to create and offer session');
    } finally {
      setCreatingIndex(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      {/* Mobile: full-screen drawer, Desktop: centered modal */}
      <div className="w-full sm:max-w-2xl sm:rounded-2xl sm:border sm:border-[#ede8e5] bg-[#faf9f7] h-[92dvh] sm:h-auto sm:max-h-[85vh] shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-[#ede8e5]/60 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#4e2b22] flex items-center gap-1.5">
              <Sparkles className="size-4 text-[#d4a574] shrink-0" aria-hidden />
              <span className="truncate">Fulfill Welcome Journey Request</span>
            </h3>
            <p className="text-[11px] text-[#8b6b5c] mt-0.5 truncate">
              For <strong>{request.userName ?? 'this student'}</strong>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-[#ede8e5] shrink-0 ml-2" aria-label="Close">
            <X className="size-5 text-[#8b6b5c]" aria-hidden />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-5">
          {/* Smart Recommendations */}
          <div className="rounded-xl border border-[#d4a574]/20 bg-[#d4a574]/5 p-3 sm:p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6b3d32] mb-3 flex items-center gap-1">
              <Sparkles className="size-3.5" aria-hidden />
              1. Student Preferences &amp; Recommendations
            </h4>

            {loadingRecs ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-5 animate-spin text-[#d4a574]" />
              </div>
            ) : recommendations.length === 0 ? (
              <p className="text-xs italic text-[#8b6b5c] py-2">
                No structured date preferences. Use the schedule list below to offer slots.
              </p>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec, idx) => {
                  const startsAt = new Date(rec.startsAt);
                  const hasExisting = rec.existingSessions && rec.existingSessions.length > 0;

                  return (
                    <div
                      key={idx}
                      className="flex flex-col rounded-lg border border-[#ede8e5] bg-white p-3 shadow-sm gap-3"
                    >
                      {/* Info */}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="flex size-4 items-center justify-center rounded-full bg-[#d4a574]/20 text-[9px] font-bold text-[#6b3d32]">
                            {idx + 1}
                          </span>
                          <p className="text-xs font-bold text-[#4e2b22]">
                            {formatStudio(startsAt, 'EEEE, d MMMM')} at {formatStudioTime(startsAt)}
                          </p>
                        </div>

                        {hasExisting ? (
                          <div className="mt-1 pl-5">
                            {rec.existingSessions.map((s: any) => (
                              <div key={s.id} className="flex items-center gap-2 mt-1">
                                <span className="inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-[9px] font-semibold text-[#4a7c4a] border border-[#4a7c4a]/10">
                                  Existing Session
                                </span>
                                <span className="text-[10px] text-[#8b6b5c]">
                                  with {s.instructorName ?? 'TBA'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : rec.overlappingSessions && rec.overlappingSessions.length > 0 ? (
                          <div className="mt-1 pl-5 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-700 border border-red-200">
                                Studio Busy
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 pl-5 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded bg-[#d4a574]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#6b3d32] border border-[#d4a574]/20">
                              Slot is Free
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pl-5 sm:pl-0">
                        {hasExisting ? (
                          rec.existingSessions.map((s: any) => {
                            const isSelected = selectedIds.includes(s.id);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => toggleSession(s.id)}
                                className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-all min-h-[44px] ${
                                  isSelected
                                    ? 'border-[#4a7c4a] bg-[#4a7c4a]/10 text-[#4a7c4a]'
                                    : 'border-[#c4a88a] text-[#6b3d32] hover:bg-[#ede8e5]'
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <CheckCircle className="size-3.5" /> Selected
                                  </>
                                ) : (
                                  'Select to Offer'
                                )}
                              </button>
                            );
                          })
                        ) : rec.availableInstructors.length > 0 ? (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <select
                              value={selectedInstructors[idx] || ''}
                              onChange={(e) =>
                                setSelectedInstructors({
                                  ...selectedInstructors,
                                  [idx]: e.target.value,
                                })
                              }
                              className="rounded-lg border border-[#ede8e5] bg-white px-2 py-2 text-xs text-[#4e2b22] focus:border-[#c4a88a] focus:outline-none min-h-[44px]"
                            >
                              {rec.availableInstructors.map((inst: any) => (
                                <option key={inst.id} value={inst.id}>
                                  {inst.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="boutique"
                              onClick={() => handleCreateAndOffer(startsAt, idx)}
                              disabled={!selectedInstructors[idx] || creatingIndex !== null}
                              className="h-[44px] text-xs font-semibold shrink-0"
                            >
                              {creatingIndex === idx ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Plus className="size-3" /> Assign &amp; Offer
                                </span>
                              )}
                            </Button>
                          </div>
                        ) : rec.overlappingSessions && rec.overlappingSessions.length > 0 ? (
                          <span className="text-[10px] text-red-500 font-medium">
                            Studio occupied — cannot schedule
                          </span>
                        ) : (
                          <span className="text-[10px] text-red-500 font-medium">
                            No instructors available
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fallback sessions */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6b3d32] mb-3 flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              2. Or Offer Other Upcoming Sessions
            </h4>

            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-5 animate-spin text-[#c4a88a]" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs italic text-[#8b6b5c] py-2">
                No other scheduled Welcome Journey sessions found.
              </p>
            ) : (
              <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {sessions.map((s) => {
                  const selected = selectedIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSession(s.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all min-h-[44px] ${
                        selected
                          ? 'border-[#4a7c4a] bg-[#4a7c4a]/5'
                          : 'border-[#ede8e5] bg-white/60 hover:bg-white'
                      }`}
                    >
                      <div
                        className={`size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selected ? 'border-[#4a7c4a] bg-[#4a7c4a]' : 'border-[#c4a88a]'
                        }`}
                      >
                        {selected && <CheckCircle className="size-2 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#4e2b22]">
                          {formatStudio(s.startsAt, 'EEE, d MMM')} · {formatStudioTime(s.startsAt)}
                        </p>
                        <p className="text-[10px] text-[#8b6b5c]">
                          {s.className} with {s.instructorName ?? 'TBA'} ·{' '}
                          {s.bookedCount}/{s.maxCapacity} booked
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer with CTA */}
        {selectedIds.length > 0 && (
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-[#ede8e5]/60 shrink-0">
            <Button
              variant="boutique"
              className="w-full min-h-[44px]"
              disabled={isPending}
              onClick={handleOffer}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="size-4" />
                  Offer {selectedIds.length} Selected Session{selectedIds.length !== 1 ? 's' : ''}
                </span>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
