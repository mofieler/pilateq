import { differenceInHours } from 'date-fns';
import Image from 'next/image';
import { CalendarCheckIcon, ClockIcon, MapPinIcon, ShieldCheckIcon, BanIcon } from 'lucide-react';
import { CANCELLATION_CUTOFF_HOURS } from '@/constants/BOOKING_RULES';
import type { ClassType, CreditType } from '@/lib/config/class-types';
import { formatStudio, formatStudioRelativeDay, formatStudioTime } from '@/lib/utils/date.utils';
import { CancelBookingButton } from './CancelBookingButton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CreditTypeDot } from '@/modules/booking/components/CreditTypeDot';

// â”€â”€â”€ List-level props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type UpcomingBookingsListProps = {
  bookings: UpcomingBooking[];
  /** Whether the user's one-time grace period (first late-cancel mercy) is still available */
  /** Remaining late-cancellation mercy uses for this calendar month (0..3). */
  mercyUsesLeft: number;
};

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type UpcomingBooking = {
  bookingId: string;
  creditsSpent: number;
  creditType: CreditType;
  name: string;
  classType: ClassType;
  startsAt: Date;
  durationMinutes: number;
  location: string | null;
  instructorName: string | null;
  instructorAvatarUrl: string | null;
};

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CLASS_TYPE_LABEL: Record<UpcomingBooking['classType'], string> = {
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

function dateLabel(date: Date): string {
  return formatStudioRelativeDay(date);
}

function freeCancellationLabel(startsAt: Date): string | null {
  const hours = differenceInHours(startsAt, new Date());
  if (hours <= 0) return null;
  if (hours > 24) return 'Free cancellation available';
  return `${hours}h until late cancellation`;
}

function InstructorAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={36}
        height={36}
        className="size-9 rounded-full object-cover shrink-0 ring-2 ring-[#ede8e5] shadow-sm"
      />
    );
  }

  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ede8e5] to-[#e5dfdb] text-xs font-semibold text-[#6b3d32] ring-2 ring-[#faf9f7] shadow-sm">
      {initials}
    </span>
  );
}

// â”€â”€â”€ Single booking row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BookingRow({
  booking,
  mercyUsesLeft,
}: {
  booking: UpcomingBooking;
  mercyUsesLeft: number;
}) {
  const now = new Date();
  const hoursUntil = differenceInHours(booking.startsAt, now);
  const msUntilStart = booking.startsAt.getTime() - now.getTime();
  const isBlocked = msUntilStart < CANCELLATION_CUTOFF_HOURS * 60 * 60 * 1000;
  const isFreeCancellation = hoursUntil > 24;
  const cancellationLabel = freeCancellationLabel(booking.startsAt);

  return (
    <li className="group flex flex-col gap-4 rounded-2xl border border-[#ede8e5]/60 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-4 shadow-[0_4px_14px_rgba(78,43,34,0.04)] backdrop-blur-sm transition-all duration-300 hover:shadow-[0_8px_24px_rgba(78,43,34,0.08)] sm:flex-row sm:items-start sm:justify-between">
      {/* Left: class info */}
      <div className="flex gap-4">
        {/* Date block */}
        <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-[#ede8e5]/60 to-[#e5dfdb]/40 px-4 py-3 text-center min-w-[60px] ring-1 ring-[#c4a88a]/20">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#8b6b5c]">
            {formatStudio(booking.startsAt, 'MMM')}
          </span>
          <span className="text-2xl font-bold leading-none text-[#4e2b22] tabular-nums">
            {formatStudio(booking.startsAt, 'd')}
          </span>
        </div>

        {/* Details */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[#4e2b22]">{booking.name}</h3>
            <span className="rounded-full bg-[#ede8e5]/60 border border-[#c4a88a]/20 px-2.5 py-0.5 text-[10px] font-medium text-[#6b3d32]">
              {CLASS_TYPE_LABEL[booking.classType]}
            </span>
          </div>

          {booking.instructorName && (
            <div className="mt-2 flex items-center gap-2">
              <InstructorAvatar name={booking.instructorName} avatarUrl={booking.instructorAvatarUrl} />
              <span className="text-xs font-medium text-[#6b3d32]">{booking.instructorName}</span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#8b6b5c]">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#ede8e5]/40 px-2 py-1">
              <ClockIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="font-medium text-[#6b3d32]">{dateLabel(booking.startsAt)}</span>
              <span>· {formatStudioTime(booking.startsAt)}</span>
              <span>· {booking.durationMinutes} min</span>
            </span>
            {booking.location && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
                {booking.location}
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6b3d32]">
              <CreditTypeDot creditType={booking.creditType} size={10} />
              {booking.creditsSpent} {booking.creditType === 'session' ? 'session' : ''}{booking.creditsSpent === 1 ? ' credit' : ' credits'}
            </span>

            {isBlocked ? (
              <StatusBadge variant="danger">
                <BanIcon className="size-3" aria-hidden />
                Cancellation closed
              </StatusBadge>
            ) : cancellationLabel && (
              <StatusBadge variant={isFreeCancellation ? 'success' : 'warning'}>
                <ShieldCheckIcon className="size-3" aria-hidden />
                {cancellationLabel}
              </StatusBadge>
            )}
          </div>
        </div>
      </div>

      {/* Right: cancel button (opens policy dialog) */}
      <div className="flex shrink-0 items-start sm:items-center mt-2 sm:mt-0">
        <CancelBookingButton
          bookingId={booking.bookingId}
          className={booking.name}
          startsAt={booking.startsAt}
          creditsSpent={booking.creditsSpent}
          creditType={booking.creditType}
          mercyUsesLeft={mercyUsesLeft}
          classType={booking.classType}
        />
      </div>
    </li>
  );
}

// â”€â”€â”€ Empty state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EmptyBookings() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#c4a88a]/30 bg-gradient-to-br from-[#faf9f7]/60 to-[#ede8e5]/30 py-14 text-center backdrop-blur-sm">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-[#ede8e5]/60 ring-1 ring-[#c4a88a]/20">
        <CalendarCheckIcon className="size-8 text-[#c4a88a]" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-[#4e2b22]">No upcoming bookings</p>
      <p className="mt-1.5 text-xs text-[#8b6b5c]">Head to the booking calendar to reserve a spot</p>
    </div>
  );
}

// â”€â”€â”€ Public component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function UpcomingBookingsList({ bookings, mercyUsesLeft }: UpcomingBookingsListProps) {
  if (bookings.length === 0) return <EmptyBookings />;

  return (
    <ul className="space-y-3">
      {bookings.map((b) => (
        <BookingRow key={b.bookingId} booking={b} mercyUsesLeft={mercyUsesLeft} />
      ))}
    </ul>
  );
}
