import { getResend, FROM, APP_URL, APP_NAME, buildBaseTemplate } from './_base';

export async function sendWaiverSignedEmail(
  email: string,
  name: string,
  studioName: string,
  signedAt: Date,
): Promise<void> {
  const signedAtStr = signedAt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Liability waiver signed – ${studioName}`,
    html: buildBaseTemplate({
      subject: 'Liability waiver signed',
      title: 'Liability waiver signed',
      greeting: `Hi ${name},`,
      body: `
        Thank you for signing the liability waiver for <strong>${studioName}</strong>.<br><br>
        <strong>Signed on:</strong> ${signedAtStr}<br><br>
        You can now book classes and sessions through your account. If you have any questions, please contact the studio.
      `,
      actionUrl: APP_URL,
      actionText: 'Book a class',
      expiryText: `Waiver signed on ${signedAtStr} for ${studioName}.`,
    }),
  });
}
