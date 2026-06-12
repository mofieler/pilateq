import { getResend, FROM, APP_URL, APP_NAME, buildBaseTemplate, buildClassInfoBlock } from './_base';

export async function sendDuoInviteCreatedEmail(
  email: string,
  name: string,
  inviteUrl: string,
  classTitle: string,
  classDate: string,
  classTime: string,
  expiryDate: string,
): Promise<void> {
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Your duo invite is ready – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Duo invite ready',
      title: 'Invite your duo partner',
      greeting: `Hi ${name},`,
      body: `Your duo spot for <strong>${classTitle}</strong> is reserved. Share the link below with your partner so they can join you.<br><br>${buildClassInfoBlock(classTitle, classDate, classTime)}`,
      actionUrl: inviteUrl,
      actionText: 'Copy invite link',
      expiryText: `This invite expires on ${expiryDate}. After that, the spot will be released.`,
    }),
  });
}

export async function sendDuoInviteAcceptedEmailToOrganizer(
  email: string,
  name: string,
  partnerName: string,
  classTitle: string,
  classDate: string,
  classTime: string,
): Promise<void> {
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Your duo partner joined – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Duo partner joined',
      title: `${partnerName} is joining you!`,
      greeting: `Hi ${name},`,
      body: `<strong>${partnerName}</strong> has accepted your duo invite and is now booked for the session.<br><br>${buildClassInfoBlock(classTitle, classDate, classTime)}`,
      actionUrl: `${APP_URL}/bookings`,
      actionText: 'View my bookings',
      expiryText: 'Your duo session is confirmed. See you both in class!',
    }),
  });
}

export async function sendDuoInviteAcceptedConfirmationToPartner(
  email: string,
  name: string,
  organizerName: string,
  classTitle: string,
  classDate: string,
  classTime: string,
): Promise<void> {
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `You're booked – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Duo booking confirmed',
      title: 'Your duo session is confirmed ✓',
      greeting: `Hi ${name},`,
      body: `You're all set! You're joining <strong>${organizerName}</strong> for a duo Pilates session.<br><br>${buildClassInfoBlock(classTitle, classDate, classTime)}`,
      actionUrl: `${APP_URL}/bookings`,
      actionText: 'View my bookings',
      expiryText: 'Please arrive at least 10 minutes before the session starts.',
    }),
  });
}

export async function sendDuoInviteCancelledEmail(
  email: string,
  name: string,
  classTitle: string,
  classDate: string,
  classTime: string,
): Promise<void> {
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Duo invite cancelled – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Duo invite cancelled',
      title: 'Duo invite cancelled',
      greeting: `Hi ${name},`,
      body: `Your duo invite for <strong>${classTitle}</strong> has been cancelled by the studio. The reserved spot has been released.<br><br>${buildClassInfoBlock(classTitle, classDate, classTime)}`,
      actionUrl: `${APP_URL}/book`,
      actionText: 'Browse classes',
      expiryText: 'You can book a new class or create a new duo invite anytime.',
    }),
  });
}

export async function sendDuoPartnerCancelledEmail(
  email: string,
  name: string,
  cancellerName: string,
  classTitle: string,
  classDate: string,
  classTime: string,
  refundIssued: boolean,
): Promise<void> {
  const refundDetail = refundIssued
    ? 'Your booking was cancelled, and your credit has been fully refunded to your account.'
    : 'Your booking was cancelled. Because the cancellation occurred within the 24-hour late window, credits could not be refunded per our cancellation policy.';

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Duo session cancelled – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Duo session cancelled',
      title: 'Your shared duo booking was cancelled',
      greeting: `Hi ${name},`,
      body: `<strong>${cancellerName}</strong> has cancelled their booking for your shared duo session. Since duo sessions require both participants, your booking has also been automatically cancelled.<br><br>${buildClassInfoBlock(classTitle, classDate, classTime)}<br>${refundDetail}`,
      actionUrl: `${APP_URL}/book`,
      actionText: 'Book a new session',
      expiryText: 'You can create a new duo invite or book any other class from the schedule.',
    }),
  });
}

export async function sendDuoBookingConfirmedEmailToInstructor(
  email: string,
  instructorName: string,
  organizerName: string,
  partnerName: string,
  classTitle: string,
  classDate: string,
  classTime: string,
): Promise<void> {
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Duo session fully confirmed – ${classTitle}`,
    html: buildBaseTemplate({
      subject: 'Duo session confirmed',
      title: 'A duo session is now fully confirmed',
      greeting: `Hi ${instructorName},`,
      body: `Great news! The duo session for <strong>${classTitle}</strong> is now fully formed.<br><br><strong>${organizerName}</strong> has been joined by <strong>${partnerName}</strong>.<br><br>${buildClassInfoBlock(classTitle, classDate, classTime)}`,
      actionUrl: `${APP_URL}/admin/classes`,
      actionText: 'View class details',
      expiryText: 'This is an automated notification. No action is required from you.',
    }),
  });
}
