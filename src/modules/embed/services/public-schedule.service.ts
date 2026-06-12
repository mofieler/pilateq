import { addDays } from 'date-fns';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { classSessions, classTemplates } from '@/db/schema';
import { startOfStudioDay } from '@/lib/utils/date.utils';
import type { ClassSessionCardProps } from '@/modules/booking/components/ClassSessionCard';
import type { PublicScheduleSession } from '@/modules/embed/types';
import type { ClassType, CreditType } from '@/lib/config/class-types';

const EMBED_HORIZON_DAYS = 21;

function toPublicSession(row: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  bookedCount: number;
  maxCapacity: number;
  status: PublicScheduleSession['status'];
  template: {
    name: string;
    classType: ClassType;
    durationMinutes: number;
    creditCost: number;
    creditType: CreditType;
    location: string | null;
  } | null;
  instructor: { user: { name: string | null } | null } | null;
}): PublicScheduleSession {
  return {
    id: row.id,
    name: row.template?.name ?? 'Class',
    classType: row.template?.classType ?? 'mat_group',
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    durationMinutes: row.template?.durationMinutes ?? 60,
    instructorName: row.instructor?.user?.name ?? 'TBA',
    location: row.template?.location ?? null,
    bookedCount: row.bookedCount,
    maxCapacity: row.maxCapacity,
    creditCost: row.template?.creditCost ?? 1,
    creditType: (row.template?.creditType ?? 'pass') as CreditType,
    status: row.status,
  };
}

/**
 * Loads scheduled public classes for the embed widget (no auth).
 * Excludes Welcome Journey intro sessions — those use a separate booking flow.
 *
 * Sessions are strictly scoped to the resolved studioId so a public embed or
 * API consumer cannot leak another tenant's schedule.
 */
export async function getPublicScheduleSessions(
  studioId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<PublicScheduleSession[]> {
  const rows = await db.query.classSessions.findMany({
    with: {
      template: true,
      instructor: { with: { user: true } },
    },
    where: and(
      eq(classSessions.studioId, studioId),
      gte(classSessions.startsAt, rangeStart),
      lt(classSessions.startsAt, rangeEnd),
      eq(classSessions.status, 'scheduled'),
      sql`NOT EXISTS (
        SELECT 1 FROM ${classTemplates} ct
        WHERE ct.id = ${classSessions.templateId}
          AND ct.is_welcome_journey = true
      )`,
    ),
    orderBy: (s, { asc }) => [asc(s.startsAt)],
  });

  return rows.map(toPublicSession);
}

/** Default rolling window used when no week is specified. */
export function getDefaultEmbedRange(): { from: Date; to: Date } {
  const from = startOfStudioDay();
  const to = addDays(from, EMBED_HORIZON_DAYS);
  return { from, to };
}

export function publicSessionsToCardProps(
  sessions: PublicScheduleSession[],
): ClassSessionCardProps[] {
  return sessions.map((s) => ({
    id: s.id,
    name: s.name,
    classType: s.classType,
    startsAt: new Date(s.startsAt),
    durationMinutes: s.durationMinutes,
    instructorName: s.instructorName,
    instructorAvatarUrl: null,
    vibeTags: [],
    bookedCount: s.bookedCount,
    maxCapacity: s.maxCapacity,
    creditCost: s.creditCost,
    creditType: s.creditType,
    status: s.status,
    isBookedByUser: false,
    location: s.location,
  }));
}
