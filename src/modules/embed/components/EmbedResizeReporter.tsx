'use client';

import { useEffect, useRef, type ReactNode } from 'react';

const MESSAGE_TYPE = 'embed-resize';

/**
 * Wraps embed content and notifies the parent page to resize the iframe (Calendly-style).
 */
export function EmbedResizeReporter({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === 'undefined') return;

    function postHeight() {
      if (!root) return;
      const height = Math.ceil(root.scrollHeight + 8);
      // Parent is usually another origin (marketing site). Parent must verify `event.origin`.
      window.parent.postMessage({ type: MESSAGE_TYPE, height }, '*');
    }

    postHeight();
    const observer = new ResizeObserver(() => postHeight());
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return <div ref={rootRef}>{children}</div>;
}
