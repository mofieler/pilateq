'use client';

import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  CheckCircle, XCircle, Clock, AlertTriangle,
  Store, Calendar, Download, ChevronDown, ChevronUp,
  Banknote, Bell, Mail,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LEGACY_CREDIT_TYPE_LABELS, LEGACY_CREDIT_TYPE_STYLES } from '@/lib/config/class-types';
import { UserAvatar } from '@/modules/users/components/UserAvatar';
import type { CreditPurchase } from '../types';
import { formatPrice, STATUS_CONFIG } from '../utils';

interface Props {
  purchase: CreditPurchase;
  onMarkPaid: (id: string, notes: string) => void;
  onDownload: (id: string, invoiceNumber: string | null) => void;
  onSendReminder: (purchase: CreditPurchase) => void;
  onSendToEmail: (purchase: CreditPurchase) => void;
}

export function PurchaseRow({ purchase, onMarkPaid, onDownload, onSendReminder, onSendToEmail }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [notes, setNotes] = useState(purchase.adminNotes ?? '');
  const [downloading, setDownloading] = useState(false);

  const statusConfig = STATUS_CONFIG[purchase.paymentStatus];
  const StatusIcon = statusConfig.icon;
  const isPayAtStudio = purchase.paymentMethod === 'pay_at_studio';
  const canMarkPaid = purchase.paymentStatus === 'pending' || purchase.paymentStatus === 'overdue';
  const canSendReminder = canMarkPaid && !!purchase.invoiceNumber;

  async function handleDownload() {
    setDownloading(true);
    await onDownload(purchase.id, purchase.invoiceNumber);
    setDownloading(false);
  }

  return (
    <div className={cn(
      'rounded-2xl border transition-[border-color,box-shadow] duration-200 bg-linear-to-br from-[#faf9f7]/90 to-[#f5f3f1]/60',
      isExpanded ? 'border-[#c4a88a]/40 shadow-[0_4px_20px_rgba(78,43,34,0.08)]' : 'border-[#ede8e5]/80',
    )}>
      {/* ── Collapsed row ── */}
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 shrink-0">
          <UserAvatar
            name={purchase.userName ?? 'Unknown'}
            avatarUrl={purchase.userAvatarUrl}
            size="sm"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold text-[#4e2b22] truncate">{purchase.userName ?? 'Unknown'}</span>
            <span className="text-[#8b6b5c] text-xs truncate max-w-[180px] sm:max-w-none">{purchase.userEmail}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <Badge variant="outline" className={cn('text-xs rounded-full', LEGACY_CREDIT_TYPE_STYLES[purchase.creditType])}>
              {LEGACY_CREDIT_TYPE_LABELS[purchase.creditType]}
            </Badge>
            <span className="text-sm text-[#6b3d32] truncate">
              {purchase.packageName === 'Welcome Journey'
                ? 'Welcome Package'
                : (purchase.packageName ?? purchase.adminNotes ?? 'Credit Package')}
            </span>
            <span className="text-sm font-semibold text-[#4e2b22]">{formatPrice(purchase.priceCents, purchase.currency)}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {purchase.invoiceNumber && (
              <p className="text-xs text-[#a6856f] font-mono">{purchase.invoiceNumber}</p>
            )}
            {purchase.reminderCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#d4a574]/15 border border-[#d4a574]/30 px-2 py-0.5 text-[10px] font-medium text-[#b58a5c]">
                <Bell className="size-2.5" />
                {purchase.reminderCount}× reminder
                {purchase.lastReminderAt && ` · ${formatDistanceToNow(new Date(purchase.lastReminderAt), { addSuffix: true })}`}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge variant="outline" className={cn('rounded-full text-xs', statusConfig.color)}>
            <StatusIcon className="size-3 mr-1" />
            {statusConfig.label}
          </Badge>
          <div className="flex items-center gap-1">
            {canSendReminder && (
              <button type="button" onClick={() => onSendReminder(purchase)} aria-label="Send payment reminder" title="Send payment reminder"
                className="flex size-8 items-center justify-center rounded-lg border border-[#d4a574]/40 text-[#b58a5c] transition-all hover:border-[#d4a574] hover:text-[#8b5c2a] hover:bg-[#fdf8f5] active:scale-95">
                <Bell className="size-3.5" />
              </button>
            )}
            {purchase.invoiceNumber && (
              <button type="button" onClick={handleDownload} disabled={downloading} aria-label={`Download invoice ${purchase.invoiceNumber}`} title="Download PDF invoice"
                className={cn('flex size-8 items-center justify-center rounded-lg border transition-all active:scale-95',
                  downloading ? 'border-[#ede8e5] text-[#c4a88a] cursor-wait' : 'border-[#ede8e5] text-[#8b6b5c] hover:border-[#c4a88a] hover:text-[#4e2b22] hover:bg-[#fdf8f5]',
                )}>
                {downloading ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Download className="size-3.5" />}
              </button>
            )}
            <button type="button" onClick={() => setIsExpanded((v) => !v)} aria-expanded={isExpanded} aria-label={isExpanded ? 'Collapse details' : 'Show details'}
              className="flex size-8 items-center justify-center rounded-lg border border-[#ede8e5] text-[#8b6b5c] transition-all hover:border-[#c4a88a] hover:text-[#4e2b22] hover:bg-[#fdf8f5] active:scale-95">
              {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Expanded details ── */}
      <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
        <div className="px-4 pb-4 border-t border-[#ede8e5]/60">
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/60 text-[#8b6b5c]"><Store className="size-3.5" /></span>
              <span className="text-[#8b6b5c]">Method</span>
              <span className="text-[#4e2b22] font-medium">{isPayAtStudio ? 'Pay at Studio / Bank Transfer' : 'Stripe'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/60 text-[#8b6b5c]"><Calendar className="size-3.5" /></span>
              <span className="text-[#8b6b5c]">Purchased</span>
              <span className="text-[#4e2b22]">{format(new Date(purchase.createdAt), 'MMM d, yyyy')}</span>
            </div>
            {purchase.paymentDueDate && (
              <div className="flex items-center gap-2 text-sm">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/60 text-[#8b6b5c]"><Clock className="size-3.5" /></span>
                <span className="text-[#8b6b5c]">Due Date</span>
                <span className={cn('font-medium', purchase.paymentStatus === 'overdue' ? 'text-[#c45c4a]' : 'text-[#4e2b22]')}>
                  {format(new Date(purchase.paymentDueDate), 'MMM d, yyyy')}
                </span>
              </div>
            )}
            {purchase.paidAt && (
              <div className="flex items-center gap-2 text-sm">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#6b8e6b]/15 text-[#4a7c4a]"><CheckCircle className="size-3.5" /></span>
                <span className="text-[#8b6b5c]">Paid</span>
                <span className="text-[#4a7c4a] font-medium">{format(new Date(purchase.paidAt), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>

          {purchase.adminNotes && !canMarkPaid && (
            <div className="mb-4 rounded-xl bg-[#ede8e5]/40 px-4 py-3">
              <p className="text-xs text-[#8b6b5c] mb-1">Admin Notes</p>
              <p className="text-sm text-[#6b3d32]">{purchase.adminNotes}</p>
            </div>
          )}

          {/* Invoice actions */}
          <div className="mb-4 flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={handleDownload} disabled={downloading || !purchase.invoiceNumber}
              title={!purchase.invoiceNumber ? 'No invoice on record for this purchase' : undefined}
              className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all active:scale-95',
                purchase.invoiceNumber
                  ? 'border-[#ede8e5] text-[#6b3d32] hover:border-[#c4a88a] hover:text-[#4e2b22] hover:bg-[#fdf8f5]'
                  : 'border-[#ede8e5]/50 text-[#c4a88a] cursor-not-allowed opacity-60',
              )}>
              {downloading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Download className="size-4" />}
              {purchase.invoiceNumber ? 'Download PDF' : 'No Invoice on Record'}
            </button>
            {canSendReminder && (
              <button type="button" onClick={() => onSendReminder(purchase)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#d4a574]/40 px-4 py-2.5 text-sm font-medium text-[#b58a5c] transition-all hover:border-[#d4a574] hover:text-[#8b5c2a] hover:bg-[#fdf8f5] active:scale-95">
                <Bell className="size-4" />Send Reminder
              </button>
            )}
            {purchase.invoiceNumber && (
              <button type="button" onClick={() => onSendToEmail(purchase)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#ede8e5] px-4 py-2.5 text-sm font-medium text-[#6b3d32] transition-all hover:border-[#c4a88a] hover:text-[#4e2b22] hover:bg-[#fdf8f5] active:scale-95">
                <Mail className="size-4" />Email Invoice
              </button>
            )}
          </div>

          {/* Mark as paid */}
          {canMarkPaid && (
            <div className="space-y-3 pt-3 border-t border-[#ede8e5]/60">
              <div>
                <label className="text-sm text-[#8b6b5c] mb-1.5 block font-medium">
                  Admin Notes <span className="font-normal text-[#a6856f]">(optional)</span>
                </label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Paid in cash, receipt no. 1234…"
                  className="w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 px-3 py-2 text-sm text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none resize-none transition-colors"
                  rows={2} />
              </div>
              <Button variant="boutique" size="sm" className="w-full gap-2" onClick={() => onMarkPaid(purchase.id, notes)}>
                <Banknote className="size-4" />Mark as Paid
              </Button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
