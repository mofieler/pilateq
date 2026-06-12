import { NextResponse } from 'next/server';
import { getActiveMembershipPlansAction } from '@/modules/billing/actions/membership.actions';

/**
 * GET /api/membership-plans
 * Returns active membership plans for the public purchase page.
 */
export async function GET() {
  const result = await getActiveMembershipPlansAction();
  return NextResponse.json({ plans: result.data ?? [] });
}
