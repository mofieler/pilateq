'use server';

import { auth } from '@/lib/auth/auth';
import { cancellationService } from '@/modules/booking/services/cancellation.service';
import { MERCY_USES_PER_MONTH } from '@/constants/BOOKING_RULES';

/**
 * Remaining late-cancellation mercy uses for the current calendar month.
 * Replaces the lifetime getMercyAvailable() helper.
 * userId is derived from the session — never accepted from the caller.
 */
export async function getMercyContext(): Promise<{
  mercyUsesLeft: number;
  mercyUsesLimit: number;
  usedThisMonth: number;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { mercyUsesLeft: 0, mercyUsesLimit: MERCY_USES_PER_MONTH, usedThisMonth: 0 };
  }
  return cancellationService.getMercyContext(session.user.id);
}
