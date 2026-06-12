'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { CheckCircle2, AlertCircle, RefreshCw, Unlink, Calendar as CalendarIcon } from 'lucide-react';
import {
  selectCalendar,
  disconnectMyCalendar,
  syncNow,
} from '@/modules/calendar/actions/calendar.actions';

export interface AccessibleCalendar {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor: string | null;
}

export interface ConnectionState {
  id: string;
  ownerName: string;
  ownerEmail: string;
  googleAccountEmail: string;
  selectedCalendarId: string | null;
  selectedCalendarName: string | null;
  syncEnabled: boolean;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  calendars: AccessibleCalendar[];
  loadError: string | null;
  isCurrentUser: boolean;
}

export function CalendarConnectionPanel({ connection }: { connection: ConnectionState }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(connection.selectedCalendarId ?? '');

  function handleSelect(calId: string) {
    const cal = connection.calendars.find((c) => c.id === calId);
    if (!cal) return;
    setSelectedId(calId);
    startTransition(async () => {
      await selectCalendar({ calendarId: cal.id, calendarName: cal.summary });
      router.refresh();
    });
  }

  function handleDisconnect() {
    if (!confirm('Disconnect this calendar? All external blocks will be removed.')) return;
    startTransition(async () => {
      await disconnectMyCalendar();
      router.refresh();
    });
  }

  function handleSyncNow() {
    startTransition(async () => {
      const res = await syncNow();
      if (!res.success) alert(`Sync failed: ${res.error}`);
      router.refresh();
    });
  }

  const hasError = !!connection.lastSyncError || !!connection.loadError;

  return (
    <div className="rounded-2xl border border-[#ede8e5] bg-[#faf9f7] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-[#4e2b22]">
            {connection.ownerName}
            {connection.isCurrentUser && (
              <span className="ml-2 text-xs font-normal text-[#8b6b5c]">(you)</span>
            )}
          </h3>
          <p className="text-xs text-[#6b3d32] mt-0.5">{connection.ownerEmail}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
          <CheckCircle2 className="size-3.5" />
          Connected
        </div>
      </div>

      <dl className="space-y-2 text-sm text-[#6b3d32] mb-4">
        <div className="flex justify-between gap-3">
          <dt className="font-medium text-[#8b6b5c]">Google account:</dt>
          <dd className="text-right break-all">{connection.googleAccountEmail}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-medium text-[#8b6b5c]">Last sync:</dt>
          <dd className="text-right">
            {connection.lastSyncAt
              ? format(connection.lastSyncAt, 'dd MMM HH:mm')
              : 'Never'}
          </dd>
        </div>
      </dl>

      {hasError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-error/10 p-3 text-xs text-error">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span className="break-all">{connection.lastSyncError ?? connection.loadError}</span>
        </div>
      )}

      <label className="block text-xs font-semibold text-[#8b6b5c] mb-1.5">
        Synced calendar
      </label>
      <div className="flex items-center gap-2">
        <CalendarIcon className="size-4 text-[#8b6b5c] shrink-0" />
        <select
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={isPending || connection.calendars.length === 0}
          className="flex-1 rounded-lg border border-[#ede8e5] bg-white px-3 py-2 text-sm text-[#4e2b22] focus:outline-none focus:ring-2 focus:ring-[#4e2b22]/30 disabled:opacity-50"
        >
          {connection.calendars.length === 0 && <option value="">No calendars found</option>}
          {connection.calendars.length > 0 && !selectedId && (
            <option value="">— please select —</option>
          )}
          {connection.calendars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.summary}
              {c.primary ? ' (primary)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleSyncNow}
          disabled={isPending || !connection.selectedCalendarId}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#4e2b22] px-3 py-2 text-xs font-semibold text-[#faf9f7] hover:bg-[#6b3d32] disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`size-3.5 ${isPending ? 'animate-spin' : ''}`} />
          Sync now
        </button>
        <button
          onClick={handleDisconnect}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#c4a88a]/50 bg-white px-3 py-2 text-xs font-semibold text-[#4e2b22] hover:bg-error/10 hover:border-error/40 hover:text-error transition-colors disabled:opacity-50"
        >
          <Unlink className="size-3.5" />
          Disconnect
        </button>
      </div>
    </div>
  );
}
