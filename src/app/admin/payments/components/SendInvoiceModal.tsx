'use client';

import { useState } from 'react';
import { Mail, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CreditPurchase } from '../types';

interface Props {
  purchase: CreditPurchase;
  onSend: (purchaseId: string, email: string, message: string) => void;
  onClose: () => void;
  loading: boolean;
}

export function SendInvoiceModal({ purchase, onSend, onClose, loading }: Props) {
  const [email, setEmail] = useState(purchase.userEmail ?? '');
  const [message, setMessage] = useState('');
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#4e2b22]/20 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-[#ede8e5] bg-white shadow-2xl shadow-[#4e2b22]/10 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[#4e2b22]/10">
              <Mail className="size-5 text-[#6b3d32]" />
            </span>
            <div>
              <h2 className="font-semibold text-[#4e2b22]">Email Invoice</h2>
              <p className="text-xs text-[#8b6b5c] mt-0.5">{purchase.invoiceNumber} · PDF attached</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-[#8b6b5c] hover:bg-[#fdf8f5] hover:text-[#4e2b22] transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="px-6 mb-4">
          <label className="text-sm font-medium text-[#6b3d32] mb-1.5 block">Recipient email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
            className={cn(
              'w-full rounded-xl border px-3 py-2.5 text-sm text-[#4e2b22] placeholder:text-[#a6856f] focus:outline-none transition-colors',
              isEmailValid || email === ''
                ? 'border-[#ede8e5] bg-[#faf9f7]/80 focus:border-[#c4a88a]'
                : 'border-[#c45c4a]/40 bg-[#c45c4a]/5',
            )}
          />
        </div>

        <div className="px-6 mb-5">
          <label className="text-sm font-medium text-[#6b3d32] mb-1.5 block">
            Your message <span className="text-[#c45c4a] text-xs">required</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Dear Sophie, please find your invoice attached. Feel free to reach out with any questions."
            maxLength={2000}
            rows={4}
            className="w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 px-3 py-2.5 text-sm text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none resize-none transition-colors"
          />
          <p className="text-right text-xs text-[#a6856f] mt-1">{message.length}/2000</p>
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1 rounded-xl border-[#ede8e5] text-[#6b3d32]">
            Cancel
          </Button>
          <Button
            variant="boutique"
            size="sm"
            onClick={() => onSend(purchase.id, email, message)}
            disabled={loading || !isEmailValid || message.trim().length === 0}
            className="flex-1 gap-2 rounded-xl"
          >
            {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Send className="size-4" />}
            Send Invoice
          </Button>
        </div>
      </div>
    </div>
  );
}
