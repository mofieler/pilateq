'use client';

import { Plus } from 'lucide-react';

export function ConnectCalendarButton({ label = 'Connect Google Calendar' }: { label?: string }) {
  return (
    <a
      href="/api/calendar/oauth/start"
      className="inline-flex items-center gap-2 rounded-lg bg-[#4e2b22] px-4 py-2.5 text-sm font-semibold text-[#faf9f7] hover:bg-[#6b3d32] transition-colors"
    >
      <Plus className="size-4" />
      {label}
    </a>
  );
}
