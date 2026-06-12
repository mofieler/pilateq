import { formatStudioRelativeDay, formatStudioTime } from '@/lib/utils/date.utils';
import { CalendarCheck, Clock, MapPin, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CancelBookingButton } from './CancelBookingButton';
import { AddToCalendarButton } from '@/modules/booking/components/AddToCalendarButton';
import { CreditTypeDot } from '@/modules/booking/components/CreditTypeDot';
import type { CreditType } from '@/lib/config/class-types';

interface BookingCardProps {
  bookingId: string;
  sessionId: string;
  status: 'confirmed' | 'cancelled' | 'attended' | 'no_show' | 'waitlisted';
  creditsSpent: number;
  creditType: CreditType;
  name: string;
  classType: 'reformer_group' | 'reformer_private' | 'reformer_duo' | 'mat_group' | 'mat_private' | 'mat_duo' | 'chair' | 'online' | 'sound_healing' | 'yoga';
  durationMinutes: number;
  location: string | null;
  startsAt: Date;
  instructorName: string | null;
  mercyUsesLeft: number;
  isPast: boolean;
}

const CLASS_TYPE_LABEL: Record<BookingCardProps['classType'], string> = {
  reformer_group:   'Reformer Group',
  reformer_private: 'Reformer Private',
  reformer_duo:     'Reformer Duo',
  mat_group:        'Mat Group',
  mat_private:      'Mat Private',
  mat_duo:          'Mat Duo',
  chair:            'Chair Pilates',
  online:           'Online Class',
  sound_healing:    'Sound Healing',
  yoga:             'Yoga',
};

const CREDIT_LABEL: Record<CreditType, string> = {
  pass:          'Credit',
  mat_pass:      'Mat Credit',
  reformer_pass: 'Reformer Credit',
  session:       'Session Credit',
};

export function BookingCard({
  bookingId,
  sessionId,
  status,
  creditsSpent,
  creditType,
  name,
  classType,
  durationMinutes,
  location,
  startsAt,
  instructorName,
  mercyUsesLeft,
  isPast,
}: BookingCardProps) {
  const dateLabel = formatStudioRelativeDay(startsAt);

  const msUntilStart = startsAt.getTime() - Date.now();
  const isBlocked = msUntilStart < 3 * 60 * 60 * 1000; // within 3h
  const canCancel =
    !isPast &&
    (status === 'confirmed' || status === 'attended') &&
    !isBlocked;

  const classTypeLabel = CLASS_TYPE_LABEL[classType];
  const creditLabel = CREDIT_LABEL[creditType];

  return (
    <div
      className={`group relative rounded-2xl border p-5 transition-all ${
        isPast
          ? 'border-[#ede8e5]/60 bg-[#faf9f7]/60 opacity-70'
          : 'border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#f5f3f1]/80 shadow-[0_4px_20px_rgba(78,43,34,0.04)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className={`text-xs rounded-full ${
                classType.startsWith('mat')
                  ? 'bg-[#6b8e6b]/10 text-[#4a7c4a] border-[#6b8e6b]/20'
                  : classType.startsWith('reformer')
                  ? 'bg-[#8b5a3c]/10 text-[#6b3d32] border-[#c4a88a]/30'
                  : 'bg-[#c4a88a]/10 text-[#6b3d32] border-[#c4a88a]/20'
              }`}
            >
              {classTypeLabel}
            </Badge>
            {status === 'cancelled' && (
              <Badge variant="outline" className="text-xs rounded-full bg-[#c45c4a]/10 text-[#c45c4a] border-[#c45c4a]/20">
                Cancelled
              </Badge>
            )}
            {status === 'attended' && isPast && (
              <Badge variant="outline" className="text-xs rounded-full bg-[#6b8e6b]/10 text-[#4a7c4a] border-[#6b8e6b]/20">
                Attended
              </Badge>
            )}
          </div>
          <h3 className="text-lg font-semibold text-primary">{name}</h3>
        </div>

        {/* Credit badge */}
        <div className="flex items-center gap-1.5 rounded-full bg-[#ede8e5]/60 px-3 py-1.5 text-xs">
          <CreditTypeDot creditType={creditType} size={8} />
          <span className="font-medium text-primary">
            {creditsSpent} {creditLabel}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-secondary">
          <CalendarCheck className="size-4 text-muted" />
          <span className="font-medium">{dateLabel}</span>
          <span className="text-muted">
            at {formatStudioTime(startsAt)} ({durationMinutes} min)
          </span>
        </div>

        {instructorName && (
          <div className="flex items-center gap-2 text-secondary">
            <User className="size-4 text-muted" />
            <span>{instructorName}</span>
          </div>
        )}

        {location && (
          <div className="flex items-center gap-2 text-secondary">
            <MapPin className="size-4 text-muted" />
            <span>{location}</span>
          </div>
        )}
      </div>

      {/* Actions for upcoming classes */}
      {!isPast && (status === 'confirmed' || status === 'attended') && (
        <div className="mt-4 pt-4 border-t border-[#ede8e5]/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Clock className="size-3.5" />
              <span>
                {isBlocked
                  ? 'Cancellation closed — class starts soon'
                  : canCancel
                    ? 'Free cancellation available'
                    : 'Late cancellation may forfeit credits'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AddToCalendarButton
                title={name}
                startAt={startsAt}
                endAt={new Date(startsAt.getTime() + durationMinutes * 60_000)}
                location={location}
                description={`${classType} with ${instructorName ?? 'TBA'}`}
                sessionId={sessionId}
              />
              <CancelBookingButton
                bookingId={bookingId}
                className={name}
                startsAt={startsAt}
                creditsSpent={creditsSpent}
                creditType={creditType}
                mercyUsesLeft={mercyUsesLeft}
                classType={classType}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
