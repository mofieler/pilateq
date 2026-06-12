import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { getMembershipPlansAction, getActiveMembershipsAction, getStudentsListAction } from '@/modules/billing/actions/membership.actions';
import { MembershipsAdminClient } from '@/modules/billing/components/MembershipsAdminClient';

export const metadata = { title: 'Memberships — Admin' };

export default async function AdminMembershipsPage() {
  const session = await auth();
  if (session?.user?.role === 'instructor') redirect('/admin/classes');
  const [plansRes, membershipsRes, studentsRes] = await Promise.all([
    getMembershipPlansAction(),
    getActiveMembershipsAction(),
    getStudentsListAction(),
  ]);

  return (
    <MembershipsAdminClient
      plans={plansRes.data ?? []}
      memberships={membershipsRes.data ?? []}
      students={studentsRes.data ?? []}
    />
  );
}
