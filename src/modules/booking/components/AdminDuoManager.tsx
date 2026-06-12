'use client';

import { useState, useTransition, useEffect } from 'react';
import { Users, X, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  getDuoInvitesForAdminAction,
  getUpcomingDuoSessionsAction,
  cancelDuoInviteAction,
} from '@/modules/booking/actions/adminDuo.actions';
import { formatStudio, formatStudioTime } from '@/lib/utils/date.utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type DuoInvite = {
  id: string;
  status: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  organizerName: string;
  organizerEmail: string;
  partnerName: string | null;
  partnerEmail: string | null;
  sessionName: string;
  startsAt: Date;
};

type DuoSession = {
  sessionId: string;
  sessionName: string;
  startsAt: Date;
  organizerName: string;
  organizerEmail: string;
  partnerName: string | null;
  partnerEmail: string | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminDuoManager({
  initialInvites = [],
  initialSessions = [],
}: {
  initialInvites?: DuoInvite[];
  initialSessions?: DuoSession[];
}) {
  const hasInitialActions = initialInvites.some((i) => i.status === 'pending') || initialSessions.length > 0;

  const [invites, setInvites] = useState<DuoInvite[]>(initialInvites);
  const [sessions, setSessions] = useState<DuoSession[]>(initialSessions);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(hasInitialActions);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadData() {
    setLoading(true);
    const [invitesResult, sessionsResult] = await Promise.all([
      getDuoInvitesForAdminAction(),
      getUpcomingDuoSessionsAction(),
    ]);

    if (invitesResult.success) setInvites(invitesResult.data);
    if (sessionsResult.success) setSessions(sessionsResult.data);
    setLoading(false);
  }

  useEffect(() => {
    if (initialInvites.length === 0 && initialSessions.length === 0) {
      loadData();
    }
  }, []);

  function handleToggle() {
    if (!expanded) {
      loadData();
    }
    setExpanded((v) => !v);
  }

  function handleCancel(inviteId: string) {
    setCancellingId(inviteId);
    startTransition(async () => {
      const result = await cancelDuoInviteAction({ inviteId });
      if (result.success) {
        toast.success('Invite cancelled.');
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      } else {
        toast.error(result.error ?? 'Failed to cancel invite.');
      }
      setCancellingId(null);
    });
  }

  const pendingCount = invites.filter((i) => i.status === 'pending').length;
  const acceptedCount = invites.filter((i) => i.status === 'accepted').length;
  const needsAttention = pendingCount > 0 || sessions.length > 0;

  return (
    <div
      className={cn(
        'rounded-lg border bg-gradient-to-br p-6 transition-colors duration-300',
        needsAttention
          ? 'border-[#d4a574]/50 from-[#faf9f7]/90 to-[#fdf8f3]/60'
          : 'border-[#ede8e5]/80 from-[#faf9f7]/80 to-[#ede8e5]/40',
      )}
    >
      {/* Header */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-xl',
              needsAttention
                ? 'bg-[#d4a574]/20 text-[#8b5c2a]'
                : 'bg-[#8b5a3c]/10 text-[#4e2b22]',
            )}
          >
            <Users className="size-4" />
          </span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[#4e2b22]">Duo Invites</h2>
              {needsAttention && !expanded && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#d4a574]/15 border border-[#d4a574]/30 px-2 py-0.5 text-[10px] font-bold text-[#8b5c2a] animate-pulse">
                  <AlertCircle className="size-3" />
                  Action needed
                </span>
              )}
            </div>
            <p className="text-sm text-[#8b6b5c]">
              {pendingCount > 0 ? (
                <span className="font-semibold text-[#8b5c2a]">{pendingCount} pending</span>
              ) : (
                <span>{pendingCount} pending</span>
              )}
              {' · '}
              {acceptedCount} accepted · {sessions.length} upcoming sessions
            </p>
          </div>
        </div>
        <span className="text-sm text-[#8b6b5c]">{expanded ? 'Collapse' : 'Expand'}</span>
      </button>

      {/* Content */}
      {expanded && (
        <div className="mt-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-[#c4a88a]" />
            </div>
          ) : (
            <>
              {/* Pending invites */}
              {pendingCount > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b3d32]">
                    Pending Invites
                  </h3>
                  <div className="space-y-2">
                    {invites
                      .filter((i) => i.status === 'pending')
                      .map((invite) => (
                        <div
                          key={invite.id}
                          className="flex items-center justify-between rounded-lg border border-[#ede8e5]/60 bg-white/60 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#4e2b22]">
                              {invite.organizerName} invited someone to {invite.sessionName}
                            </p>
                            <p className="text-xs text-[#8b6b5c]">
                              {formatStudio(invite.startsAt, 'EEE, d MMM')} · {formatStudioTime(invite.startsAt)} ·
                              Expires {formatStudio(invite.expiresAt, 'd MMM HH:mm')}
                            </p>
                          </div>
                          <button
                            onClick={() => handleCancel(invite.id)}
                            disabled={isPending && cancellingId === invite.id}
                            className="ml-3 flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            {isPending && cancellingId === invite.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <X className="size-3" />
                            )}
                            Cancel
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Upcoming duo sessions */}
              {sessions.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b3d32]">
                    Upcoming Duo Sessions
                  </h3>
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div
                        key={session.sessionId}
                        className="rounded-lg border border-[#ede8e5]/60 bg-white/60 px-4 py-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-[#4e2b22]">{session.sessionName}</p>
                          <p className="text-xs text-[#8b6b5c]">
                            {formatStudio(session.startsAt, 'EEE, d MMM')} · {formatStudioTime(session.startsAt)}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-[#6b3d32]">
                          <span className="font-medium">{session.organizerName}</span> +{' '}
                          <span className="font-medium">{session.partnerName ?? '—'}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingCount === 0 && sessions.length === 0 && (
                <p className="py-4 text-center text-sm text-[#8b6b5c]">No duo invites or upcoming sessions.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
