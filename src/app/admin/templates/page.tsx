import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import {
  getClassTemplatesAdminAction,
  getInstructorsAction,
} from '@/modules/classes/actions/class.actions';
import { ClassTemplatesManager } from '@/modules/classes/components/ClassTemplatesManager';

export default async function ClassTemplatesPage() {
  const session = await auth();
  if (session?.user?.role === 'instructor') redirect('/admin/classes');
  const [templatesResult, instructorsResult] = await Promise.all([
    getClassTemplatesAdminAction(),
    getInstructorsAction(),
  ]);

  const templates    = templatesResult.success    ? templatesResult.data    : [];
  const instructors  = instructorsResult.success  ? instructorsResult.data  : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Class Templates</h1>
        <p className="mt-1 text-sm text-slate-500">
          Templates define class types, duration, capacity, and how many credits are deducted per booking.
          Sessions are scheduled from a template.
        </p>
      </div>

      {!templatesResult.success && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load templates: {templatesResult.error}
        </div>
      )}

      <ClassTemplatesManager templates={templates} instructors={instructors} />
    </div>
  );
}
