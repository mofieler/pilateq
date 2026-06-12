import type { ClassType, CreditType } from '@/lib/config/class-types';

/** Public read-only session row for embed + marketing widgets. */
export type PublicScheduleSession = {
  id: string;
  name: string;
  classType: ClassType;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  instructorName: string;
  location: string | null;
  bookedCount: number;
  maxCapacity: number;
  creditCost: number;
  creditType: CreditType;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
};

export type PublicScheduleResponse = {
  weekStart: string;
  rangeStart: string;
  rangeEnd: string;
  sessions: PublicScheduleSession[];
  bookingBaseUrl: string;
  studioName: string;
};
