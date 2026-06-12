import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getTaxSummaryAction } from '@/modules/billing/actions/taxSummary.actions';
import { TaxSummaryCards } from './components/TaxSummaryCards';
import { MonthlyBreakdownTable } from './components/MonthlyBreakdownTable';
import { InvoiceRegistryTable } from './components/InvoiceRegistryTable';
import { TaxYearPicker } from './components/TaxYearPicker';

interface Props {
  searchParams: Promise<{ year?: string }>;
}

async function TaxContent({ year }: { year: number }) {
  const result = await getTaxSummaryAction(year);

  if (!result.success || !result.data) {
    return (
      <div className="rounded-2xl border border-[#c45c4a]/30 bg-[#c45c4a]/5 p-6 text-center">
        <p className="text-sm text-[#c45c4a]">{result.error ?? 'Failed to load tax data'}</p>
      </div>
    );
  }

  const { data } = result;

  return (
    <div className="space-y-6">
      <TaxSummaryCards data={data} />
      <MonthlyBreakdownTable months={data.monthlyBreakdown} />
      <InvoiceRegistryTable entries={data.invoiceRegistry} />
    </div>
  );
}

export default async function AdminTaxPage({ searchParams }: Props) {
  const session = await auth();
  if (session?.user?.role === 'instructor') redirect('/admin/classes');
  const { year: yearParam } = await searchParams;
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  const safeYear = isNaN(year) ? new Date().getFullYear() : year;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[#6b3d32] text-sm font-medium">Accounting</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#4e2b22]">Tax Overview</h1>
        <p className="mt-1.5 text-[#6b3d32] text-sm">
          Annual revenue summary and invoice registry for your accountant
        </p>
      </div>

      {/* Year picker + export — client island */}
      <Suspense fallback={null}>
        <TaxYearPicker year={safeYear} />
      </Suspense>

      {/* Data sections */}
      <Suspense
        fallback={
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-2xl bg-linear-to-br from-[#ede8e5]/40 to-[#e5dfdb]/30 animate-pulse" />
            ))}
          </div>
        }
      >
        <TaxContent year={safeYear} />
      </Suspense>
    </div>
  );
}
