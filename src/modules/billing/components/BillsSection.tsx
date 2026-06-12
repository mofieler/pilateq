'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronDownIcon, ChevronUpIcon, FileText, Clock, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Bill {
  id: string;
  invoiceNumber?: string;
  creditsAmount: number;
  priceCents: number;
  currency: string;
  paymentDueDate?: string;
  daysUntilDue?: number;
  isOverdue: boolean;
  status: 'open' | 'paid' | 'overdue';
  createdAt: string;
  paidAt?: string;
  packageName?: string;
  itemType?: 'package' | 'membership' | 'welcome_journey';
}

interface BillsSectionProps {
  isOpen?: boolean;
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

// Constants for better maintainability
const BILL_STATUS_CONFIG = {
  open: {
    color: 'bg-[#d4a574]/10 text-[#d4a574] border-[#d4a574]/20',
    label: 'Open'
  },
  paid: {
    color: 'bg-[#6b8e6b]/10 text-[#6b8e6b] border-[#6b8e6b]/20',
    label: 'Paid'
  },
  overdue: {
    color: 'bg-[#c45c4a]/10 text-[#c45c4a] border-[#c45c4a]/20',
    label: 'Overdue'
  }
} as const;

function BillCard({ bill, isExpanded, onToggle }: { 
  bill: Bill; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const statusConfig = BILL_STATUS_CONFIG[bill.status] || BILL_STATUS_CONFIG.open;

  return (
    <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#ede8e5]/60 overflow-hidden">
      {/* Bill Header */}
      <button
        type="button"
        className="w-full text-left p-5 cursor-pointer transition-all active:bg-[#ede8e5]/30 hover:bg-[#ede8e5]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2 rounded-t-2xl"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/60">
              {bill.status === 'paid' ? (
                <CheckCircle className="size-5 text-[#6b8e6b]" />
              ) : bill.isOverdue ? (
                <AlertCircle className="size-5 text-[#c45c4a]" />
              ) : (
                <FileText className="size-5 text-[#6b3d32]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm sm:text-base text-[#4e2b22] truncate">
                {bill.invoiceNumber ? `Invoice ${bill.invoiceNumber}` : 'Bill'} · {bill.packageName === 'Welcome Journey' ? `Welcome Package (${formatPrice(bill.priceCents, bill.currency)})` : bill.itemType === 'membership' ? `Membership: ${bill.packageName || 'Plan'}` : (bill.packageName || `${bill.creditsAmount} credits`)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#6b3d32]">
                <span className="truncate">
                  {bill.packageName === 'Welcome Journey'
                    ? 'Welcome Journey'
                    : bill.itemType === 'membership'
                      ? 'Weekly membership'
                      : bill.packageName
                        ? `${bill.creditsAmount} credits`
                        : 'Credit purchase'}
                </span>
                <span className="text-[#ede8e5]">•</span>
                <Badge
                  variant="outline"
                  className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold leading-none uppercase tracking-wider", statusConfig.color)}
                >
                  {statusConfig.label}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-bold text-sm sm:text-base text-[#4e2b22]">
              {formatPrice(bill.priceCents, bill.currency)}
            </span>
            {isExpanded ? (
              <ChevronUpIcon className="size-4 text-[#6b3d32] shrink-0" />
            ) : (
              <ChevronDownIcon className="size-4 text-[#6b3d32] shrink-0" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out overflow-hidden', isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
        <div className="border-t border-[#ede8e5]/60 bg-[#faf9f7]/50 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[#6b3d32] mb-1">Created</p>
              <p className="font-medium text-[#4e2b22]">
                {format(new Date(bill.createdAt), 'MMM d, yyyy')}
              </p>
            </div>
            {bill.paidAt ? (
              <div>
                <p className="text-[#6b3d32] mb-1">Paid</p>
                <p className="font-medium text-[#6b8e6b]">
                  {format(new Date(bill.paidAt), 'MMM d, yyyy')}
                </p>
              </div>
            ) : bill.paymentDueDate ? (
              <div>
                <p className="text-[#6b3d32] mb-1">Due</p>
                <p className={cn("font-medium", bill.isOverdue ? "text-[#c45c4a]" : "text-[#4e2b22]")}>
                  {format(new Date(bill.paymentDueDate), 'MMM d, yyyy')}
                  {bill.daysUntilDue !== undefined && (
                    <span className="ml-2 text-xs">
                      ({bill.isOverdue ? `${Math.abs(bill.daysUntilDue)}d overdue` : `${bill.daysUntilDue}d remaining`})
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-[#6b3d32] mb-1">Status</p>
                <p className="font-medium text-[#4e2b22]">No due date</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#6b3d32]">{bill.itemType === 'membership' ? 'Type' : 'Package'}</span>
              <span className="font-medium text-[#4e2b22]">{bill.itemType === 'membership' ? 'Membership' : (bill.packageName || 'Credit package')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6b3d32]">{bill.itemType === 'membership' ? 'Plan' : 'Credits'}</span>
              <span className="font-medium text-[#4e2b22]">{bill.itemType === 'membership' ? bill.packageName || 'Membership plan' : `${bill.creditsAmount} credits`}</span>
            </div>
            {bill.itemType !== 'membership' && (
              <div className="flex justify-between text-sm">
                <span className="text-[#6b3d32]">Unit Price</span>
                <span className="font-medium text-[#4e2b22]">
                  {formatPrice(Math.round(bill.priceCents / bill.creditsAmount), bill.currency)} per credit
                </span>
              </div>
            )}
            <div className="border-t border-[#ede8e5]/60 pt-2">
              <div className="flex justify-between">
                <span className="font-semibold text-[#4e2b22]">Total</span>
                <span className="font-bold text-lg text-[#4e2b22]">
                  {formatPrice(bill.priceCents, bill.currency)}
                </span>
              </div>
            </div>
          </div>

          {!bill.paidAt && (
            <div className="rounded-lg bg-[#ede8e5]/60 p-3">
              <p className="text-sm text-[#6b3d32]">
                {bill.isOverdue 
                  ? 'This invoice is overdue. Please settle it at the studio or via bank transfer to resume booking.'
                  : 'Please pay at the studio or via bank transfer by the due date. Both methods are welcome.'
                }
              </p>
            </div>
          )}

          {bill.invoiceNumber && (
            <div className="pt-2 flex justify-end">
              <Button
                variant="boutique"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/api/purchases/${bill.id}/invoice`, '_blank');
                }}
                className="flex items-center gap-1.5"
              >
                <FileText className="size-4" />
                Download PDF
              </Button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

export function BillsSection({ isOpen = false }: BillsSectionProps) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBills, setExpandedBills] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchBills() {
      try {
        setLoading(true);
        const response = await fetch('/api/bills', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch bills: ${response.status}`);
        }
        
        const data = await response.json();
        const fetchedBills: Bill[] = data.bills || [];
        setBills(fetchedBills);
        
        // Auto-expand open/overdue bills by default, leave paid bills collapsed
        const initialExpanded = new Set<string>(
          fetchedBills
            .filter((b) => b.status === 'open' || b.status === 'overdue' || b.isOverdue)
            .map((b) => b.id)
        );
        setExpandedBills(initialExpanded);
      } catch (err) {
        console.error('Failed to fetch bills:', err);
        setError(err instanceof Error ? err.message : 'Failed to load bills');
      } finally {
        setLoading(false);
      }
    }

    if (isOpen) {
      fetchBills();
    }
  }, [isOpen]);

  function toggleBillExpansion(billId: string) {
    setExpandedBills(prev => {
      const newSet = new Set(prev);
      if (newSet.has(billId)) {
        newSet.delete(billId);
      } else {
        newSet.add(billId);
      }
      return newSet;
    });
  }

  if (!isOpen) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 text-sm text-[#6b3d32]">
            <div className="size-4 animate-spin rounded-full border-2 border-[#ede8e5] border-t-[#4e2b22]" />
            Loading bills...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#ede8e5]/60 mb-4">
          <FileText className="w-8 h-8 text-[#c4a88a]" />
        </div>
        <h3 className="text-lg font-semibold text-[#4e2b22] mb-2">No Bills Found</h3>
        <p className="text-[#6b3d32]">You haven't made any credit purchases yet.</p>
      </div>
    );
  }

  // Group bills by status
  const openBills = bills.filter(b => b.status === 'open' || b.isOverdue);
  const paidBills = bills.filter(b => b.status === 'paid');

  return (
    <div className="space-y-8">
      {/* Open Bills */}
      {openBills.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
              <FileText className="size-4" />
            </span>
            <h2 className="text-lg font-semibold text-[#4e2b22]">
              Open Bills
              <span className="ml-2 rounded-full bg-[#4e2b22]/10 px-2.5 py-0.5 text-xs font-semibold text-[#4e2b22]">
                {openBills.length}
              </span>
            </h2>
          </div>
          <div className="space-y-3">
            {openBills.map((bill) => (
              <BillCard
                key={bill.id}
                bill={bill}
                isExpanded={expandedBills.has(bill.id)}
                onToggle={() => toggleBillExpansion(bill.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Paid Bills */}
      {paidBills.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#6b8e6b]/10 text-[#6b8e6b]">
              <CheckCircle className="size-4" />
            </span>
            <h2 className="text-lg font-semibold text-[#4e2b22]">
              Paid Bills
              <span className="ml-2 rounded-full bg-[#6b8e6b]/10 px-2.5 py-0.5 text-xs font-semibold text-[#6b8e6b]">
                {paidBills.length}
              </span>
            </h2>
          </div>
          <div className="space-y-3">
            {paidBills.map((bill) => (
              <BillCard
                key={bill.id}
                bill={bill}
                isExpanded={expandedBills.has(bill.id)}
                onToggle={() => toggleBillExpansion(bill.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
