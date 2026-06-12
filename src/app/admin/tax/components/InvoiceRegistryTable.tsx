import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { InvoiceRegistryEntry } from '@/modules/billing/actions/taxSummary.actions';

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-DE', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  paid:      { label: 'Paid',      color: 'bg-[#6b8e6b]/15 text-[#4a7c4a] border-[#6b8e6b]/30', icon: CheckCircle },
  pending:   { label: 'Pending',   color: 'bg-[#d4a574]/15 text-[#b58a5c] border-[#d4a574]/30', icon: Clock },
  overdue:   { label: 'Overdue',   color: 'bg-[#c45c4a]/15 text-[#c45c4a] border-[#c45c4a]/30', icon: AlertTriangle },
  cancelled: { label: 'Cancelled', color: 'bg-[#ede8e5] text-[#8b6b5c] border-[#ede8e5]',        icon: XCircle },
  failed:    { label: 'Failed',    color: 'bg-[#8b6b5c]/15 text-[#8b6b5c] border-[#8b6b5c]/30', icon: XCircle },
};

export function InvoiceRegistryTable({ entries }: { entries: InvoiceRegistryEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-[#ede8e5] p-10 text-center">
        <p className="text-sm text-[#8b6b5c]">No invoices issued this year</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#ede8e5] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#ede8e5] bg-[#faf9f7]">
        <h2 className="font-semibold text-[#4e2b22]">Invoice Registry</h2>
        <p className="text-xs text-[#8b6b5c] mt-0.5">{entries.length} invoices · §14 UStG</p>
      </div>

      {/* Desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#ede8e5] bg-[#faf9f7]/60">
              {['Invoice No.', 'Date', 'Client', 'Package', 'Amount', 'Status', 'Paid'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#8b6b5c] uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ede8e5]/60">
            {entries.map((e) => {
              const cfg = STATUS_CONFIG[e.paymentStatus] ?? STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              return (
                <tr key={e.id} className="hover:bg-[#faf9f7] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#6b3d32]">{e.invoiceNumber}</td>
                  <td className="px-4 py-3 text-[#4e2b22] whitespace-nowrap">
                    {format(new Date(e.invoiceDate), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#4e2b22] truncate max-w-[120px]">{e.clientName ?? '—'}</p>
                    {e.clientEmail && (
                      <p className="text-xs text-[#8b6b5c] truncate max-w-[120px]">{e.clientEmail}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#6b3d32] truncate max-w-[100px]">{e.packageName ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold text-[#4e2b22] whitespace-nowrap">
                    {formatPrice(e.priceCents, e.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn('rounded-full text-xs', cfg.color)}>
                      <Icon className="size-3 mr-1" />
                      {cfg.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[#4e2b22] whitespace-nowrap">
                    {e.paidAt ? format(new Date(e.paidAt), 'MMM d, yyyy') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="sm:hidden divide-y divide-[#ede8e5]/60">
        {entries.map((e) => {
          const cfg = STATUS_CONFIG[e.paymentStatus] ?? STATUS_CONFIG.pending;
          const Icon = cfg.icon;
          return (
            <div key={e.id} className="px-4 py-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-[#6b3d32]">{e.invoiceNumber}</p>
                  <p className="text-sm font-medium text-[#4e2b22]">{e.clientName ?? '—'}</p>
                  <p className="text-xs text-[#8b6b5c]">{format(new Date(e.invoiceDate), 'MMM d, yyyy')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-[#4e2b22]">{formatPrice(e.priceCents, e.currency)}</p>
                  <Badge variant="outline" className={cn('rounded-full text-[10px] mt-1', cfg.color)}>
                    <Icon className="size-2.5 mr-0.5" />
                    {cfg.label}
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
