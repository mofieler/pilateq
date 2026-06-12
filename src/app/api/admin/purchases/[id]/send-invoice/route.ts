import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRole } from '@/lib/auth/api-auth';
import { sendInvoiceToEmailAction } from '@/modules/billing/actions/invoiceReminder.actions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminRole(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id: purchaseId } = await params;

  let body: { recipientEmail?: string; customMessage?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body required' }, { status: 400 });
  }

  if (!body.recipientEmail || !body.customMessage) {
    return NextResponse.json(
      { error: 'recipientEmail and customMessage are required' },
      { status: 400 },
    );
  }

  const result = await sendInvoiceToEmailAction({
    purchaseId,
    recipientEmail: body.recipientEmail,
    customMessage: body.customMessage,
  });

  if (!result.success) {
    const status = result.error === 'Unauthorized' ? 401 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result.data);
}
