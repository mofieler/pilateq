import { getResend, FROM, APP_URL, APP_NAME, STUDIO_NAME, buildBaseTemplate, escapeHtml } from './_base';
import { STUDIO_TIMEZONE } from '@/constants/BOOKING_RULES';

export async function sendPurchaseConfirmationWithInvoice(
  email: string, name: string, packageName: string, creditsAmount: number,
  creditType: string, priceCents: number, currency: string, validityDays: number,
  invoiceNumber: string, dueDate: Date, pdfBuffer: Buffer | null,
): Promise<void> {
  const formatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency.toUpperCase() }).format(priceCents / 100);
  const dueDateStr = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: STUDIO_TIMEZONE });
  const expiryDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
  const expiryStr  = expiryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: STUDIO_TIMEZONE });

  const isWelcome = packageName === 'Welcome Journey';
  const detailText = isWelcome
    ? `<strong>Welcome Package</strong> (${formatted})`
    : `<strong>${packageName}</strong> (${creditsAmount} credit${creditsAmount !== 1 ? 's' : ''})`;

  await getResend().emails.send({
    from: FROM, to: email,
    subject: `Credit purchase confirmed – ${invoiceNumber} – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Credit purchase confirmation', title: 'Order confirmed – credits are active',
      greeting: `Hi ${name},`,
      body: `
        Thank you for your order. Your credits are active.<br><br>
        Your ${detailText} is valid until <strong>${expiryStr}</strong>.
        You can start booking classes right away.<br><br>
        <strong>Invoice No.:</strong> ${invoiceNumber}<br>
        <strong>Amount:</strong> ${formatted}<br>
        <strong>Payment due:</strong> ${dueDateStr}<br><br>
        Please pay at the studio or via bank transfer within 14 days. Your invoice is attached to this email as a PDF.
      `,
      actionUrl: APP_URL, actionText: 'Book a class',
      expiryText: `Payment is due in-studio by ${dueDateStr}. Invoice No. ${invoiceNumber}.`,
    }),
    ...(pdfBuffer ? { attachments: [{ filename: `Invoice-${invoiceNumber}.pdf`, content: pdfBuffer }] } : {}),
  });
}

export async function sendPaymentReminderEmail(
  email: string, name: string, invoiceNumber: string, packageName: string,
  priceCents: number, currency: string, originalDueDate: Date, daysPastDue: number,
  pdfBuffer: Buffer, customMessage?: string,
): Promise<{ messageId: string | undefined }> {
  const formatted  = new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency.toUpperCase() }).format(priceCents / 100);
  const dueDateStr = originalDueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: STUDIO_TIMEZONE });
  const displayPackageName = packageName === 'Welcome Journey' ? 'Welcome Package' : packageName;
  const overdueNote = daysPastDue > 0
    ? `<span style="color:#c45c4a;font-weight:600;">This invoice is ${daysPastDue} day${daysPastDue !== 1 ? 's' : ''} past due.</span><br><br>`
    : '';
  const customNote = customMessage
    ? `<div style="margin:16px 0;padding:14px 16px;background:#faf9f7;border-left:3px solid #c4a88a;border-radius:6px;font-size:14px;color:#4e2b22;">${escapeHtml(customMessage)}</div>`
    : '';

  const response = await getResend().emails.send({
    from: FROM, to: email,
    subject: `Payment reminder: ${invoiceNumber} – ${STUDIO_NAME}`,
    html: buildBaseTemplate({
      subject: `Payment reminder: Invoice ${invoiceNumber}`, title: 'A friendly payment reminder',
      greeting: `Hi ${name},`,
      body: `
        Thank you for being part of ${STUDIO_NAME}. We hope you're enjoying your classes!<br><br>
        ${overdueNote}We wanted to send a gentle reminder that the following invoice is still outstanding:
        ${customNote}
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:12px 0;border-radius:12px;overflow:hidden;background:#f5f7f5;border:1px solid #ede8e5;">
          <tr><td style="padding:12px 16px;font-size:13px;color:#8b6b5c;border-bottom:1px solid #ede8e5;">Invoice number</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#4e2b22;border-bottom:1px solid #ede8e5;text-align:right;">${invoiceNumber}</td></tr>
          <tr><td style="padding:12px 16px;font-size:13px;color:#8b6b5c;border-bottom:1px solid #ede8e5;">Package</td><td style="padding:12px 16px;font-size:13px;color:#4e2b22;border-bottom:1px solid #ede8e5;text-align:right;">${displayPackageName}</td></tr>
          <tr><td style="padding:12px 16px;font-size:13px;color:#8b6b5c;border-bottom:1px solid #ede8e5;">Amount due</td><td style="padding:12px 16px;font-size:14px;font-weight:700;color:#4e2b22;border-bottom:1px solid #ede8e5;text-align:right;">${formatted}</td></tr>
          <tr><td style="padding:12px 16px;font-size:13px;color:#8b6b5c;">Original due date</td><td style="padding:12px 16px;font-size:13px;color:#c45c4a;font-weight:600;text-align:right;">${dueDateStr}</td></tr>
        </table>
        Please pay at the studio or via bank transfer. A copy of your invoice is attached to this email for your records.<br><br>
        If you have any questions or believe this has been sent in error, please don't hesitate to reach out — we're happy to help.
      `,
      actionUrl: `${APP_URL}/credits`, actionText: 'View my account',
      expiryText: 'We look forward to seeing you at the studio soon.',
    }),
    attachments: [{ filename: `Invoice-${invoiceNumber}.pdf`, content: pdfBuffer }],
  });

  return { messageId: response.data?.id };
}

export async function sendInvoiceToCustomEmail(
  recipientEmail: string, invoiceNumber: string, packageName: string,
  priceCents: number, currency: string, pdfBuffer: Buffer, customMessage: string,
): Promise<{ messageId: string | undefined }> {
  const formatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency.toUpperCase() }).format(priceCents / 100);
  const displayPackageName = packageName === 'Welcome Journey' ? 'Welcome Package' : packageName;

  const response = await getResend().emails.send({
    from: FROM, to: recipientEmail,
    subject: `Invoice ${invoiceNumber} – ${STUDIO_NAME}`,
    html: buildBaseTemplate({
      subject: `Invoice ${invoiceNumber}`, title: `Invoice ${invoiceNumber}`,
      greeting: 'Hello,',
      body: `
        <div style="margin:0 0 20px 0;padding:16px;background:#faf9f7;border-left:3px solid #c4a88a;border-radius:6px;font-size:14px;color:#4e2b22;line-height:1.6;">
          ${escapeHtml(customMessage)}
        </div>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:12px 0;border-radius:12px;overflow:hidden;background:#f5f7f5;border:1px solid #ede8e5;">
          <tr><td style="padding:12px 16px;font-size:13px;color:#8b6b5c;border-bottom:1px solid #ede8e5;">Invoice number</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#4e2b22;border-bottom:1px solid #ede8e5;text-align:right;">${invoiceNumber}</td></tr>
          <tr><td style="padding:12px 16px;font-size:13px;color:#8b6b5c;">Package</td><td style="padding:12px 16px;font-size:13px;color:#4e2b22;text-align:right;">${displayPackageName} — ${formatted}</td></tr>
        </table>
        Your invoice is attached to this email as a PDF.
      `,
      actionUrl: APP_URL, actionText: `Visit ${STUDIO_NAME}`,
      expiryText: `Invoice ${invoiceNumber} from ${STUDIO_NAME}.`,
    }),
    attachments: [{ filename: `Invoice-${invoiceNumber}.pdf`, content: pdfBuffer }],
  });

  return { messageId: response.data?.id };
}

export async function sendCreditAssignmentEmail(
  email: string,
  name: string,
  adminName: string,
  amount: number,
  creditType: string,
  newBalance: number,
  reason?: string,
): Promise<void> {
  const isPositive = amount > 0;
  const absAmount = Math.abs(amount);

  const friendlyNames: Record<string, { label: string; usage: string }> = {
    pass:          { label: 'Universal Credit',      usage: 'for any class' },
    mat_pass:      { label: 'Mat Credit',            usage: 'for Mat classes' },
    reformer_pass: { label: 'Reformer Credit',       usage: 'for Reformer classes' },
    session:       { label: 'Session Credit',        usage: 'for Private or Duo sessions' },
  };

  const { label, usage } = friendlyNames[creditType] ?? { label: `${creditType} credit`, usage: '' };
  const pluralLabel = absAmount === 1 ? label : label.replace('Credit', 'Credits');

  const actionText = isPositive ? 'added to' : 'deducted from';
  const bodyIntro = isPositive
    ? `<strong>${escapeHtml(adminName)}</strong> has <strong>added ${absAmount} ${pluralLabel}</strong> to your account.`
    : `<strong>${escapeHtml(adminName)}</strong> has <strong>deducted ${absAmount} ${pluralLabel}</strong> from your account.`;

  const reasonBlock = reason
    ? `<div style="margin:16px 0;padding:14px 16px;background:#faf9f7;border-left:3px solid #c4a88a;border-radius:6px;font-size:14px;color:#4e2b22;line-height:1.6;">${escapeHtml(reason)}</div>`
    : '';

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `${absAmount} ${pluralLabel} ${actionText} your account – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: `Credits ${actionText} your account`,
      title: isPositive ? 'Credits added to your account' : 'Credits deducted from your account',
      greeting: `Hi ${name},`,
      body: `
        ${bodyIntro}<br><br>
        ${reasonBlock}
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:12px 0;border-radius:12px;overflow:hidden;background:#f5f7f5;border:1px solid #ede8e5;">
          <tr><td style="padding:12px 16px;font-size:13px;color:#8b6b5c;border-bottom:1px solid #ede8e5;">Credit type</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#4e2b22;border-bottom:1px solid #ede8e5;text-align:right;">${pluralLabel}</td></tr>
          <tr><td style="padding:12px 16px;font-size:13px;color:#8b6b5c;border-bottom:1px solid #ede8e5;">Amount ${isPositive ? 'added' : 'deducted'}</td><td style="padding:12px 16px;font-size:14px;font-weight:700;color:${isPositive ? '#4a7c4a' : '#c45c4a'};border-bottom:1px solid #ede8e5;text-align:right;">${isPositive ? '+' : '-'}${absAmount}</td></tr>
          <tr><td style="padding:12px 16px;font-size:13px;color:#8b6b5c;">New balance</td><td style="padding:12px 16px;font-size:14px;font-weight:700;color:#4e2b22;text-align:right;">${newBalance} ${pluralLabel}</td></tr>
        </table>
        ${usage ? `These credits can be used ${usage}.<br><br>` : ''}
        If you have any questions, feel free to reach out to the studio.
      `,
      actionUrl: `${APP_URL}/book`,
      actionText: 'Book a class',
      expiryText: `Your current balance: ${newBalance} ${pluralLabel}.`,
    }),
  });
}

export async function sendCreditConsumptionWarningEmail(
  email: string,
  name: string,
  packageName: string,
  totalAmount: number,
  remainingAmount: number,
  percentage: 50 | 70,
): Promise<void> {
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Usage Alert: ${percentage}% of your ${packageName} credits consumed – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: `Usage Alert: ${percentage}% consumed`,
      title: `${percentage}% Credits Consumed`,
      greeting: `Hi ${name},`,
      body: `
        This is a quick update regarding your credit package. You have used <strong>${percentage}%</strong> of your <strong>${packageName}</strong> credits.<br><br>
        <strong>Remaining balance for this package:</strong> ${remainingAmount} of ${totalAmount} credits.<br><br>
        Make sure to book your upcoming classes in time before your credits run out!
      `,
      actionUrl: `${APP_URL}/book`,
      actionText: 'Book a class now',
      expiryText: `Remaining credits: ${remainingAmount} of ${totalAmount}.`,
    }),
  });
}

export async function sendCreditExpiryWarningEmail(
  email: string,
  name: string,
  remainingAmount: number,
  expiryDate: Date,
): Promise<void> {
  const expiryStr = expiryDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: STUDIO_TIMEZONE,
  });

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Warning: ${remainingAmount} credit${remainingAmount !== 1 ? 's' : ''} expiring in 2 weeks – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Credits expiring soon',
      title: 'Your credits are expiring soon',
      greeting: `Hi ${name},`,
      body: `
        We noticed you have <strong>${remainingAmount} credit${remainingAmount !== 1 ? 's' : ''}</strong> expiring on <strong>${expiryStr}</strong> (in about 2 weeks).<br><br>
        Don't let them go to waste! Head over to the calendar to book your next class and use them up.
      `,
      actionUrl: `${APP_URL}/book`,
      actionText: 'Book a class now',
      expiryText: `Expiry date: ${expiryStr}. Expiring credits: ${remainingAmount}.`,
    }),
  });
}
