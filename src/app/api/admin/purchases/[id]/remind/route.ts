import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRole } from '@/lib/auth/api-auth';
import { sendInvoiceReminderAction } from '@/modules/billing/actions/invoiceReminder.actions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminRole(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id: purchaseId } = await params;

  let body: { customMessage?: string } = {};
  try {
    body = await request.json();
  } catch {
    // no body is fine — customMessage is optional
  }

  const result = await sendInvoiceReminderAction({
    purchaseId,
    customMessage: body.customMessage,
  });

  if (!result.success) {
    const status = result.error === 'Unauthorized' ? 401 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result.data);
}
