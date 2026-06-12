import { getResend, FROM, APP_URL, APP_NAME, buildBaseTemplate, buildClassInfoBlock, buildCreditStatusBlock, COLORS, STUDIO_NAME } from './_base';
import { generateBookingIcs, generateSessionIcs } from './ical.utils';

export async function sendBookingConfirmationEmail(
  email: string, name: string, classTitle: string, classDate: string, classTime: string,
  startsAt: Date, endsAt: Date, bookingId: string, location?: string,
): Promise<void> {
  const icsBuffer = generateBookingIcs(
    bookingId, 'REQUEST', 'CONFIRMED', 0,
    classTitle,
    `Your ${classTitle} class at ${STUDIO_NAME}. Booked via ${APP_NAME}.`,
    startsAt, endsAt, location,
  );

  await getResend().emails.send({
    from: FROM, to: email,
    subject: `Booking confirmation – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Booking confirmation', title: 'Your class is confirmed ✓',
      greeting: `Hi ${name},`,
      body: `Your class has been successfully booked. See you on the mat!<br><br>${buildClassInfoBlock(classTitle, classDate, classTime)}`,
      actionUrl: APP_URL, actionText: 'View my classes',
      expiryText: 'Please arrive at least 10 minutes before class starts. If you cannot attend, please cancel more than 24 hours before the class to receive a full credit refund.',
    }),
    attachments: [{ filename: `${APP_NAME}-Booking.ics`, content: icsBuffer }],
  });
}

export async function sendBookingCancellationEmail(
  email: string, name: string, classTitle: string, classDate: string, classTime: string, refundIssued: boolean,
  startsAt: Date, endsAt: Date, bookingId: string, location?: string,
): Promise<void> {
  const icsBuffer = generateBookingIcs(
    bookingId, 'CANCEL', 'CANCELLED', 0,
    classTitle,
    `Your ${classTitle} class at ${STUDIO_NAME} has been cancelled.`,
    startsAt, endsAt, location,
  );

  await getResend().emails.send({
    from: FROM, to: email,
    subject: `Cancellation confirmation – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Cancellation confirmation', title: 'Booking cancelled',
      greeting: `Hi ${name},`,
      body: `Your booking has been successfully cancelled.<br><br>${buildClassInfoBlock(classTitle, classDate, classTime)}${buildCreditStatusBlock(refundIssued, false)}`,
      actionUrl: APP_URL, actionText: 'Book a new class',
      expiryText: 'You can book another class anytime from the schedule.',
    }),
    attachments: [{ filename: `${APP_NAME}-Booking-Cancelled.ics`, content: icsBuffer }],
  });
}

export async function sendClassCancelledByAdminEmail(
  email: string, name: string, classTitle: string, classDate: string, classTime: string, reason?: string,
  startsAt?: Date, endsAt?: Date, sessionId?: string, location?: string,
): Promise<void> {
  const C = COLORS;
  const reasonNote = reason
    ? `<p style="margin:16px 0 0;font-size:14px;color:${C.textLight};"><font color="${C.textLight}"><strong>Reason:</strong> <em>${reason}</em></font></p>`
    : '';

  const attachments: { filename: string; content: Buffer }[] = [];
  if (startsAt && endsAt && sessionId) {
    attachments.push({
      filename: `${APP_NAME}-Class-Cancelled.ics`,
      content: generateSessionIcs(
        sessionId, 'CANCEL', 'CANCELLED', 0,
        classTitle,
        `Your ${classTitle} class at ${STUDIO_NAME} has been cancelled by the studio.`,
        startsAt, endsAt, location,
      ),
    });
  }

  await getResend().emails.send({
    from: FROM, to: email,
    subject: `Class cancelled – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Class cancelled', title: 'Your class has been cancelled',
      greeting: `Hi ${name},`,
      body: `We're sorry to let you know that this class has been cancelled by the studio.<br><br>${buildClassInfoBlock(classTitle, classDate, classTime)}${buildCreditStatusBlock(true, true)}${reasonNote}`,
      actionUrl: APP_URL, actionText: 'Browse other classes',
      expiryText: 'We apologise for the inconvenience. We hope to see you at another class soon.',
    }),
    ...(attachments.length > 0 ? { attachments } : {}),
  });
}

export async function sendClassRescheduledEmail(
  email: string,
  name: string,
  classTitle: string,
  oldDate: string,
  oldTime: string,
  newDate: string,
  newTime: string,
  startsAt: Date,
  endsAt: Date,
  sessionId: string,
  location?: string,
): Promise<void> {
  const icsBuffer = generateSessionIcs(
    sessionId, 'REQUEST', 'CONFIRMED', 1,
    classTitle,
    `Your ${classTitle} class at ${STUDIO_NAME} has been rescheduled.`,
    startsAt, endsAt, location,
  );
  const C = COLORS;
  const oldBlock = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 4px;border-radius:12px;overflow:hidden;border:1px solid ${C.border};">
      <tr><td style="background-color:${C.background};padding:16px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr><td style="padding-bottom:10px;border-bottom:1px solid ${C.border};">
            <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:${C.textLighter};"><font color="${C.textLighter}">Class</font></p>
            <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:${C.primary};"><font color="${C.primary}">${classTitle}</font></p>
          </td></tr>
          <tr><td style="padding-top:10px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td width="50%" style="vertical-align:top;">
                  <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:${C.textLighter};"><font color="${C.textLighter}">Previous date</font></p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${C.text};text-decoration:line-through;opacity:0.6;"><font color="${C.text}">${oldDate}</font></p>
                </td>
                <td width="50%" style="vertical-align:top;">
                  <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:${C.textLighter};"><font color="${C.textLighter}">Previous time</font></p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${C.text};text-decoration:line-through;opacity:0.6;"><font color="${C.text}">${oldTime}</font></p>
                </td>
              </tr>
              <tr>
                <td width="50%" style="vertical-align:top;padding-top:10px;">
                  <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:${C.textLighter};"><font color="${C.textLighter}">New date</font></p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:${C.primary};"><font color="${C.primary}">${newDate}</font></p>
                </td>
                <td width="50%" style="vertical-align:top;padding-top:10px;">
                  <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:${C.textLighter};"><font color="${C.textLighter}">New time</font></p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:${C.primary};"><font color="${C.primary}">${newTime}</font></p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:12px 0 0;border-radius:12px;overflow:hidden;border:1px solid #b8d4f0;">
      <tr><td style="background-color:#f0f7ff;padding:14px 20px;">
        <p style="margin:0;font-size:13px;font-weight:700;color:#1a4a7a;"><font color="#1a4a7a">Free cancellation available</font></p>
        <p style="margin:3px 0 0;font-size:12px;line-height:1.5;color:#2a5a8a;"><font color="#2a5a8a">Because the schedule changed, you have 24 hours from this notice to cancel for a full credit refund — even if the class is less than 24 hours away. This grace period ends when the class begins; cancellations after the class has started are no longer possible.</font></p>
      </td></tr>
    </table>`;

  await getResend().emails.send({
    from: FROM, to: email,
    subject: `Schedule change – ${classTitle} – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Schedule change', title: 'Your class has been rescheduled',
      greeting: `Hi ${name},`,
      body: `The studio has updated the time for your upcoming class. Your booking remains confirmed — please note the new time below.<br><br>${oldBlock}`,
      actionUrl: APP_URL, actionText: 'View my bookings',
      expiryText: 'If the new time does not work for you, you can cancel for free within 24 hours of receiving this email — but only up until the class starts. Once the class has begun, cancellation is no longer possible.',
    }),
    attachments: [{ filename: `${APP_NAME}-Class-Rescheduled.ics`, content: icsBuffer }],
  });
}

export async function sendInstructorCancellationNotificationEmail(
  email: string,
  instructorName: string,
  studentName: string,
  classTitle: string,
  classDate: string,
  classTime: string,
  refundIssued: boolean,
): Promise<void> {
  const C = COLORS;
  const refundNote = refundIssued
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:12px 0 0;border-radius:12px;overflow:hidden;border:1px solid #b2dfb2;"><tr><td style="background-color:#f0faf0;padding:14px 20px;"><p style="margin:0;font-size:13px;font-weight:700;color:#2d6a2d;"><font color="#2d6a2d">Credit refunded to student</font></p></td></tr></table>`
    : `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:12px 0 0;border-radius:12px;overflow:hidden;border:1px solid #f5cba7;"><tr><td style="background-color:#fff8f0;padding:14px 20px;"><p style="margin:0;font-size:13px;font-weight:700;color:#7b2d00;"><font color="#7b2d00">No refund issued (late cancellation)</font></p></td></tr></table>`;

  await getResend().emails.send({
    from: FROM, to: email,
    subject: `Booking cancelled by student – ${classTitle}`,
    html: buildBaseTemplate({
      subject: 'Student cancellation', title: 'A student cancelled their booking',
      greeting: `Hi ${instructorName},`,
      body: `<strong>${studentName}</strong> has cancelled their booking for the following class:<br><br>${buildClassInfoBlock(classTitle, classDate, classTime)}${refundNote}`,
      actionUrl: `${APP_URL}/admin/classes`, actionText: 'View class',
      expiryText: 'This is an automated notification. No action is required from you.',
    }),
  });
}
