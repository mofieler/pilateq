import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { getInstructorsAction } from '@/modules/instructors/actions/instructor.actions';
import { InstructorsManager } from '@/modules/instructors/components/InstructorsManager';

export default async function InstructorsPage() {
  const session = await auth();
  if (session?.user?.role === 'instructor') redirect('/admin/classes');

  const result = await getInstructorsAction();
  const instructors = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Instructors</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage teachers, their bios, contact details, and active status.
        </p>
      </div>

      {!result.success && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load instructors: {result.error}
        </div>
      )}

      <InstructorsManager instructors={instructors} />
    </div>
  );
}
