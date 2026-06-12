import { NextResponse } from 'next/server';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { z } from 'zod';
import { headers } from 'next/headers';
import {
  getDefaultEmbedRange,
  getPublicScheduleSessions,
} from '@/modules/embed/services/public-schedule.service';
import { getEmbedBookingBaseUrl } from '@/modules/embed/lib/booking-links';
import { startOfStudioDay } from '@/lib/utils/date.utils';
import { resolveStudioFromHostname } from '@/lib/studio/server';
import type { PublicScheduleResponse } from '@/modules/embed/types';

/** Public JSON; middleware does not run on `/api/*`, so CORS is set here only. */
function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin');
  const allowList = process.env.EMBED_SCHEDULE_CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);

  const base: HeadersInit = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };

  // Only reflect an origin when it is explicitly present in the allow-list.
  // If no allow-list is configured, the endpoint defaults to same-origin
  // (no CORS headers) and never falls back to '*' or the request origin.
  if (allowList?.length && origin && allowList.includes(origin)) {
    return { ...base, 'Access-Control-Allow-Origin': origin };
  }

  return base;
}

const querySchema = z.object({
  week: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ week: searchParams.get('week') ?? undefined });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid week parameter' },
      { status: 400, headers: corsHeaders(request) },
    );
  }

  let rangeStart: Date;
  let rangeEnd: Date;
  let weekStart: Date;

  if (parsed.data.week) {
    weekStart = startOfWeek(parseISO(parsed.data.week), { weekStartsOn: 1 });
    rangeStart = weekStart;
    rangeEnd = addDays(weekStart, 14);
  } else {
    const def = getDefaultEmbedRange();
    rangeStart = def.from;
    rangeEnd = def.to;
    weekStart = startOfWeek(startOfStudioDay(), { weekStartsOn: 1 });
  }

  // Resolve the tenant from the request hostname. Public schedules MUST be
  // scoped to a real studio row; the env/file fallback is not a valid tenant.
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost';
  const studio = await resolveStudioFromHostname(host);

  if (!studio) {
    return NextResponse.json(
      { error: 'Studio not found' },
      { status: 404, headers: corsHeaders(request) },
    );
  }

  const sessions = await getPublicScheduleSessions(studio.id, rangeStart, rangeEnd);

  const body: PublicScheduleResponse = {
    weekStart: format(weekStart, 'yyyy-MM-dd'),
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    sessions,
    bookingBaseUrl: getEmbedBookingBaseUrl(),
    studioName: studio.name,
  };

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      ...corsHeaders(request),
    },
  });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}
