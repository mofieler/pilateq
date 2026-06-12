import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRole } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/security/error-sanitizer';
import { getLogger } from '@/lib/logger';

const logger = getLogger('admin-purchases-manual');
import { createManualPurchaseAction } from '@/modules/billing/actions/creditPurchase.actions';

export async function POST(request: NextRequest) {
  const authResult = await requireAdminRole(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const result = await createManualPurchaseAction(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.code === 'UNAUTHORIZED' ? 401 : result.code === 'INVALID_INPUT' ? 400 : 500 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    logger.error({ err: error }, 'Error creating manual purchase');
    const errorResponse = handleApiError(error, 'admin-purchases-manual');
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
