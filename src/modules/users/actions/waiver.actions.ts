'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { auth } from '@/lib/auth/auth';
import { WAIVER_VERSION } from '@/lib/legal/waiver-content';
import { sendWaiverSignedEmail } from '@/lib/email/waiver.emails';
import { getStudioConfig } from '@/lib/studio/server';
import { APP_CONFIG } from '@/constants/APP_CONFIG';
import type { ServiceResult } from '@/modules/billing/services/credit.service';

type WaiverResult = ServiceResult<{ signedAt: Date; version: string }>;

/**
 * Record that the current session user has signed the liability waiver.
 * The userId argument is verified against the session to prevent CSRF/IDOR.
 */
export async function signWaiverAction(userId: string): Promise<WaiverResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };
  }

  if (session.user.id !== userId) {
    return { success: false, error: 'Access denied.', code: 'UNAUTHORIZED' };
  }

  const now = new Date();

  const [updated] = await db
    .update(users)
    .set({
      hasSignedWaiver: true,
      waiverSignedAt: now,
      waiverVersion: WAIVER_VERSION,
      updatedAt: now,
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      hasSignedWaiver: users.hasSignedWaiver,
      waiverSignedAt: users.waiverSignedAt,
      waiverVersion: users.waiverVersion,
    });

  if (!updated) {
    return { success: false, error: 'User not found.', code: 'NOT_FOUND' };
  }

  revalidatePath('/');
  revalidatePath('/book');

  // Fire-and-forget confirmation email — failure must not block the UX.
  Promise.resolve().then(async () => {
    try {
      const studioConfig = await getStudioConfig();
      const studioName = studioConfig.identity?.name ?? process.env.STUDIO_NAME ?? APP_CONFIG.APP_NAME;
      await sendWaiverSignedEmail(
        updated.email,
        updated.name,
        studioName,
        updated.waiverSignedAt!,
      );
    } catch {
      // Email failures are non-critical; the waiver is already recorded.
    }
  });

  return {
    success: true,
    data: { signedAt: updated.waiverSignedAt!, version: updated.waiverVersion! },
  };
}
