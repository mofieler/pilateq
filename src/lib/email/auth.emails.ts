import { getResend, FROM, APP_URL, APP_NAME, buildBaseTemplate } from './_base';

export async function sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
  const link = `${APP_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}&identifier=${encodeURIComponent(email)}`;
  await getResend().emails.send({
    from: FROM, to: email,
    subject: `Verify your email – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Verify email', title: 'Verify your email address',
      greeting: `Hi ${name},`,
      body: `welcome to ${APP_NAME}! Please verify your email address to activate your account and access all features.`,
      actionUrl: link, actionText: 'Verify email',
      expiryText: 'This link expires in <strong>24 hours</strong>. If you did not create an account, you can ignore this email.',
    }),
  });
}

export async function sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}&identifier=${encodeURIComponent(email)}`;
  await getResend().emails.send({
    from: FROM, to: email,
    subject: `Reset your password – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Reset password', title: 'Reset password',
      greeting: `Hi ${name},`,
      body: 'we received a request to reset your password. Click the button below to create a new password.',
      actionUrl: link, actionText: 'Reset password',
      expiryText: 'This link expires in <strong>1 hour</strong>. If you did not request a reset, please ignore this email.',
      footerText: 'For security reasons, your password will not be changed unless you click the link.',
    }),
  });
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const { STUDIO_NAME } = await import('./_base');
  await getResend().emails.send({
    from: FROM, to: email,
    subject: `Welcome – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Welcome', title: `Welcome to ${APP_NAME}`,
      greeting: `Hi ${name},`,
      body: `great to have you here! ${APP_NAME} is the digital booking system for your classes at ${STUDIO_NAME} — explore our schedule and book your first Pilates session.`,
      actionUrl: APP_URL, actionText: 'Explore classes',
      expiryText: 'Have questions? Simply reply to this email or visit us at the studio.',
    }),
  });
}

export async function sendNotificationEmail(
  email: string, subject: string, title: string, message: string,
  actionUrl?: string, actionText?: string,
): Promise<void> {
  await getResend().emails.send({
    from: FROM, to: email,
    subject: `${subject} – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject, title, greeting: 'Hello,', body: message,
      actionUrl: actionUrl ?? APP_URL, actionText: actionText ?? 'View now',
      expiryText: '',
    }),
  });
}
