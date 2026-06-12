import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRole } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/security/error-sanitizer';
import { getAllCreditPurchasesAction, updateCreditPurchaseAction } from '@/modules/billing/actions/creditPurchase.actions';
import { getLogger } from '@/lib/logger';

const logger = getLogger('admin-purchases');

// GET all credit purchases (admin only)
export async function GET(request: NextRequest) {
  const authResult = await requireAdminRole(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const result = await getAllCreditPurchasesAction();
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.code === 'UNAUTHORIZED' ? 401 : 500 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching credit purchases');
    const errorResponse = handleApiError(error, 'admin-purchases-get');
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// POST - Update credit purchase status (mark as paid, etc.)
export async function POST(request: NextRequest) {
  const authResult = await requireAdminRole(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const result = await updateCreditPurchaseAction(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.code === 'UNAUTHORIZED' ? 401 : result.code === 'INVALID_STATE' ? 400 : 500 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    logger.error({ err: error }, 'Error updating credit purchase');
    const errorResponse = handleApiError(error, 'admin-purchases-update');
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
