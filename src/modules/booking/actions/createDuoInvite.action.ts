'use server';

import { z } from 'zod';
import { db } from '@/db';
import { bookings, classSessions, classTemplates, duoInvites, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { requireStudioId } from '@/lib/studio/studio-context';
import { duoInviteService } from '@/modules/booking/services/duo-invite.service';
import { isDuoClassType } from '@/lib/config/class-types';
import { checkRateLimit, duoInviteRateLimitConfig } from '@/lib/security/server-action-rate-limiter';
import { sendDuoInviteCreatedEmail } from '@/lib/email/duo.emails';
import { formatStudio, formatStudioTime } from '@/lib/utils/date.utils';

const schema = z.object({
  bookingId: z.string().uuid(),
});

export async function createDuoInviteAction(
  input: z.infer<typeof schema>,
): Promise<{ success: boolean; error?: string; code?: string; data?: { token: string; expiresAt: Date } }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };
  const userId = session.user.id;

  const rateLimit = await checkRateLimit(duoInviteRateLimitConfig, userId);
  if (!rateLimit.success) {
    return { success: false, error: 'Rate limit exceeded. Please try again later.', code: 'RATE_LIMITED' };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };
  const { bookingId } = parsed.data;

  // Verify booking belongs to this user
  const [booking] = await db
    .select({ sessionId: bookings.sessionId })
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId), eq(bookings.status, 'confirmed')))
    .limit(1);

  if (!booking?.sessionId) return { success: false, error: 'Booking not found' };

  // Verify it's a duo class
  const [session2] = await db
    .select({ templateId: classSessions.templateId })
    .from(classSessions)
    .where(eq(classSessions.id, booking.sessionId))
    .limit(1);

  if (!session2?.templateId) return { success: false, error: 'Session not found' };

  const [template] = await db
    .select({ classType: classTemplates.classType })
    .from(classTemplates)
    .where(eq(classTemplates.id, session2.templateId))
    .limit(1);

  if (!template || !isDuoClassType(template.classType)) {
    return { success: false, error: 'This class does not support duo invites' };
  }

  // Check no active invite already exists for this booking
  const [existing] = await db
    .select({ id: duoInvites.id })
    .from(duoInvites)
    .where(and(eq(duoInvites.organizerBookingId, bookingId), eq(duoInvites.status, 'pending')))
    .limit(1);

  if (existing) {
    // Return the existing invite token instead of creating a duplicate
    const [existingFull] = await db
      .select({ token: duoInvites.token, expiresAt: duoInvites.expiresAt })
      .from(duoInvites)
      .where(eq(duoInvites.id, existing.id))
      .limit(1);
    if (existingFull) return { success: true, data: { token: existingFull.token, expiresAt: existingFull.expiresAt } };
  }

  try {
    const studioId = await requireStudioId();
    const result = await duoInviteService.create(studioId, bookingId, userId);

    // Send email to organizer with the invite link
    const [organizer] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const [sessionRow] = await db
      .select({
        startsAt: classSessions.startsAt,
        templateId: classSessions.templateId,
      })
      .from(classSessions)
      .where(eq(classSessions.id, booking.sessionId))
      .limit(1);

    const [templateRow] = await db
      .select({ name: classTemplates.name })
      .from(classTemplates)
      .where(eq(classTemplates.id, sessionRow?.templateId ?? ''))
      .limit(1);

    if (organizer && sessionRow && templateRow) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
      await sendDuoInviteCreatedEmail(
        organizer.email,
        organizer.name,
        `${appUrl}/invite/${result.token}`,
        templateRow.name,
        formatStudio(sessionRow.startsAt, 'EEEE, d MMMM'),
        formatStudioTime(sessionRow.startsAt),
        formatStudio(result.expiresAt, 'd MMMM'),
      );
    }

    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create invite' };
  }
}
