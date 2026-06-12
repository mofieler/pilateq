'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Cloudflare Turnstile widget. Renders nothing if NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * is unset (dev / un-provisioned). Calls onToken with the token issued by
 * Cloudflare; reset() to invalidate it after a failed submission.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

type Props = {
  onToken: (token: string | null) => void;
  className?: string;
};

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const SCRIPT_ID = 'cf-turnstile-script';

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (document.getElementById(SCRIPT_ID)) {
    return new Promise((resolve) => {
      const check = () => (window.turnstile ? resolve() : setTimeout(check, 50));
      check();
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.id = SCRIPT_ID;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Turnstile'));
    document.head.appendChild(s);
  });
}

export function TurnstileWidget({ onToken, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [error, setError] = useState<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Keep the ref current without re-mounting the widget on every parent render.
  useEffect(() => { onTokenRef.current = onToken; });

  const stableOnToken = useCallback((token: string | null) => onTokenRef.current(token), []);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          size: 'flexible',
          callback: (token) => stableOnToken(token),
          'error-callback': () => {
            setError('Captcha could not load. Please refresh the page.');
            stableOnToken(null);
          },
          'expired-callback': () => stableOnToken(null),
        });
      })
      .catch(() => setError('Captcha could not load. Please refresh the page.'));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore — widget may already be gone
        }
      }
    };
  }, [siteKey, stableOnToken]);

  if (!siteKey) {
    // Un-provisioned: hide entirely. Server still skips verification when
    // TURNSTILE_SECRET_KEY is unset, so registration works in dev.
    return null;
  }

  return (
    <div className={className}>
      <div ref={containerRef} />
      {error && (
        <p className="mt-2 text-xs text-[#c45c4a]">{error}</p>
      )}
    </div>
  );
}
