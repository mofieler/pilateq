'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem('cookie_notice_dismissed')) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (private browsing etc.)
    }
  }, []);

  function dismiss() {
    try { localStorage.setItem('cookie_notice_dismissed', '1'); } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl">
      <div className="rounded-2xl border border-[#ede8e5] bg-[#faf9f7]/95 backdrop-blur-lg shadow-[0_8px_32px_rgba(78,43,34,0.12)] px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#4e2b22]">Essential cookies only</p>
          <p className="text-xs text-[#8b6b5c] mt-0.5 leading-relaxed">
            This platform uses only a session cookie required for login — no tracking or
            analytics.{' '}
            <Link href="/datenschutz" className="text-[#6b3d32] underline underline-offset-2">
              Privacy policy
            </Link>
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-xl bg-[#4e2b22] px-4 py-2 text-xs font-semibold text-[#faf9f7] hover:bg-[#6b3d32] transition-colors whitespace-nowrap"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
