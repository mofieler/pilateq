import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { db } from '@/db';
import { classSessions, classTemplates, instructors, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { requireStudioId } from '@/lib/studio/studio-context';
import { alias } from 'drizzle-orm/pg-core';
import { generateSessionIcs } from '@/lib/email/ical.utils';
import { checkRateLimit } from '@/lib/security/server-action-rate-limiter';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Rate limit: 10 downloads per minute per user
    const rateLimit = await checkRateLimit(
      { keyPrefix: 'calendar-ics', windowMs: 60_000, maxRequests: 10 },
      session.user.id,
    );
    if (!rateLimit.success) {
      return new NextResponse('Too many requests. Please try again later.', { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) {
      return new NextResponse('Missing sessionId', { status: 400 });
    }

    // Fetch session details with template + instructor
    const instructorUser = alias(users, 'instructor_user');

    const studioId = await requireStudioId();

    const [row] = await db
      .select({
        id: classSessions.id,
        startsAt: classSessions.startsAt,
        endsAt: classSessions.endsAt,
        className: classTemplates.name,
        classType: classTemplates.classType,
        location: classTemplates.location,
        instructorName: instructorUser.name,
      })
      .from(classSessions)
      .leftJoin(classTemplates, and(eq(classSessions.templateId, classTemplates.id), eq(classTemplates.studioId, studioId)))
      .leftJoin(instructors, eq(classSessions.instructorId, instructors.id))
      .leftJoin(instructorUser, and(eq(instructors.userId, instructorUser.id), isNull(instructorUser.deletedAt)))
      .where(and(eq(classSessions.id, sessionId), eq(classSessions.studioId, studioId)))
      .limit(1);

    if (!row) {
      return new NextResponse('Session not found', { status: 404 });
    }

    const icsBuffer = generateSessionIcs(
      row.id,
      'REQUEST',
      'CONFIRMED',
      0,
      row.className ?? 'Pilates Class',
      `Pilates class at ${row.className ?? 'studio'}`,
      row.startsAt,
      row.endsAt,
      row.location ?? undefined,
    );

    return new NextResponse(icsBuffer as unknown as Blob, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${(row.className ?? 'class').replace(/\s+/g, '_')}.ics"`,
      },
    });
  } catch (err) {
    console.error('[api/calendar/download-ics] Error:', err);
    return new NextResponse('Failed to generate calendar file', { status: 500 });
  }
}
