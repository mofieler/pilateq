import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { startOfMonth, endOfMonth } from 'date-fns';
import { getStudioConfig } from '@/lib/studio/server';
import { ALL_PLUGINS } from '@/lib/plugins/registry';
import {
  listClassPassCheckinsAction,
  getClassPassReconciliationSummaryAction,
} from '@/modules/classpass/actions/classPass.actions';
import { ClassPassCheckinTable } from '@/modules/classpass/components/ClassPassCheckinTable';
import { ClassPassSummaryCards } from '@/modules/classpass/components/ClassPassSummaryCards';

export default async function ClassPassesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'admin') redirect('/admin');

  const studioConfig = await getStudioConfig();
  const classPassProviders = ALL_PLUGINS.filter((p) => p.type === 'classpass');

  const from = startOfMonth(new Date());
  const to = endOfMonth(new Date());

  const [checkins, summary] = await Promise.all([
    listClassPassCheckinsAction({ from, to }),
    getClassPassReconciliationSummaryAction(from, to),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Class Pass Check-ins</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track and reconcile external partner check-ins for this month.
        </p>
      </div>

      <ClassPassSummaryCards summary={summary} providers={classPassProviders} />

      <ClassPassCheckinTable
        checkins={checkins}
        providers={classPassProviders.map((p) => ({ key: p.key, label: p.displayName }))}
      />
    </div>
  );
}
