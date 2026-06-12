'use client';

import { useState, useEffect, useRef } from 'react';
import { CalendarPlus, Download, Link2, Check } from 'lucide-react';

interface Props {
  title: string;
  startAt: Date;
  endAt: Date;
  location?: string | null;
  description?: string;
  sessionId: string;
}

function toGcalUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildGoogleCalendarUrl({ title, startAt, endAt, location, description }: Omit<Props, 'sessionId'>): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toGcalUtc(startAt)}/${toGcalUtc(endAt)}`,
    details: description ?? '',
    location: location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function AddToCalendarButton({ title, startAt, endAt, location, description, sessionId }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const googleUrl = buildGoogleCalendarUrl({ title, startAt, endAt, location, description });
  const icsUrl = `/api/calendar/download-ics?sessionId=${sessionId}`;
  const icsAbsoluteUrl = typeof window !== 'undefined' ? `${window.location.origin}${icsUrl}` : icsUrl;

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(icsAbsoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.open(icsUrl, '_blank');
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#ede8e5] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#6b3d32] hover:bg-[#faf9f7] transition-colors"
      >
        <CalendarPlus className="size-3.5" />
        Add to Calendar
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1.5 w-52 rounded-xl border border-[#ede8e5] bg-white shadow-[0_8px_24px_rgba(78,43,34,0.12)] py-1.5 animate-in fade-in zoom-in-95 duration-150"
          >
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className="flex items-center gap-2.5 px-3 py-2 text-xs text-[#4e2b22] hover:bg-[#faf9f7] transition-colors"
              onClick={() => setOpen(false)}
            >
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M22 12h-2v-2h-2V8h-2V6h-2V4h-2V2H8v2H6v2H4v2H2v8h2v2h2v2h2v2h2v2h8v-2h2v-2h2v-2h2v-2h2v-8z" fill="#EA4335" />
                <path d="M12 7v10M7 12h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Google Calendar
            </a>
            <a
              href={icsUrl}
              download={`${title.replace(/\s+/g, '_')}.ics`}
              role="menuitem"
              className="flex items-center gap-2.5 px-3 py-2 text-xs text-[#4e2b22] hover:bg-[#faf9f7] transition-colors"
              onClick={() => setOpen(false)}
            >
              <Download className="size-3.5 shrink-0 text-[#8b6b5c]" aria-hidden="true" />
              Apple / Outlook (.ics)
            </a>
            <button
              type="button"
              role="menuitem"
              onClick={handleCopy}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-[#4e2b22] hover:bg-[#faf9f7] transition-colors"
            >
              {copied ? (
                <Check className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
              ) : (
                <Link2 className="size-3.5 shrink-0 text-[#8b6b5c]" aria-hidden="true" />
              )}
              {copied ? 'Link copied!' : 'Copy ICS link'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
