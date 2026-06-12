'use server';

import { z } from 'zod';
import { db } from '@/db';
import { waitlistEntries, classSessions } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import type { ServiceResult, ServiceErrorCode } from '@/modules/billing/services/credit.service';
import { requireStudioId } from '@/lib/studio/studio-context';
import { getLogger } from '@/lib/logger';

const logger = getLogger('join-waitlist');

const schema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});

export async function joinWaitlistAction(
  input: z.infer<typeof schema>,
): Promise<ServiceResult<{ position: number }>> {
  const authSession = await auth();
  if (!authSession?.user?.id) {
    return { success: false, error: 'Please sign in to join the waitlist.', code: 'UNAUTHORIZED' };
  }
  const userId = authSession.user.id;

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
      code: 'INVALID_STATE',
    };
  }
  const { sessionId } = parsed.data;

  try {
    const studioId = await requireStudioId();

    const result = await db.transaction(async (tx) => {
      // Lock the session row to prevent race conditions while reading capacity.
      const [session] = await tx
        .select({
          id: classSessions.id,
          studioId: classSessions.studioId,
          bookedCount: classSessions.bookedCount,
          maxCapacity: classSessions.maxCapacity,
          status: classSessions.status,
          startsAt: classSessions.startsAt,
          templateId: classSessions.templateId,
        })
        .from(classSessions)
        .where(eq(classSessions.id, sessionId))
        .for('update')
        .limit(1);

      if (!session) {
        throw new WaitlistError('Session not found.', 'NOT_FOUND');
      }
      if (session.studioId !== studioId) {
        throw new WaitlistError('Session not found.', 'NOT_FOUND');
      }
      if (session.status !== 'scheduled') {
        throw new WaitlistError('This class is no longer available.', 'INVALID_STATE');
      }
      if (session.startsAt <= new Date()) {
        throw new WaitlistError('This class has already started.', 'INVALID_STATE');
      }
      if (session.bookedCount < session.maxCapacity) {
        throw new WaitlistError('Spots are available — book the class instead.', 'CLASS_FULL');
      }

      // Ensure the user hasn't already joined this waitlist.
      const [existing] = await tx
        .select({ id: waitlistEntries.id, status: waitlistEntries.status })
        .from(waitlistEntries)
        .where(
          and(
            eq(waitlistEntries.studioId, studioId),
            eq(waitlistEntries.userId, userId),
            eq(waitlistEntries.sessionId, sessionId),
          ),
        )
        .limit(1);

      if (existing) {
        if (existing.status === 'waiting' || existing.status === 'offered') {
          throw new WaitlistError('You are already on the waitlist for this class.', 'ALREADY_ON_WAITLIST');
        }
        // A cancelled/declined/expired entry can be re-added; fall through.
      }

      // Determine the next position (FIFO: highest existing position + 1).
      const [lastEntry] = await tx
        .select({ position: waitlistEntries.position })
        .from(waitlistEntries)
        .where(and(eq(waitlistEntries.studioId, studioId), eq(waitlistEntries.sessionId, sessionId)))
        .orderBy(desc(waitlistEntries.position))
        .limit(1);

      const nextPosition = (lastEntry?.position ?? 0) + 1;

      const [entry] = await tx
        .insert(waitlistEntries)
        .values({
          studioId,
          userId,
          sessionId,
          position: nextPosition,
          status: 'waiting',
        })
        .returning({ position: waitlistEntries.position });

      return entry;
    });

    revalidatePath('/book');
    return { success: true, data: { position: result.position } };
  } catch (err) {
    if (err instanceof WaitlistError) {
      return { success: false, error: err.message, code: err.code };
    }
    logger.error({ err }, 'joinWaitlistAction failed');
    return { success: false, error: 'Failed to join waitlist.', code: 'DB_ERROR' };
  }
}

class WaitlistError extends Error {
  constructor(
    message: string,
    public readonly code: ServiceErrorCode,
  ) {
    super(message);
    this.name = 'WaitlistError';
  }
}
