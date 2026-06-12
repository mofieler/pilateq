'use server';

import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth, unstable_update } from '@/lib/auth/auth';
import { sendWelcomeEmail } from '@/lib/email/resend';

const completeProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  phone: z.string().max(50).optional(),
});

export async function completeProfileAction(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' };

  try {
    const validated = completeProfileSchema.parse(input);

    await db
      .update(users)
      .set({
        name: validated.name,
        phone: validated.phone ?? null,
        profileCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    // Clear the needsProfileCompletion flag in the JWT
    await unstable_update({ needsProfileCompletion: false } as any);

    // Fire-and-forget — welcome email failure must not block profile completion
    const userEmail = session.user.email;
    if (userEmail) {
      Promise.resolve().then(() =>
        sendWelcomeEmail(userEmail, validated.name).catch((err) =>
          console.warn('[email] Welcome email failed:', err),
        ),
      ).catch(() => {});
    }

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message ?? 'Invalid input' };
    }
    console.error('[COMPLETE_PROFILE] Error:', error);
    return { success: false, error: 'Failed to save profile' };
  }
}
