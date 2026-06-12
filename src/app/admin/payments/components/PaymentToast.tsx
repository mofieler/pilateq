'use client';

import { useCallback, useState } from 'react';
import { CheckCheck, XCircle, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-3 rounded-2xl border p-4 shadow-lg shadow-[#4e2b22]/10',
            'animate-in slide-in-from-bottom-4 fade-in duration-300',
            t.type === 'success' && 'bg-white border-[#6b8e6b]/30',
            t.type === 'error'   && 'bg-white border-[#c45c4a]/30',
            t.type === 'info'    && 'bg-white border-[#ede8e5]',
          )}
        >
          <span className="shrink-0 mt-0.5">
            {t.type === 'success' && <CheckCheck className="size-4 text-[#4a7c4a]" />}
            {t.type === 'error'   && <XCircle    className="size-4 text-[#c45c4a]" />}
            {t.type === 'info'    && <Clock      className="size-4 text-[#8b6b5c]" />}
          </span>
          <p className="flex-1 text-sm text-[#4e2b22]">{t.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="shrink-0 text-[#8b6b5c] hover:text-[#4e2b22] transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}
