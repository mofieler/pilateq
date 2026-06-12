import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { getAdminUserCreditOverviewAction } from '@/modules/billing/actions/adminCredits.actions';
import { UserCreditsClient } from '@/modules/billing/components/UserCreditsClient';

export default async function AdminUserCreditsPage() {
  const session = await auth();
  if (session?.user?.role === 'instructor') redirect('/admin/classes');
  const result = await getAdminUserCreditOverviewAction();
  const users  = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[#6b3d32] text-sm">Admin · Billing</p>
        <h1 className="mt-1 text-3xl font-bold text-[#4e2b22]">Credit Management</h1>
        <p className="mt-2 text-[#6b3d32] text-sm">
          View student credit balances, add or remove credits, and review the full adjustment audit log.
        </p>
      </div>

      {!result.success && (
        <div className="rounded-xl border border-[#c45c4a]/30 bg-[#c45c4a]/10 px-4 py-3 text-sm text-[#c45c4a]">
          Failed to load users: {result.error}
        </div>
      )}

      <UserCreditsClient users={users} />
    </div>
  );
}
