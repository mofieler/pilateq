import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { subDays } from 'date-fns';
import {
  getSummaryStatsAction,
  getActivityFeedAction,
  getStudentListAction,
} from '@/modules/statistics/actions/statistics.actions';
import { StatisticsPageClient } from '@/modules/statistics/components/StatisticsPageClient';

export default async function StatisticsPage() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'admin') {
    redirect('/admin');
  }

  // Fetch initial data in parallel — 30-day window for activity
  const fromDate = subDays(new Date(), 30);

  const [stats, activity, students] = await Promise.all([
    getSummaryStatsAction(),
    getActivityFeedAction(fromDate),
    getStudentListAction(),
  ]);

  return (
    <StatisticsPageClient
      stats={stats}
      activity={activity}
      students={students}
      defaultFromDate={fromDate}
    />
  );
}
