import { cn } from '@/lib/utils';
import type { TaxSummary } from '@/modules/billing/actions/taxSummary.actions';

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function Card({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: 'success' | 'primary' | 'warning' | 'danger';
}) {
  const styles = {
    success: 'from-[#6b8e6b]/10 to-[#6b8e6b]/5 border-[#6b8e6b]/15',
    primary: 'from-[#4e2b22]/10 to-[#6b3d32]/5 border-[#4e2b22]/10',
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

export function TaxSummaryCards({ data }: { data: TaxSummary }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <Card
        title="Total Revenue"
        value={formatPrice(data.totalRevenueCents)}
        subtitle={`${data.paidInvoiceCount} paid invoices`}
        color="success"
      />
      <Card
        title="Invoices Issued"
        value={String(data.invoiceCount)}
        subtitle={`${data.year} fiscal year`}
        color="primary"
      />
      <Card
        title="Outstanding"
        value={formatPrice(data.totalOutstandingCents)}
        subtitle="Pending + overdue"
        color="warning"
      />
      <Card
        title="Overdue"
        value={formatPrice(data.totalOverdueCents)}
        subtitle={data.totalOverdueCents > 0 ? 'Requires follow-up' : 'All clear'}
        color={data.totalOverdueCents > 0 ? 'danger' : 'success'}
      />
    </div>
  );
}
