import { getResend, FROM, APP_URL, APP_NAME, buildBaseTemplate, buildClassInfoBlock, COLORS, STUDIO_NAME } from './_base';
import { generateWelcomeJourneyIcs } from './ical.utils';
import { WELCOME_JOURNEY_OFFER_EXPIRY_HOURS } from '@/constants/BOOKING_RULES';
import { formatStudioDate, formatStudioTime } from '@/lib/utils/date.utils';

export async function sendWelcomeJourneyRequestToAdmin(
  adminEmail: string,
  studentName: string,
  studentEmail: string,
  message?: string,
): Promise<void> {
  const msgBlock = message
    ? `<p style="margin:16px 0 0;font-size:14px;color:${COLORS.textLight};"><font color="${COLORS.textLight}"><strong>Student message:</strong> <em>${message}</em></font></p>`
    : '';

  await getResend().emails.send({
    from: FROM,
    to: adminEmail,
    subject: `New Welcome Journey request – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'New Welcome Journey request',
      title: 'A new student requested a Welcome Journey',
      greeting: 'Hello,',
      body: `<strong>${studentName}</strong> (${studentEmail}) has purchased the Welcome Journey package and is requesting an appointment.${msgBlock}`,
      actionUrl: `${APP_URL}/admin`,
      actionText: 'View request in dashboard',
      expiryText:
        'Please offer one or more available time slots (up to 3) through the admin dashboard.',
    }),
  });
}

export async function sendWelcomeJourneySlotsOffered(
  email: string,
  name: string,
  slotCount: number,
): Promise<void> {
  const count = Math.max(1, slotCount);
  const title =
    count === 1
      ? 'A time slot is ready for you'
      : 'Your Welcome Journey time slots are ready';
  const body =
    count === 1
      ? `We've prepared an available time slot for your Welcome Journey (2-hour private introduction). Please log in and choose that option, or let us know if you need a different time.`
      : `We've prepared ${count} available time slots for your Welcome Journey (2-hour private introduction). Please log in and choose one of the options — whichever works best for you. If none work, let us know and we'll find new options.`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Your Welcome Journey time slots – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Your Welcome Journey time slots',
      title,
      greeting: `Hi ${name},`,
      body,
      actionUrl: `${APP_URL}/book`,
      actionText: 'Pick your slot',
      expiryText: `Slots are held for ${WELCOME_JOURNEY_OFFER_EXPIRY_HOURS} hours. After that they may be released to other students.`,
    }),
  });
}

export async function sendWelcomeJourneyRejectionToAdmin(
  adminEmail: string,
  studentName: string,
  studentEmail: string,
  newMessage?: string,
  offeredSlotCount?: number,
): Promise<void> {
  const msgBlock = newMessage
    ? `<p style="margin:16px 0 0;font-size:14px;color:${COLORS.textLight};"><font color="${COLORS.textLight}"><strong>New preferences:</strong> <em>${newMessage}</em></font></p>`
    : '';

  const slotsHint =
    offeredSlotCount != null && offeredSlotCount > 0
      ? offeredSlotCount === 1
        ? 'declined the offered time slot and is waiting for new options.'
        : `declined all ${offeredSlotCount} offered time slots and is waiting for new options.`
      : 'declined the offered time slot(s) and is waiting for new options.';

  await getResend().emails.send({
    from: FROM,
    to: adminEmail,
    subject: `Welcome Journey slots rejected – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Welcome Journey slots rejected',
      title: 'A student declined the offered slots',
      greeting: 'Hello,',
      body: `<strong>${studentName}</strong> (${studentEmail}) ${slotsHint}${msgBlock}`,
      actionUrl: `${APP_URL}/admin`,
      actionText: 'Offer new slots',
      expiryText:
        'Please offer new time slots for this student (one or more, up to 3) through the dashboard.',
    }),
  });
}

export async function sendWelcomeJourneyBookingConfirmation(
  email: string,
  name: string,
  classTitle: string,
  classDate: string,
  classTime: string,
  startsAt: Date,
  endsAt: Date,
  bookingId: string,
  location?: string,
): Promise<void> {
  const icsBuffer = generateWelcomeJourneyIcs(
    bookingId, 'REQUEST', 'CONFIRMED', 0,
    classTitle,
    `Your Welcome Journey at ${STUDIO_NAME}. Booked via ${APP_NAME}.`,
    startsAt, endsAt, location,
  );

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Welcome Journey confirmed – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Welcome Journey confirmed',
      title: 'Your introduction session is confirmed ✓',
      greeting: `Hi ${name},`,
      body: `Your Welcome Journey has been booked. We're excited to meet you!<br><br>${buildClassInfoBlock(classTitle, classDate, classTime)}`,
      actionUrl: `${APP_URL}/bookings`,
      actionText: 'View my booking',
      expiryText: 'Please arrive at least 10 minutes before the session starts. Wear comfortable clothes that allow movement.',
    }),
    attachments: [{ filename: `${APP_NAME}-Welcome-Journey.ics`, content: icsBuffer }],
  });
}

export async function sendWelcomeJourneyExpiryWarning(
  email: string,
  name: string,
  expiresAt: Date,
): Promise<void> {
  const expiresAtFormatted = `${formatStudioTime(expiresAt)} on ${formatStudioDate(expiresAt)}`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Your Welcome Journey slots expire soon – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Welcome Journey Slots Expiring',
      title: 'Choose your Welcome Journey slot before it expires',
      greeting: `Hi ${name},`,
      body: `This is a friendly reminder that the private introduction slots we've prepared for you will expire at **${expiresAtFormatted}**.<br><br>Please select one of the offered options to lock in your booking before they are released to other students.`,
      actionUrl: `${APP_URL}/book`,
      actionText: 'Book my slot now',
      expiryText: 'If you have any questions or need a different time, simply reply to this email.',
    }),
  });
}

export async function sendWelcomeJourneyExpired(
  email: string,
  name: string,
): Promise<void> {
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Your offered slots have expired – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Welcome Journey Slots Expired',
      title: 'Your offered slots have expired',
      greeting: `Hi ${name},`,
      body: `The private introduction slots we've prepared for you have expired and been released.<br><br>Don't worry! You can easily request a fresh set of slots. Just click the button below and submit your availability.`,
      actionUrl: `${APP_URL}/book`,
      actionText: 'Request new slots',
      expiryText: 'We look forward to welcoming you to the studio!',
    }),
  });
}
