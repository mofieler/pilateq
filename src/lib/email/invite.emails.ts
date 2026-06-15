import { getResend, FROM, APP_URL, APP_NAME, buildBaseTemplate } from './_base';

export async function sendStudioInviteEmail(email: string, name: string, rawToken: string): Promise<void> {
  const link = `${APP_URL}/start?invite=${encodeURIComponent(rawToken)}`;
  console.log('[email] Sending studio invite email to:', email, '| from:', FROM, '| link:', link);

  const result = await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `You're invited to create a studio on ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Create your studio',
      title: 'Start your Pilates studio',
      greeting: `Hi ${name},`,
      body: `you've been invited to create your own studio on ${APP_NAME}. Click the button below to claim your studio and set everything up.`,
      actionUrl: link,
      actionText: 'Create my studio',
      expiryText: 'This invite link expires in <strong>7 days</strong> and can only be used once.',
      footerText: "If you weren't expecting this invite, you can safely ignore this email.",
    }),
  });

  console.log('[email] Resend studio invite result:', JSON.stringify(result));

  if (result.error) {
    console.error('[email] Resend rejected studio invite email:', result.error);
    throw new Error(`Resend email failed: ${result.error.name} - ${result.error.message}`);
  }
}
