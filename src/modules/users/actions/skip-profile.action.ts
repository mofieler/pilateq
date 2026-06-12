'use server';

import { auth, unstable_update } from '@/lib/auth/auth';

/**
 * Dismiss the profile completion overlay for this session only.
 * Does NOT set profileCompleted in the DB, so the overlay reappears next login.
 */
export async function skipProfileCompletionAction() {
  const session = await auth();
  if (!session?.user?.id) return { success: false };
  await unstable_update({ needsProfileCompletion: false } as any);
  return { success: true };
}
