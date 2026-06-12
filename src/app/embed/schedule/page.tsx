import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { notFound } from 'next/navigation';
import {
  getDefaultEmbedRange,
  getPublicScheduleSessions,
  publicSessionsToCardProps,
} from '@/modules/embed/services/public-schedule.service';
import { getEmbedBookingBaseUrl } from '@/modules/embed/lib/booking-links';
import { EmbedScheduleClient } from '@/modules/embed/components/EmbedScheduleClient';
import { startOfStudioDay } from '@/lib/utils/date.utils';
import { getStudioConfigContext } from '@/lib/studio/server';

export const revalidate = 60;

type PageProps = {
  searchParams: Promise<{ date?: string; locale?: string; 'hide-spots'?: string }>;
};

function parseWeekStart(dateParam: string | undefined): Date {
  if (!dateParam) return startOfWeek(startOfStudioDay(), { weekStartsOn: 1 });
  try {
    return startOfWeek(parseISO(dateParam), { weekStartsOn: 1 });
  } catch {
    return startOfWeek(startOfStudioDay(), { weekStartsOn: 1 });
  }
}

export default async function EmbedSchedulePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const weekStart = parseWeekStart(params.date);
  const locale = params.locale || 'en';
  const hideSpots = params['hide-spots'] === '1' || params['hide-spots'] === 'true';

  // Resolve the tenant from the request hostname. The embed page must not
  // leak another studio's schedule if no real tenant can be resolved.
  const studioCtx = await getStudioConfigContext();
  if (!studioCtx.config.id) {
    notFound();
  }
  const studioId = studioCtx.config.id;

  // Fetch a generous rolling window so prev/next navigation always has data.
  // The `date` param only controls which week is initially highlighted.
  const today = startOfStudioDay();
  const rangeStart = startOfWeek(today, { weekStartsOn: 1 });
  const rangeEnd = addDays(rangeStart, 28);

  const [sessions, bookingBaseUrl] = await Promise.all([
    getPublicScheduleSessions(studioId, rangeStart, rangeEnd),
    Promise.resolve(getEmbedBookingBaseUrl()),
  ]);

  const cardSessions = publicSessionsToCardProps(sessions);

  return (
    <EmbedScheduleClient
      sessions={cardSessions}
      bookingBaseUrl={bookingBaseUrl}
      locale={locale}
      hideSpots={hideSpots}
    />
  );
}
