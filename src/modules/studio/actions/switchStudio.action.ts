'use server';

import { z } from 'zod';
import { unstable_update } from '@/lib/auth/auth';
import { auth } from '@/lib/auth/auth';
import { getMembership } from '@/lib/studio/membership';

const switchStudioSchema = z.object({
  studioId: z.string().uuid(),
});

export type SwitchStudioInput = z.infer<typeof switchStudioSchema>;

/**
 * Switch the active studio for the current user.
 *
 * Validates that the user has an active membership for the requested studio,
 * then updates the session with the new studioId and memberRole.
 */
export async function switchStudioAction(input: unknown) {
  try {
    const validated = switchStudioSchema.parse(input);
    const session = await auth();

    if (!session?.user?.id) {
      return {
        success: false as const,
        error: 'Unauthorized',
      };
    }

    const membership = await getMembership(session.user.id, validated.studioId);
    if (!membership || membership.status !== 'active') {
      return {
        success: false as const,
        error: 'No active membership for this studio',
      };
    }

    await unstable_update({
      user: {
        studioId: membership.studioId,
        memberRole: membership.role,
      },
    });

    return {
      success: true as const,
      studioId: membership.studioId,
      memberRole: membership.role,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return {
        success: false as const,
        error: firstError ? firstError.message : 'Invalid input',
      };
    }

    console.error('[switchStudioAction] Error:', error);
    return {
      success: false as const,
      error: 'A technical problem occurred — please try again later.',
    };
  }
}
