import { Resend } from 'resend';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

let _resend: Resend | null = null;
export function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[email] RESEND_API_KEY not set — emails are disabled');
      _resend = {
        emails: {
          send: async () => ({ id: 'mock-email-id', data: null }),
        },
      } as unknown as Resend;
    } else {
      _resend = new Resend(process.env.RESEND_API_KEY);
    }
  }
  return _resend;
}

export const APP_URL    = APP_CONFIG.APP_URL;
export const APP_NAME   = APP_CONFIG.APP_NAME;
export const STUDIO_NAME = process.env.STUDIO_NAME ?? APP_CONFIG.APP_NAME;

function deriveDefaultFromEmail(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? APP_CONFIG.APP_URL;
  let hostname = 'localhost';
  try {
    hostname = new URL(appUrl).hostname || 'localhost';
  } catch {
    hostname = 'localhost';
  }
  return `${APP_NAME} <noreply@${hostname}>`;
}

export const FROM = process.env.EMAIL_FROM ?? deriveDefaultFromEmail();

export const COLORS = {
  primary:      '#4e2b22',
  primaryLight: '#6b3d32',
  accent:       '#c4a88a',
  background:   '#faf9f7',
  surface:      '#ffffff',
  border:       '#ede8e5',
  text:         '#4e2b22',
  textMuted:    '#4e2b22',
  textLight:    '#6b3d32',
  textLighter:  '#8b6b5c',
};

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface EmailTemplateProps {
  subject: string;
  title: string;
  greeting: string;
  body: string;
  actionUrl: string;
  actionText: string;
  expiryText: string;
  footerText?: string;
}

export function buildBaseTemplate(props: EmailTemplateProps): string {
  const { title, greeting, body, actionUrl, actionText, expiryText, footerText } = props;
  const C = COLORS;

  return `<!DOCTYPE html>
<html lang="en" style="color-scheme: light only;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>${title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    :root { color-scheme: light only !important; }
    html { color-scheme: light only !important; }
    body { color-scheme: light only !important; }
    [data-ogsc],[data-ogsb],[data-ogac],[data-ogab] { color: inherit !important; background-color: inherit !important; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; max-width: 100% !important; }
      .content { padding: 20px 16px !important; }
      .header { padding: 20px 16px !important; }
      .card-footer { padding: 16px !important; }
      .button { width: 100% !important; display: block !important; text-align: center !important; }
      .title { font-size: 20px !important; }
    }
    @media (prefers-color-scheme: dark) {
      html, body, .email-wrap, .card-outer, .card-body, .card-footer { background-color: ${C.surface} !important; color: ${C.text} !important; }
      .email-bg, body[bgcolor], table[bgcolor] { background-color: ${C.background} !important; }
      .header, td.header { background-color: ${C.primary} !important; }
      .header-title, h1.header-title { color: #ffffff !important; }
      .header-subtitle { color: #e8d5b7 !important; }
      p, td, span, li, div, .card-body p, .card-body td { color: ${C.text} !important; }
      h1, h2, h3, h4, h5, h6, .email-title, .title { color: ${C.primary} !important; }
      .cta-button, a.cta-button { background-color: ${C.primary} !important; color: #ffffff !important; }
    }
    [data-ogsc] body, [data-ogsb] body { background-color: ${C.background} !important; }
    [data-ogsc] .card-body, [data-ogsb] .card-body { background-color: ${C.surface} !important; color: ${C.text} !important; }
    [data-ogsc] .header, [data-ogsb] .header { background-color: ${C.primary} !important; }
  </style>
</head>
<body class="email-wrap" style="margin:0;padding:0;background-color:${C.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${C.text};-webkit-font-smoothing:antialiased;word-break:break-word;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${greeting} ${body.replace(/<[^>]*>/g, '').substring(0, 100)}...</div>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-bg" style="background-color:${C.background};">
    <tr><td style="padding:40px 16px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="container card-outer" style="max-width:560px;margin:0 auto;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(78,43,34,0.08);" bgcolor="${C.surface}">
        <tr>
          <td class="header" bgcolor="${C.primary}" style="background-color:${C.primary};padding:32px 40px;text-align:center;">
            <h1 class="header-title" style="margin:0;font-size:26px;font-weight:700;letter-spacing:-0.5px;color:#ffffff;"><font color="#ffffff">${APP_NAME}</font></h1>
            <p class="header-subtitle" style="margin:8px 0 0;font-size:13px;color:#e8d5b7;"><font color="#e8d5b7">Boutique Pilates Studio Booking System</font></p>
          </td>
        </tr>
        <tr>
          <td class="content card-body" bgcolor="${C.surface}" style="padding:40px;background-color:${C.surface};">
            <p style="margin:0 0 8px;font-size:16px;font-weight:500;color:${C.primary};"><font color="${C.primary}">${greeting}</font></p>
            <h1 class="email-title title" style="margin:0 0 20px;font-size:24px;font-weight:700;line-height:1.3;color:${C.primary};"><font color="${C.primary}">${title}</font></h1>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:${C.text};"><font color="${C.text}">${body}</font></p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 28px;">
              <tr><td align="center">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr><td bgcolor="${C.primary}" style="background-color:${C.primary};border-radius:12px;">
                    <a href="${actionUrl}" class="button cta-button" style="display:inline-block;padding:16px 32px;background-color:${C.primary};border-radius:12px;font-size:15px;font-weight:600;text-align:center;text-decoration:none;color:#ffffff;">
                      <font color="#ffffff">${actionText}</font>
                    </a>
                  </td></tr>
                </table>
              </td></tr>
            </table>
            <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:${C.textLight};"><font color="${C.textLight}"><span style="display:inline-block;margin-right:6px;">⏱️</span>${expiryText}</font></p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0;"><tr><td style="border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</td></tr></table>
            <p style="margin:0 0 8px;font-size:12px;font-weight:500;color:${C.textLighter};text-transform:uppercase;letter-spacing:0.5px;"><font color="${C.textLighter}">Link not working?</font></p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:${C.textLighter};word-break:break-all;"><font color="${C.textLighter}">Copy this link into your browser:<br><a href="${actionUrl}" style="color:${C.primaryLight};text-decoration:underline;"><font color="${C.primaryLight}">${actionUrl}</font></a></font></p>
            ${footerText ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${C.textLight};font-style:italic;"><font color="${C.textLight}">${footerText}</font></p>` : ''}
          </td>
        </tr>
        <tr>
          <td class="card-footer" bgcolor="${C.background}" style="background-color:${C.background};padding:24px 40px;text-align:center;border-top:1px solid ${C.border};">
            <p style="margin:0 0 8px;font-size:12px;color:${C.textLighter};"><font color="${C.textLighter}">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</font></p>
            <p style="margin:0;font-size:11px;color:${C.textLighter};"><font color="${C.textLighter}">This email was sent automatically. Please do not reply.</font></p>
          </td>
        </tr>
      </table>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;margin:20px auto 0;">
        <tr><td style="text-align:center;padding:0 20px;">
          <p style="margin:0;font-size:12px;color:${C.textLighter};">
            <a href="${APP_URL}" style="color:${C.primaryLight};text-decoration:none;">Visit website</a>
            <span style="margin:0 8px;color:${C.border};">|</span>
            <a href="${APP_URL}/datenschutz" style="color:${C.primaryLight};text-decoration:none;">Datenschutz</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildClassInfoBlock(classTitle: string, classDate: string, classTime: string): string {
  const C = COLORS;
  return `
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
                  <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:${C.textLighter};"><font color="${C.textLighter}">Date</font></p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${C.text};"><font color="${C.text}">${classDate}</font></p>
                </td>
                <td width="50%" style="vertical-align:top;">
                  <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:${C.textLighter};"><font color="${C.textLighter}">Time</font></p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${C.text};"><font color="${C.text}">${classTime}</font></p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>`;
}

export function buildCreditStatusBlock(refundIssued: boolean, adminCancelled = false): string {
  const isGreen = refundIssued;
  const bg      = isGreen ? '#f0faf0' : '#fff8f0';
  const border  = isGreen ? '#b2dfb2' : '#f5cba7';
  const icon    = isGreen ? '✓' : '✕';
  const iconBg  = isGreen ? '#4a7c4a' : '#c0392b';
  const label   = isGreen ? 'Credit refunded' : 'No refund issued';
  const detail  = adminCancelled
    ? 'Your credit has been fully refunded because the studio cancelled this class.'
    : refundIssued
      ? 'Cancelled more than 24 hours in advance — your credit has been returned to your account.'
      : 'Late cancellation (within 24 hours) — your credit could not be refunded per our cancellation policy.';

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:12px 0 0;border-radius:12px;overflow:hidden;border:1px solid ${border};">
      <tr><td style="background-color:${bg};padding:14px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td width="32" style="vertical-align:middle;padding-right:12px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                <td bgcolor="${iconBg}" style="background-color:${iconBg};border-radius:50%;width:28px;height:28px;text-align:center;vertical-align:middle;">
                  <span style="font-size:14px;font-weight:700;color:#ffffff;line-height:28px;display:block;"><font color="#ffffff">${icon}</font></span>
                </td>
              </tr></table>
            </td>
            <td style="vertical-align:middle;">
              <p style="margin:0;font-size:13px;font-weight:700;color:${isGreen ? '#2d6a2d' : '#7b2d00'};"><font color="${isGreen ? '#2d6a2d' : '#7b2d00'}">${label}</font></p>
              <p style="margin:3px 0 0;font-size:12px;line-height:1.5;color:${isGreen ? '#3d7a3d' : '#8b4500'};"><font color="${isGreen ? '#3d7a3d' : '#8b4500'}">${detail}</font></p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>`;
}
