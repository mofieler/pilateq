import { format, parseISO, startOfToday } from 'date-fns';
import {
  ClassSessionCard,
  type ClassSessionCardProps,
} from '@/modules/booking/components/ClassSessionCard';
import { DateScroller, DATE_PARAM } from '@/modules/booking/components/DateScroller';

// ─── Mock data ────────────────────────────────────────────────────────────────

const base = {
  startsAt: new Date('2026-05-05T09:00:00'),
  durationMinutes: 45,
  instructorName: 'Sarah Miller',
  instructorAvatarUrl: null,
  location: 'Studio A',
  creditCost: 3,
  creditType: 'pass' as const,
  status: 'scheduled' as const,
  isBookedByUser: false,
} satisfies Partial<ClassSessionCardProps>;

const MOCK_SESSIONS: ClassSessionCardProps[] = [
  {
    ...base,
    id: 'mock-available',
    name: 'Morning Reformer Flow',
    classType: 'reformer_group',
    vibeTags: ['🎵 Chill House', '💧 Reformer'],
    bookedCount: 3,
    maxCapacity: 10,
    status: 'scheduled',
    isBookedByUser: false,
  },
  {
    ...base,
    id: 'mock-nearly-full',
    name: 'Power Mat Pilates',
    classType: 'mat_group',
    startsAt: new Date('2026-05-05T11:30:00'),
    instructorName: 'Marco Reyes',
    vibeTags: ['🔥 High Intensity'],
    bookedCount: 9,
    maxCapacity: 10,
    creditCost: 1,
    creditType: 'pass',
    status: 'scheduled',
    isBookedByUser: false,
  },
  {
    ...base,
    id: 'mock-full',
    name: 'Reformer Duo Session',
    classType: 'reformer_duo',
    startsAt: new Date('2026-05-05T13:00:00'),
    instructorName: 'Aiko Tanaka',
    vibeTags: [],
    bookedCount: 2,
    maxCapacity: 2,
    creditCost: 5,
    creditType: 'session',
    status: 'scheduled',
    isBookedByUser: false,
  },
  {
    ...base,
    id: 'mock-booked',
    name: 'Evening Mat Flow',
    classType: 'mat_group',
    startsAt: new Date('2026-05-05T18:00:00'),
    instructorName: 'Sarah Miller',
    vibeTags: ['🧘 Mindful', '💧 Low Impact'],
    bookedCount: 6,
    maxCapacity: 12,
    creditCost: 1,
    creditType: 'pass',
    status: 'scheduled',
    isBookedByUser: true,
  },
  {
    ...base,
    id: 'mock-cancelled',
    name: 'Online Session',
    classType: 'online',
    startsAt: new Date('2026-05-05T07:00:00'),
    instructorName: 'Marco Reyes',
    vibeTags: ['⚡ Advanced'],
    bookedCount: 1,
    maxCapacity: 6,
    creditCost: 2,
    creditType: 'pass',
    status: 'cancelled',
    isBookedByUser: false,
  },
];

const CARD_STATE_LABELS = ['available', 'nearly-full', 'full', 'booked-by-user', 'cancelled'];

// ─────────────────────────────────────────────────────────────────────────────

interface PreviewPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PreviewPage({ searchParams }: PreviewPageProps) {
  const params = await searchParams;
  const dateStr = typeof params[DATE_PARAM] === 'string' ? params[DATE_PARAM] : null;
  const selectedDate = dateStr ? parseISO(dateStr) : startOfToday();

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* ── DateScroller section ── */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pt-4 pb-2">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-slate-400">
          Component: DateScroller
        </p>
        <DateScroller />
        <p className="mt-2 pb-1 text-sm text-slate-500">
          Selected:{' '}
          <span className="font-medium text-slate-800">
            {format(selectedDate, 'EEEE, d MMMM yyyy')}
          </span>
        </p>
      </div>

      {/* ── ClassSessionCard section ── */}
      <div className="mx-auto max-w-2xl px-4 pt-8">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            Component: ClassSessionCard
          </p>
          <p className="mt-0.5 text-sm text-slate-500">All five visual states</p>
        </div>

        <div className="space-y-6">
          {MOCK_SESSIONS.map((session, i) => (
            <div key={session.id}>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-slate-400">
                State: {CARD_STATE_LABELS[i]}
              </p>
              <ClassSessionCard {...session} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
