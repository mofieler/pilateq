'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Filter, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToastContainer, useToast } from './components/PaymentToast';
import { InvoiceReminderModal } from './components/InvoiceReminderModal';
import { SendInvoiceModal } from './components/SendInvoiceModal';
import { AddManualPaymentModal } from './components/AddManualPaymentModal';
import { PurchaseRow } from './components/PurchaseRow';
import type { CreditPurchase, StatusFilter } from './types';
import { formatPrice } from './utils';

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ title, value, subtitle, color }: {
  title: string; value: string | number; subtitle: string;
  color: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const styles = {
    primary: 'from-[#4e2b22]/10 to-[#6b3d32]/5 border-[#4e2b22]/10',
    success: 'from-[#6b8e6b]/10 to-[#6b8e6b]/5 border-[#6b8e6b]/15',
    warning: 'from-[#d4a574]/10 to-[#d4a574]/5 border-[#d4a574]/15',
    danger:  'from-[#c45c4a]/10 to-[#c45c4a]/5 border-[#c45c4a]/15',
  };
  return (
    <div className={cn('rounded-2xl border p-5 bg-linear-to-br', styles[color])}>
      <p className="text-sm text-[#8b6b5c]">{title}</p>
      <p className="text-2xl font-bold text-[#4e2b22] mt-1">{value}</p>
      <p className="text-xs text-[#8b6b5c] mt-1">{subtitle}</p>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-24 rounded-2xl bg-linear-to-br from-[#ede8e5]/40 to-[#e5dfdb]/30 animate-pulse" />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const { toasts, show: showToast, dismiss } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [purchases, setPurchases] = useState<CreditPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminderModal, setReminderModal] = useState<CreditPurchase | null>(null);
  const [sendModal, setSendModal] = useState<CreditPurchase | null>(null);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const loadPurchases = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/purchases');
      if (!res.ok) throw new Error('Failed to fetch');
      setPurchases(await res.json());
    } catch {
      showToast('Failed to load purchases. Please refresh.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadPurchases(); }, [loadPurchases]);

  const stats = useMemo(() => {
    const paid     = purchases.filter((p) => p.paymentStatus === 'paid').length;
    const pending  = purchases.filter((p) => p.paymentStatus === 'pending').length;
    const overdue  = purchases.filter((p) => p.paymentStatus === 'overdue').length;
    const totalRevenue  = purchases.filter((p) => p.paymentStatus === 'paid').reduce((s, p) => s + p.priceCents, 0);
    const outstanding   = purchases.filter((p) => ['pending', 'overdue'].includes(p.paymentStatus)).reduce((s, p) => s + p.priceCents, 0);
    return { total: purchases.length, paid, pending, overdue, totalRevenue, outstanding };
  }, [purchases]);

  const filteredPurchases = useMemo(() => purchases.filter((p) => {
    const matchesStatus =
      statusFilter === 'all'            ? true :
      statusFilter === 'pay_at_studio'  ? p.paymentMethod === 'pay_at_studio' :
      p.paymentStatus === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || (
      (p.userName ?? '').toLowerCase().includes(q) ||
      (p.userEmail ?? '').toLowerCase().includes(q) ||
      (p.packageName === 'Welcome Journey' ? 'welcome package' : (p.packageName ?? p.adminNotes ?? '')).toLowerCase().includes(q) ||
      (p.invoiceNumber ?? '').toLowerCase().includes(q)
    );
    return matchesStatus && matchesSearch;
  }), [purchases, statusFilter, searchQuery]);

  async function handleMarkPaid(id: string, notes: string) {
    try {
      const res = await fetch('/api/admin/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId: id, paymentStatus: 'paid', adminNotes: notes }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? 'Failed'); }
      await loadPurchases();
      showToast('Payment marked as paid.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update payment', 'error');
    }
  }

  async function handleDownload(purchaseId: string, invoiceNumber: string | null) {
    try {
      showToast('Generating PDF…', 'info');
      const res = await fetch(`/api/admin/purchases/${purchaseId}/invoice`);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? 'Failed'); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Invoice-${invoiceNumber ?? purchaseId}.pdf`; a.click();
      URL.revokeObjectURL(url);
      showToast(`Invoice ${invoiceNumber} downloaded.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download invoice', 'error');
    }
  }

  async function handleSendReminder(purchaseId: string, message: string) {
    setReminderLoading(true);
    try {
      const res = await fetch(`/api/admin/purchases/${purchaseId}/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customMessage: message || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setReminderModal(null);
      await loadPurchases();
      showToast('Payment reminder sent.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send reminder', 'error');
    } finally {
      setReminderLoading(false);
    }
  }

  async function handleSendToEmail(purchaseId: string, email: string, message: string) {
    setSendLoading(true);
    try {
      const res = await fetch(`/api/admin/purchases/${purchaseId}/send-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: email, customMessage: message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setSendModal(null);
      await loadPurchases();
      showToast(`Invoice sent to ${email}.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send invoice', 'error');
    } finally {
      setSendLoading(false);
    }
  }

  const filterButtons: { label: string; value: StatusFilter; count?: number }[] = [
    { label: 'All',           value: 'all',            count: stats.total },
    { label: 'Pending',       value: 'pending',         count: stats.pending },
    { label: 'Paid',          value: 'paid',            count: stats.paid },
    { label: 'Overdue',       value: 'overdue',         count: stats.overdue },
    { label: 'Studio / Transfer', value: 'pay_at_studio' },
  ];

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {reminderModal && (
        <InvoiceReminderModal
          purchase={reminderModal}
          onConfirm={handleSendReminder}
          onClose={() => setReminderModal(null)}
          loading={reminderLoading}
        />
      )}
      {sendModal && (
        <SendInvoiceModal
          purchase={sendModal}
          onSend={handleSendToEmail}
          onClose={() => setSendModal(null)}
          loading={sendLoading}
        />
      )}
      {addModalOpen && (
        <AddManualPaymentModal
          onClose={() => setAddModalOpen(false)}
          onCreated={() => {
            void loadPurchases();
            showToast('Manual payment created successfully.', 'success');
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[#6b3d32] text-sm font-medium">Financial Overview</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#4e2b22]">Payment Management</h1>
          <p className="mt-1.5 text-[#6b3d32] text-sm">
            Manage credit purchases, track payments, download invoices, and send reminders
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-br from-[#4e2b22] to-[#6b3d32] px-4 py-2.5 text-xs font-semibold text-[#faf9f7] shadow-[0_4px_14px_rgba(78,43,34,0.2)] transition hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="size-3.5" />
          Add Payment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Total"   value={stats.total}   subtitle="All time"                                 color="primary" />
        <StatCard title="Paid"    value={stats.paid}    subtitle={formatPrice(stats.totalRevenue, 'eur')}   color="success" />
        <StatCard title="Pending" value={stats.pending} subtitle="Awaiting payment"                         color="warning" />
        <StatCard title="Overdue" value={stats.overdue} subtitle={`${formatPrice(stats.outstanding, 'eur')} outstanding`} color="danger" />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#8b6b5c]" />
          <input type="search" placeholder="Search name, email, package, or invoice number…"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none transition-colors text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          <Filter className="size-4 text-[#8b6b5c] shrink-0" />
          {filterButtons.map((btn) => (
            <button key={btn.value} type="button" onClick={() => setStatusFilter(btn.value)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all active:scale-95',
                statusFilter === btn.value
                  ? 'bg-[#4e2b22] text-[#faf9f7] shadow-sm'
                  : 'border border-[#ede8e5] text-[#6b3d32] hover:border-[#c4a88a] hover:text-[#4e2b22]',
              )}>
              {btn.label}
              {btn.count !== undefined && (
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  statusFilter === btn.value ? 'bg-white/20 text-white' : 'bg-[#ede8e5] text-[#6b3d32]',
                )}>{btn.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {!loading && (
        <p className="text-xs text-[#8b6b5c]">
          {filteredPurchases.length === 0 ? 'No results' : `Showing ${filteredPurchases.length} of ${purchases.length} purchases`}
        </p>
      )}

      {/* Purchase list */}
      <div className="space-y-3">
        {loading ? (
          <LoadingSkeleton />
        ) : filteredPurchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-[#ede8e5]/60">
              <Search className="size-7 text-[#c4a88a]" />
            </div>
            <p className="text-sm font-semibold text-[#4e2b22]">No purchases found</p>
            <p className="mt-1 text-xs text-[#8b6b5c]">Try adjusting your search or filter</p>
          </div>
        ) : (
          filteredPurchases.map((purchase) => (
            <PurchaseRow
              key={purchase.id}
              purchase={purchase}
              onMarkPaid={handleMarkPaid}
              onDownload={handleDownload}
              onSendReminder={setReminderModal}
              onSendToEmail={setSendModal}
            />
          ))
        )}
      </div>
    </div>
  );
}
