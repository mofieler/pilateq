'use server';

import { z } from 'zod';
import { db } from '@/db';
import {
  creditPurchases,
  creditPackages,
  users,
  invoiceReminders,
} from '@/db/schema';
import { and, eq, isNull, desc, count, max } from 'drizzle-orm';
import { requireStudioId } from '@/lib/studio/studio-context';
import { auth } from '@/lib/auth/auth';
import { handleApiError } from '@/lib/security/error-sanitizer';
import { auditHelpers } from '@/lib/security/audit-system';
import { generateInvoicePDF, InvoiceIdentityIncompleteError } from '@/lib/invoice/invoice.generator';
import { getStudioConfig } from '@/lib/studio/server';
import {
  sendPaymentReminderEmail,
  sendInvoiceToCustomEmail,
} from '@/lib/email/resend';
import { differenceInDays } from 'date-fns';

// ─── Input schemas ────────────────────────────────────────────────────────────

const sendReminderSchema = z.object({
  purchaseId: z.string().uuid(),
  customMessage: z.string().max(1000).optional(),
});

const sendToEmailSchema = z.object({
  purchaseId: z.string().uuid(),
  recipientEmail: z.string().email('Invalid email address'),
  customMessage: z.string().min(1, 'A message is required').max(2000),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchPurchaseForInvoice(purchaseId: string, studioId: string) {
  const [row] = await db
    .select({
      id: creditPurchases.id,
      studioId: creditPurchases.studioId,
      userId: creditPurchases.userId,
      invoiceNumber: creditPurchases.invoiceNumber,
      packageName: creditPackages.name,
      adminNotes: creditPurchases.adminNotes,
      creditsAmount: creditPurchases.creditsAmount,
      creditType: creditPurchases.creditType,
      priceCents: creditPurchases.priceCents,
      currency: creditPurchases.currency,
      paymentMethod: creditPurchases.paymentMethod,
      paymentStatus: creditPurchases.paymentStatus,
      paymentDueDate: creditPurchases.paymentDueDate,
      invoiceIssuedAt: creditPurchases.invoiceIssuedAt,
      createdAt: creditPurchases.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(creditPurchases)
    .leftJoin(creditPackages, eq(creditPurchases.packageId, creditPackages.id))
    .leftJoin(users, and(eq(creditPurchases.userId, users.id), isNull(users.deletedAt))) // [FIX-1]
    .where(and(eq(creditPurchases.id, purchaseId), eq(creditPurchases.studioId, studioId)))
    .limit(1);

  return row ?? null;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Admin sends a payment reminder email to the client with invoice PDF attached.
 * Creates an immutable audit record in invoice_reminders.
 */
export async function sendInvoiceReminderAction(
  input: z.infer<typeof sendReminderSchema>,
): Promise<{ success: boolean; error?: string; data?: { reminderId: string } }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = sendReminderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { purchaseId, customMessage } = parsed.data;

  try {
    const studioId = await requireStudioId();
    const purchase = await fetchPurchaseForInvoice(purchaseId, studioId);

    if (!purchase) return { success: false, error: 'Purchase not found' };
    if (!purchase.invoiceNumber) return { success: false, error: 'This purchase has no invoice number and cannot have a reminder sent' };
    if (!purchase.userEmail) return { success: false, error: 'Client email not found' };
    if (!['pending', 'overdue'].includes(purchase.paymentStatus)) {
      return { success: false, error: 'Reminders can only be sent for pending or overdue invoices' };
    }

    const daysPastDue = purchase.paymentDueDate
      ? Math.max(0, differenceInDays(new Date(), purchase.paymentDueDate))
      : 0;

    const studioConfig = await getStudioConfig();
    const pdfBuffer = await generateInvoicePDF({
      invoiceNumber: purchase.invoiceNumber,
      invoiceDate: purchase.invoiceIssuedAt ?? purchase.createdAt,
      dueDate: purchase.paymentDueDate ?? purchase.createdAt,
      customerId: purchase.userId,
      customerName: purchase.userName ?? 'Client',
      customerEmail: purchase.userEmail,
      customerAddress: null,
      packageName: purchase.packageName ?? purchase.adminNotes ?? 'Credit Package',
      creditsAmount: purchase.creditsAmount,
      creditType: purchase.creditType,
      priceCents: purchase.priceCents,
      currency: purchase.currency,
      paymentMethod: purchase.paymentMethod,
      paymentStatus: purchase.paymentStatus,
    }, studioConfig);

    const subject = `Payment reminder: ${purchase.invoiceNumber}`;
    const { messageId } = await sendPaymentReminderEmail(
      purchase.userEmail,
      purchase.userName ?? 'there',
      purchase.invoiceNumber,
      purchase.packageName ?? purchase.adminNotes ?? 'Credit Package',
      purchase.priceCents,
      purchase.currency,
      purchase.paymentDueDate ?? purchase.createdAt,
      daysPastDue,
      pdfBuffer,
      customMessage,
    );

    // Immutable audit record — never update
    const [reminder] = await db
      .insert(invoiceReminders)
      .values({
        studioId: purchase.studioId,
        purchaseId,
        sentByAdminId: session.user.id,
        recipientEmail: purchase.userEmail,
        subject,
        customMessage: customMessage ?? null,
        reminderType: 'overdue_reminder',
        deliveryStatus: 'sent',
        resendMessageId: messageId ?? null,
      })
      .returning({ id: invoiceReminders.id });

    await auditHelpers.logAdminAction(
      session.user.id,
      'send_invoice_reminder',
      'credit_purchase',
      purchaseId,
      { invoiceNumber: purchase.invoiceNumber, recipientEmail: purchase.userEmail, daysPastDue },
    );

    return { success: true, data: { reminderId: reminder.id } };
  } catch (error) {
    if (error instanceof InvoiceIdentityIncompleteError) {
      return { success: false, error: 'Studio identity is incomplete. Please complete the studio settings before sending invoices.' };
    }
    const e = handleApiError(error, 'send-invoice-reminder');
    return { success: false, error: e.error };
  }
}

/**
 * Admin sends an invoice to any email address with a custom message.
 * Creates an immutable audit record in invoice_reminders.
 */
export async function sendInvoiceToEmailAction(
  input: z.infer<typeof sendToEmailSchema>,
): Promise<{ success: boolean; error?: string; data?: { reminderId: string } }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = sendToEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { purchaseId, recipientEmail, customMessage } = parsed.data;

  try {
    const studioId = await requireStudioId();
    const purchase = await fetchPurchaseForInvoice(purchaseId, studioId);

    if (!purchase) return { success: false, error: 'Purchase not found' };
    if (!purchase.invoiceNumber) return { success: false, error: 'This purchase has no invoice on record' };

    const studioConfig = await getStudioConfig();
    const pdfBuffer = await generateInvoicePDF({
      invoiceNumber: purchase.invoiceNumber,
      invoiceDate: purchase.invoiceIssuedAt ?? purchase.createdAt,
      dueDate: purchase.paymentDueDate ?? purchase.createdAt,
      customerId: purchase.userId,
      customerName: purchase.userName ?? 'Client',
      customerEmail: purchase.userEmail ?? recipientEmail,
      customerAddress: null,
      packageName: purchase.packageName ?? purchase.adminNotes ?? 'Credit Package',
      creditsAmount: purchase.creditsAmount,
      creditType: purchase.creditType,
      priceCents: purchase.priceCents,
      currency: purchase.currency,
      paymentMethod: purchase.paymentMethod,
      paymentStatus: purchase.paymentStatus,
    }, studioConfig);

    const subject = `Invoice ${purchase.invoiceNumber}`;
    const { messageId } = await sendInvoiceToCustomEmail(
      recipientEmail,
      purchase.invoiceNumber,
      purchase.packageName ?? purchase.adminNotes ?? 'Credit Package',
      purchase.priceCents,
      purchase.currency,
      pdfBuffer,
      customMessage,
    );

    const [reminder] = await db
      .insert(invoiceReminders)
      .values({
        studioId: purchase.studioId,
        purchaseId,
        sentByAdminId: session.user.id,
        recipientEmail,
        subject,
        customMessage,
        reminderType: 'custom_send',
        deliveryStatus: 'sent',
        resendMessageId: messageId ?? null,
      })
      .returning({ id: invoiceReminders.id });

    await auditHelpers.logAdminAction(
      session.user.id,
      'send_invoice_custom_email',
      'credit_purchase',
      purchaseId,
      { invoiceNumber: purchase.invoiceNumber, recipientEmail },
    );

    return { success: true, data: { reminderId: reminder.id } };
  } catch (error) {
    if (error instanceof InvoiceIdentityIncompleteError) {
      return { success: false, error: 'Studio identity is incomplete. Please complete the studio settings before sending invoices.' };
    }
    const e = handleApiError(error, 'send-invoice-to-email');
    return { success: false, error: e.error };
  }
}

/**
 * Get reminder history for a purchase. Used by the admin payments page.
 */
export async function getPurchaseReminderHistoryAction(
  purchaseId: string,
): Promise<{ success: boolean; data?: { count: number; lastSentAt: Date | null } }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false };
  }

  const studioId = await requireStudioId();
  const [result] = await db
    .select({
      count: count(),
      lastSentAt: max(invoiceReminders.createdAt),
    })
    .from(invoiceReminders)
    .where(and(eq(invoiceReminders.purchaseId, purchaseId), eq(invoiceReminders.studioId, studioId)));

  return {
    success: true,
    data: { count: result?.count ?? 0, lastSentAt: result?.lastSentAt ?? null },
  };
}
