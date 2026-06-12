import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { getCreditPackagesAction } from '@/modules/billing/actions/creditPackage.actions';
import { CreditPackagesManager } from '@/modules/billing/components/CreditPackagesManager';

export default async function CreditsPage() {
  const session = await auth();
  if (session?.user?.role === 'instructor') redirect('/admin/classes');
  const packagesResult = await getCreditPackagesAction();

  const packages = packagesResult.success ? packagesResult.data : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Credit Packages</h1>
        <p className="mt-1 text-sm text-slate-500">
          Define what students can purchase. Choose Credit (group classes) or Session (private 1:1) for each package.
        </p>
      </div>

      {/* Error State - only show if there's an actual error and packages exist */}
      {!packagesResult.success && packages.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load packages: {packagesResult.error}
        </div>
      )}

      <CreditPackagesManager packages={packages} />
    </div>
  );
}
