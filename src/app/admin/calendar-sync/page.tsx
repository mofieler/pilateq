import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { calendarConnections, instructors, users } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { listAccessibleCalendars } from '@/modules/calendar/services/google-calendar.client';
import {
  CalendarConnectionPanel,
  type ConnectionState,
  type AccessibleCalendar,
} from '@/modules/calendar/components/CalendarConnectionPanel';
import { ConnectCalendarButton } from '@/modules/calendar/components/ConnectCalendarButton';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ connected?: string; error?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Access was denied.',
  missing_params: 'Google did not return an authorisation code.',
  invalid_state: 'Security check failed — please try again.',
  token_exchange: 'Token exchange failed. Please try again.',
};

async function loadConnectionsForUser(opts: {
  currentUserId: string;
  isAdmin: boolean;
}): Promise<ConnectionState[]> {
  // Admins see ALL connections; instructors see only their own.
  const rows = await db
    .select({
      connection: calendarConnections,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(calendarConnections)
    .innerJoin(users, and(eq(calendarConnections.userId, users.id), isNull(users.deletedAt)))
    .where(opts.isAdmin ? undefined : eq(calendarConnections.userId, opts.currentUserId));

  const results: ConnectionState[] = [];
  for (const row of rows) {
    let calendars: AccessibleCalendar[] = [];
    let loadError: string | null = null;
    try {
      calendars = await listAccessibleCalendars(row.connection);
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
    }
    results.push({
      id: row.connection.id,
      ownerName: row.ownerName,
      ownerEmail: row.ownerEmail,
      googleAccountEmail: row.connection.googleAccountEmail,
      selectedCalendarId: row.connection.selectedCalendarId,
      selectedCalendarName: row.connection.selectedCalendarName,
      syncEnabled: row.connection.syncEnabled,
      lastSyncAt: row.connection.lastSyncAt,
      lastSyncError: row.connection.lastSyncError,
      calendars,
      loadError,
      isCurrentUser: row.connection.userId === opts.currentUserId,
    });
  }
  return results;
}

async function loadUnconnectedInstructors() {
  // Instructors that have a user record but no calendar_connection.
  // Only useful for the admin view.
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
    })
    .from(instructors)
    .innerJoin(users, and(eq(instructors.userId, users.id), isNull(users.deletedAt)))
    .leftJoin(calendarConnections, eq(calendarConnections.userId, users.id))
    .where(and(eq(instructors.isActive, true), isNull(calendarConnections.id)));
  return rows;
}

export default async function CalendarSyncPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const role = session.user.role as string | undefined;
  if (role !== 'admin' && role !== 'instructor') redirect('/');

  const { connected, error } = await searchParams;
  const isAdmin = role === 'admin';

  const connections = await loadConnectionsForUser({
    currentUserId: session.user.id,
    isAdmin,
  });
  const unconnectedInstructors = isAdmin ? await loadUnconnectedInstructors() : [];

  // Does the current user already have a connection?
  const currentUserHasConnection = connections.some((c) => c.isCurrentUser);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#4e2b22]">Google Calendar Sync</h1>
        <p className="mt-1 text-sm text-[#6b3d32]">
          Connect your Google Calendar so {APP_CONFIG.APP_NAME} classes are automatically added and private
          appointments appear as blocked slots in the booking UI.
        </p>
      </div>

      {connected === '1' && (
        <div className="flex items-start gap-2 rounded-xl bg-success/10 border border-success/30 p-4 text-sm text-success">
          <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Successfully connected!</p>
            <p className="text-success/80">
              Select the calendar to sync with below.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-error/10 border border-error/30 p-4 text-sm text-error">
          <AlertCircle className="size-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Connection error</p>
            <p className="text-error/80">{ERROR_MESSAGES[error] ?? error}</p>
          </div>
        </div>
      )}

      {/* Current user's connection (or connect button) */}
      {!currentUserHasConnection && (
        <div className="rounded-2xl border border-dashed border-[#c4a88a]/60 bg-[#faf9f7]/50 p-6 text-center">
          <p className="text-sm text-[#6b3d32] mb-3">
            You haven&apos;t connected your Google Calendar yet.
          </p>
          <ConnectCalendarButton />
          <p className="mt-3 text-xs text-[#8b6b5c]">
            Required scope:&nbsp;
            <code className="rounded bg-[#ede8e5] px-1.5 py-0.5">
              https://www.googleapis.com/auth/calendar
            </code>
          </p>
        </div>
      )}

      {/* All visible connections */}
      {connections.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {connections.map((c) => (
            <CalendarConnectionPanel key={c.id} connection={c} />
          ))}
        </div>
      )}

      {/* Admin view: unconnected instructors */}
      {isAdmin && unconnectedInstructors.length > 0 && (
        <div className="rounded-2xl border border-[#ede8e5] bg-[#faf9f7] p-5">
          <h2 className="text-base font-semibold text-[#4e2b22] mb-1">
            Instructors without a connected calendar
          </h2>
          <p className="text-xs text-[#8b6b5c] mb-3">
            These instructors have not yet connected a Google Calendar. They need to log in and
            click the connect button themselves.
          </p>
          <ul className="space-y-1.5">
            {unconnectedInstructors.map((i) => (
              <li
                key={i.userId}
                className="flex items-center justify-between text-sm rounded-lg bg-white border border-[#ede8e5] px-3 py-2"
              >
                <span className="text-[#4e2b22] font-medium">{i.name}</span>
                <span className="text-xs text-[#8b6b5c]">{i.email}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl bg-[#ede8e5]/40 p-5 text-xs text-[#6b3d32] space-y-1.5">
        <p className="font-semibold text-[#4e2b22]">How does the sync work?</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>{APP_CONFIG.APP_NAME} → Google:</strong> Classes assigned to you appear immediately in your
            selected calendar with the current attendee list.
          </li>
          <li>
            <strong>Google → {APP_CONFIG.APP_NAME}:</strong> Events you add to your calendar block the
            corresponding slot in the booking UI (synced every 5 minutes).
          </li>
          <li>
            <strong>Note:</strong> {APP_CONFIG.APP_NAME}-managed events are marked with{' '}
            <code className="rounded bg-white px-1">[{APP_CONFIG.APP_NAME}]</code> and should not be edited in
            Google Calendar — the next sync will overwrite any manual changes.
          </li>
        </ul>
      </div>
    </div>
  );
}
