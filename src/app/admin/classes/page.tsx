import { addDays } from 'date-fns';
import { startOfStudioDay } from '@/lib/utils/date.utils';
import { auth } from '@/lib/auth/auth';
import { db } from '@/db';
import { instructors as instructorsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  getSessionsForRangeAction,
  getClassTemplatesAdminAction,
  getInstructorsAction,
  type AdminTemplateRow,
} from '@/modules/classes/actions/class.actions';
import {
  SessionsDataTable,
  type SessionRow,
} from '@/modules/classes/components/SessionsDataTable';
import { ClassTemplatesManager } from '@/modules/classes/components/ClassTemplatesManager';
import { ClassesPageClient } from '@/modules/classes/components/ClassesPageClient';
import { getBlocksInRange } from '@/modules/calendar/services/calendar-sync.service';
import { Package2Icon } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────

export default async function ClassesPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === 'admin';

  let myInstructorId: string | null = null;
  if (session?.user?.role === 'instructor') {
    const [row] = await db
      .select({ id: instructorsTable.id })
      .from(instructorsTable)
      .where(eq(instructorsTable.userId, session.user.id))
      .limit(1);
    myInstructorId = row?.id ?? null;
  }

  const from = addDays(startOfStudioDay(), -14);
  const to = addDays(startOfStudioDay(), 84); // 12 weeks forward

  const studioId = session?.user?.studioId;
  const [sessionsResult, templatesResult, instructorsResult, gcalBlocks] = await Promise.all([
    getSessionsForRangeAction(from, to),
    getClassTemplatesAdminAction(),
    getInstructorsAction(),
    studioId ? getBlocksInRange(from, to, studioId).catch(() => []) : Promise.resolve([]),
  ]);

  const sessions = sessionsResult.success ? sessionsResult.data : [];
  const templates = templatesResult.success ? templatesResult.data : [];
  const instructors = instructorsResult.success ? instructorsResult.data : [];
  const hasTemplates = templates.length > 0;

  // Map gcalBlocks to the serialisable shape we pass to the client
  const blocks = gcalBlocks.map((b) => ({
    id: b.id,
    instructorId: b.instructorId ?? null,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    summary: b.summary ?? null,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Classes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage class templates and schedule sessions
          {sessionsResult.success && ` · ${sessions.length} sessions`}
        </p>
      </div>

      {/* Templates Section — admin only */}
      {isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#4e2b22]">Class Templates</h2>
            {hasTemplates && (
              <p className="text-sm text-[#8b6b5c]">
                {templates.length} template{templates.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {!hasTemplates && (
            <div className="rounded-xl border border-[#ede8e5]/50 bg-linear-to-br from-[#faf9f7] to-[#f5f3f1] p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#c4a88a]/20 mb-4">
                <Package2Icon className="w-8 h-8 text-[#c4a88a]" />
              </div>
              <h2 className="text-xl font-semibold text-[#4e2b22] mb-2">No Class Templates Yet</h2>
              <p className="text-[#6b3d32] text-sm max-w-sm mx-auto">
                Create class templates first before scheduling sessions.
              </p>
            </div>
          )}

          {hasTemplates && (
            <ClassTemplatesManager templates={templates} instructors={instructors} />
          )}
        </div>
      )}

      {/* Scheduled Classes — week view + list toggle */}
      <div className="space-y-4">
        <ClassesPageClient
          sessions={sessions}
          gcalBlocks={blocks}
          templates={templates}
          instructors={instructors}
          hasTemplates={hasTemplates}
          isAdmin={isAdmin}
          myInstructorId={myInstructorId}
        />
      </div>
    </div>
  );
}
