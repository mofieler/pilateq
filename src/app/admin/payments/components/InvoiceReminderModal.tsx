'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CreditPurchase } from '../types';
import { formatPrice } from '../utils';

interface Props {
  purchase: CreditPurchase;
  onConfirm: (purchaseId: string, message: string) => void;
  onClose: () => void;
  loading: boolean;
}

export function InvoiceReminderModal({ purchase, onConfirm, onClose, loading }: Props) {
  const [message, setMessage] = useState('');
  const dueDate = purchase.paymentDueDate ? new Date(purchase.paymentDueDate) : null;
  const isOverdue = purchase.paymentStatus === 'overdue';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#4e2b22]/20 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-[#ede8e5] bg-white shadow-2xl shadow-[#4e2b22]/10 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[#d4a574]/15">
              <Bell className="size-5 text-[#b58a5c]" />
            </span>
            <div>
              <h2 className="font-semibold text-[#4e2b22]">Send Payment Reminder</h2>
              <p className="text-xs text-[#8b6b5c] mt-0.5">Email will be sent to {purchase.userEmail}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-[#8b6b5c] hover:bg-[#fdf8f5] hover:text-[#4e2b22] transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="mx-6 mb-4 rounded-2xl bg-[#faf9f7] border border-[#ede8e5] p-4 space-y-2">
          {[
            { label: 'Client', value: purchase.userName ?? 'Unknown' },
            { label: 'Invoice', value: purchase.invoiceNumber, mono: true },
            { label: 'Amount', value: formatPrice(purchase.priceCents, purchase.currency), bold: true },
          ].map(({ label, value, mono, bold }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-[#8b6b5c]">{label}</span>
              <span className={cn('text-[#4e2b22]', mono && 'font-mono', bold && 'font-semibold')}>{value}</span>
            </div>
          ))}
          {dueDate && (
            <div className="flex justify-between text-sm">
              <span className="text-[#8b6b5c]">Due</span>
              <span className={cn('font-medium', isOverdue ? 'text-[#c45c4a]' : 'text-[#4e2b22]')}>
                {format(dueDate, 'MMM d, yyyy')}{isOverdue && ' · Overdue'}
              </span>
            </div>
          )}
          {purchase.reminderCount > 0 && (
            <div className="flex justify-between text-sm pt-1 border-t border-[#ede8e5]">
              <span className="text-[#8b6b5c]">Previous reminders</span>
              <span className="text-[#b58a5c] font-medium">{purchase.reminderCount}×</span>
            </div>
          )}
        </div>

        <div className="px-6 mb-5">
          <label className="text-sm font-medium text-[#6b3d32] mb-1.5 block">
            Personal note <span className="text-[#a6856f] font-normal">(optional)</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Hi Sophie, just a friendly reminder about your outstanding invoice…"
            maxLength={1000}
            rows={3}
            className="w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 px-3 py-2.5 text-sm text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none resize-none transition-colors"
          />
          <p className="text-right text-xs text-[#a6856f] mt-1">{message.length}/1000</p>
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1 rounded-xl border-[#ede8e5] text-[#6b3d32]">
            Cancel
          </Button>
          <Button variant="boutique" size="sm" onClick={() => onConfirm(purchase.id, message)} disabled={loading} className="flex-1 gap-2 rounded-xl">
            {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Bell className="size-4" />}
            Send Reminder
          </Button>
        </div>
      </div>
    </div>
  );
}
