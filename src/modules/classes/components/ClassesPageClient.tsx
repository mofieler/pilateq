'use client';

import { useState } from 'react';
import { CalendarDaysIcon, ListIcon } from 'lucide-react';
import { AdminWeekView, type GCalBlockData } from './AdminWeekView';
import { SessionsDataTable, type SessionRow } from './SessionsDataTable';
import { CreateSessionDialog } from './CreateSessionDialog';
import { SessionDetailModal } from './SessionDetailModal';
import type { WeekViewSessionData, TemplateOption, InstructorOption } from '@/modules/classes/actions/class.actions';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  sessions: WeekViewSessionData[];
  gcalBlocks: GCalBlockData[];
  templates: TemplateOption[];
  instructors: InstructorOption[];
  hasTemplates: boolean;
  isAdmin: boolean;
  myInstructorId: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSessionRow(s: WeekViewSessionData): SessionRow {
  return {
    id: s.id,
    startsAt: s.startsAt,
    templateName: s.templateName,
    instructorName: s.instructorName ?? '—',
    instructorId: s.instructorId,
    bookedCount: s.bookedCount,
    maxCapacity: s.maxCapacity,
    status: s.status as SessionRow['status'],
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClassesPageClient({
  sessions,
  gcalBlocks,
  templates,
  instructors,
  hasTemplates,
  isAdmin,
  myInstructorId,
}: Props) {
  const [view, setView] = useState<'week' | 'list'>('week');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState<string | undefined>();
  const [dialogTime, setDialogTime] = useState<string | undefined>();

  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);

  function openNewClassDialog(date?: string, time?: string) {
    setDialogDate(date);
    setDialogTime(time);
    setDialogOpen(true);
  }

  const detailSession = detailSessionId ? sessions.find((s) => s.id === detailSessionId) : null;

  const listRows = sessions.map(toSessionRow);

  return (
    <>
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[#4e2b22]">Scheduled Classes</h2>
          <span className="text-sm text-[#8b6b5c]">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-[#ede8e5] overflow-hidden">
            <button
              type="button"
              onClick={() => setView('week')}
              aria-pressed={view === 'week'}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2',
                view === 'week'
                  ? 'bg-[#4e2b22] text-white'
                  : 'text-[#6b3d32] hover:bg-[#ede8e5]/60',
              ].join(' ')}
            >
              <CalendarDaysIcon className="size-3.5" />
              Week
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2',
                view === 'list'
                  ? 'bg-[#4e2b22] text-white'
                  : 'text-[#6b3d32] hover:bg-[#ede8e5]/60',
              ].join(' ')}
            >
              <ListIcon className="size-3.5" />
              List
            </button>
          </div>

          {/* New class button */}
          {hasTemplates && (
            <CreateSessionDialog
              templates={templates}
              instructors={instructors}
              showTrigger={false}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              initialDate={dialogDate}
              initialTime={dialogTime}
              lockedInstructorId={isAdmin ? null : myInstructorId}
            />
          )}
          {hasTemplates && (
            <button
              type="button"
              onClick={() => openNewClassDialog()}
              className="flex items-center gap-1.5 rounded-lg bg-[#4e2b22] px-3 py-1.5 text-xs font-semibold text-[#faf9f7] hover:bg-[#6b3d32] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2"
            >
              + New Class
            </button>
          )}
          {!hasTemplates && (
            <div className="rounded-lg bg-[#d4a574]/15 border border-[#d4a574]/20 px-3 py-1.5 text-xs text-[#b58a5c]">
              Create a class template first to schedule classes
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {view === 'week' ? (
        <AdminWeekView
          sessions={sessions}
          gcalBlocks={gcalBlocks}
          onNewClass={(date) => openNewClassDialog(date)}
          onViewSession={(sessionId) => setDetailSessionId(sessionId)}
        />
      ) : (
        <SessionsDataTable data={listRows} />
      )}

      {/* Session detail modal */}
      {detailSession && (
        <SessionDetailModal
          sessionId={detailSession.id}
          sessionTitle={detailSession.templateName}
          startsAt={detailSession.startsAt}
          endsAt={new Date(detailSession.startsAt.getTime() + (detailSession.durationMinutes || 0) * 60000)}
          instructorName={detailSession.instructorName ?? '—'}
          instructorId={detailSession.instructorId}
          durationMinutes={detailSession.durationMinutes}
          bookedCount={detailSession.bookedCount}
          maxCapacity={detailSession.maxCapacity}
          status={detailSession.status}
          open={detailSessionId !== null}
          onOpenChange={(open) => {
            if (!open) setDetailSessionId(null);
          }}
          canEdit={isAdmin || detailSession.instructorId === myInstructorId}
        />
      )}
    </>
  );
}
