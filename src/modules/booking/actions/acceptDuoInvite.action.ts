'use server';

import { z } from 'zod';
import { db } from '@/db';
import { duoInvites, bookings, classSessions, classTemplates, users, instructors, creditTransactions } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';

import { revalidatePath } from 'next/cache';
import { hasCompletedWelcome } from '@/lib/welcome';
import { checkRateLimit, duoInviteRateLimitConfig } from '@/lib/security/server-action-rate-limiter';
import {
  sendDuoInviteAcceptedEmailToOrganizer,
  sendDuoInviteAcceptedConfirmationToPartner,
  sendDuoBookingConfirmedEmailToInstructor,
} from '@/lib/email/duo.emails';
import { formatStudio, formatStudioTime } from '@/lib/utils/date.utils';
import { resolveAccessGrant, EntitlementError } from '@/modules/access/entitlement.service';
import { getStudioConfigContext } from '@/lib/studio/server';

const schema = z.object({
  token: z.string().min(1).max(64),
});

export async function acceptDuoInviteAction(
  input: z.infer<typeof schema>,
): Promise<{ success: boolean; error?: string; code?: string }> {
  const authSession = await auth();
  if (!authSession?.user?.id) return { success: false, error: 'Please sign in to accept this invite', code: 'UNAUTHORIZED' };
  const userId = authSession.user.id;

  const rateLimit = await checkRateLimit(duoInviteRateLimitConfig, userId);
  if (!rateLimit.success) {
    return { success: false, error: 'Rate limit exceeded. Please try again later.', code: 'RATE_LIMITED' };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid token', code: 'INVALID_INPUT' };
  const { token } = parsed.data;

  // Studio config is required by the Access Entitlement Service.
  const studioCtx = await getStudioConfigContext();
  const studio = studioCtx.config;
  const studioId = studio.id ?? 'legacy';

  try {
    await db.transaction(async (tx) => {
      // Fetch and lock the invite
      const [invite] = await tx
        .select()
        .from(duoInvites)
        .where(and(eq(duoInvites.token, token), eq(duoInvites.studioId, studioId)))
        .for('update')
        .limit(1);

      if (!invite) throw new DuoError('Invite not found', 'NOT_FOUND');
      if (invite.status !== 'pending') throw new DuoError('This invite is no longer available', 'INVALID_STATE');
      if (invite.expiresAt <= new Date()) throw new DuoError('This invite has expired', 'EXPIRED');
      if (invite.organizerUserId === userId) throw new DuoError('You cannot accept your own invite', 'SELF_INVITE');

      // Fetch and lock session
      const [session] = await tx
        .select()
        .from(classSessions)
        .where(and(eq(classSessions.id, invite.sessionId), eq(classSessions.studioId, studioId)))
        .for('update')
        .limit(1);

      if (!session) throw new DuoError('Session not found', 'NOT_FOUND');
      if (session.status !== 'scheduled') throw new DuoError('This class is no longer available', 'INVALID_STATE');
      if (session.startsAt <= new Date()) throw new DuoError('This class has already started', 'INVALID_STATE');
      if (session.bookedCount >= session.maxCapacity) throw new DuoError('This class is full', 'CLASS_FULL');

      // Get template for credit type/cost
      if (!session.templateId) throw new DuoError('Class configuration not found', 'NOT_FOUND');

      // Welcome Journey gate
      const welcomed = await hasCompletedWelcome(userId, tx);
      if (!welcomed) {
        const [templateCheck] = await tx
          .select({ isWelcomeJourney: classTemplates.isWelcomeJourney })
          .from(classTemplates)
          .where(and(eq(classTemplates.id, session.templateId), eq(classTemplates.studioId, studioId)))
          .limit(1);
        if (!templateCheck?.isWelcomeJourney) {
          throw new DuoError('Please complete your Welcome Journey first.', 'WELCOME_REQUIRED');
        }
      }

      // Check not already booked
      const [existing] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.userId, userId), eq(bookings.studioId, studioId), eq(bookings.sessionId, invite.sessionId), eq(bookings.status, 'confirmed')))
        .limit(1);

      if (existing) throw new DuoError('You are already booked for this class', 'BOOKING_ALREADY_EXISTS');

      const [template] = await tx
        .select({ creditType: classTemplates.creditType, creditCost: classTemplates.creditCost, classType: classTemplates.classType })
        .from(classTemplates)
        .where(and(eq(classTemplates.id, session.templateId), eq(classTemplates.studioId, studioId)))
        .limit(1);

      if (!template) throw new DuoError('Class configuration not found', 'NOT_FOUND');

      // ── Membership session-subtype restriction ──────────────────────────────
      const { checkMembershipSessionRestriction } = await import(
        '@/modules/billing/services/membershipRestriction.service'
      );
      const restriction = await checkMembershipSessionRestriction(tx, userId, template.classType);
      if (!restriction.allowed) {
        throw new DuoError(restriction.reason, 'INVALID_STATE');
      }

      // ── Phase 4: resolve and consume access entitlement ─────────────────────
      const { grant } = await resolveAccessGrant(
        {
          studioConfig: studio,
          studioId,
          userId,
          tx,
        },
        {
          classType: template.classType,
          sessionId: invite.sessionId,
          cost: template.creditCost,
        },
      );

      // Insert partner booking with access grant
      const [partnerBooking] = await tx
        .insert(bookings)
        .values({
          studioId,
          userId,
          sessionId: invite.sessionId,
          status: 'confirmed',
          creditsSpent: template.creditCost,
          creditType: template.creditType,
          accessProvider: grant.provider,
          accessGrant: {
            grantId: grant.grantId,
            provider: grant.provider,
            label: grant.label,
            quantityConsumed: grant.quantityConsumed,
            metadata: grant.metadata,
          },
        })
        .returning();

      // Link the credit transaction to the booking when the credit system was used.
      if (grant.provider === 'credit_system' && grant.metadata?.creditTransactionId) {
        await tx
          .update(creditTransactions)
          .set({ bookingId: partnerBooking.id })
          .where(eq(creditTransactions.id, grant.metadata.creditTransactionId as string));
      }

      // Increment booked count
      await tx
        .update(classSessions)
        .set({ bookedCount: session.bookedCount + 1, updatedAt: new Date() })
        .where(and(eq(classSessions.id, invite.sessionId), eq(classSessions.studioId, studioId)));

      // Mark invite as accepted (immutable audit — only status/partner fields change)
      await tx
        .update(duoInvites)
        .set({ status: 'accepted', partnerBookingId: partnerBooking.id, partnerUserId: userId, updatedAt: new Date() })
        .where(and(eq(duoInvites.id, invite.id), eq(duoInvites.studioId, studioId)));
    });

    revalidatePath('/book');
    revalidatePath('/');
    revalidatePath(`/invite/${token}`);

    // Fetch invite details after transaction for email notifications
    const [acceptedInvite] = await db
      .select({ organizerUserId: duoInvites.organizerUserId, sessionId: duoInvites.sessionId })
      .from(duoInvites)
      .where(and(eq(duoInvites.token, token), eq(duoInvites.studioId, studioId)))
      .limit(1);

    if (!acceptedInvite) return { success: true };

    // Send confirmation emails
    const [organizer] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, acceptedInvite.organizerUserId))
      .limit(1);

    const [partner] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const [sessionRow] = await db
      .select({
        startsAt: classSessions.startsAt,
        templateId: classSessions.templateId,
        instructorId: classSessions.instructorId,
      })
      .from(classSessions)
      .where(and(eq(classSessions.id, acceptedInvite.sessionId), eq(classSessions.studioId, studioId)))
      .limit(1);

    const [templateRow] = await db
      .select({ name: classTemplates.name })
      .from(classTemplates)
      .where(and(eq(classTemplates.id, sessionRow?.templateId ?? ''), eq(classTemplates.studioId, studioId)))
      .limit(1);

    if (organizer && partner && sessionRow && templateRow) {
      const classDate = formatStudio(sessionRow.startsAt, 'EEEE, d MMMM');
      const classTime = formatStudioTime(sessionRow.startsAt);

      const emailPromises: Promise<any>[] = [
        sendDuoInviteAcceptedEmailToOrganizer(
          organizer.email,
          organizer.name,
          partner.name,
          templateRow.name,
          classDate,
          classTime,
        ),
        sendDuoInviteAcceptedConfirmationToPartner(
          partner.email,
          partner.name,
          organizer.name,
          templateRow.name,
          classDate,
          classTime,
        ),
      ];

      // Notify instructor if configured
      if (sessionRow.instructorId) {
        const [instructorRow] = await db
          .select({ email: users.email, name: users.name })
          .from(instructors)
          .innerJoin(users, and(eq(instructors.userId, users.id), isNull(users.deletedAt)))
          .where(and(eq(instructors.id, sessionRow.instructorId), eq(instructors.studioId, studioId)))
          .limit(1);

        if (instructorRow?.email) {
          emailPromises.push(
            sendDuoBookingConfirmedEmailToInstructor(
              instructorRow.email,
              instructorRow.name ?? 'Instructor',
              organizer.name ?? 'Organizer',
              partner.name ?? 'Partner',
              templateRow.name,
              classDate,
              classTime,
            )
          );
        }
      }

      await Promise.all(emailPromises);
    }

    return { success: true };
  } catch (err) {
    if (err instanceof EntitlementError) {
      return { success: false, error: 'You don\'t have enough credits to join this class', code: 'INSUFFICIENT_CREDITS' };
    }
    if (err instanceof DuoError) {
      return { success: false, error: err.message, code: err.code };
    }
    return { success: false, error: 'Something went wrong. Please try again.', code: 'DB_ERROR' };
  }
}

class DuoError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DuoError';
  }
}
