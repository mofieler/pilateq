import { getResend, FROM, APP_NAME, buildBaseTemplate, escapeHtml } from './_base';

export interface MemberInviteEmailData {
  email: string;
  studioName: string;
  role: string;
  inviteUrl: string;
  invitedByName: string | null;
  message: string | null;
  expiryDate: string;
}

function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function buildMemberInviteHtml(data: MemberInviteEmailData): string {
  const { email, studioName, role, inviteUrl, invitedByName, message, expiryDate } = data;
  const roleLabel = formatRole(role);
  const inviterText = invitedByName ? escapeHtml(invitedByName) : 'A studio admin';

  let body = `${escapeHtml(inviterText)} has invited you to join <strong>${escapeHtml(studioName)}</strong> on ${escapeHtml(APP_NAME)} as a <strong>${escapeHtml(roleLabel)}</strong>.`;

  if (message) {
    body += `<br><br><em>"${escapeHtml(message)}"</em>`;
  }

  return buildBaseTemplate({
    subject: `Invitation to join ${studioName}`,
    title: `You're invited to join ${studioName}`,
    greeting: `Hi ${escapeHtml(email)},`,
    body,
    actionUrl: inviteUrl,
    actionText: 'Accept invitation',
    expiryText: `This invitation expires on ${expiryDate}. If you did not expect this email, you can safely ignore it.`,
  });
}

function buildMemberInviteText(data: MemberInviteEmailData): string {
  const { email, studioName, role, inviteUrl, invitedByName, message, expiryDate } = data;
  const roleLabel = formatRole(role);
  const inviterText = invitedByName ?? 'A studio admin';

  let text = `Hi ${email},\n\n`;
  text += `${inviterText} has invited you to join ${studioName} on ${APP_NAME} as a ${roleLabel}.\n\n`;

  if (message) {
    text += `"${message}"\n\n`;
  }

  text += `Accept your invitation:\n${inviteUrl}\n\n`;
  text += `This invitation expires on ${expiryDate}. If you did not expect this email, you can safely ignore it.\n\n`;
  text += `— ${APP_NAME}`;

  return text;
}

/**
 * Send a studio member invitation email with HTML + plain text bodies.
 */
export async function sendMemberInviteEmail(data: MemberInviteEmailData): Promise<void> {
  const { email, studioName } = data;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `You've been invited to join ${studioName} on ${APP_NAME}`,
    html: buildMemberInviteHtml(data),
    text: buildMemberInviteText(data),
  });
}
