'use server';

import { auth } from '@/lib/auth/auth';
import {
  getUserBillingStatus,
  type BillingStatus,
} from '@/modules/billing/services/billingStatus.service';

// Lightweight server action so the client-side reminder popup can fetch
// the current billing status without exposing the service to the browser bundle.
export async function getMyBillingStatusAction(): Promise<BillingStatus | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const studioId = session.user.studioId;
  if (!studioId) return null;
  return getUserBillingStatus(session.user.id, studioId);
}
