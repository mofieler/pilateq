import crypto from 'crypto';
import { db } from '@/db';
import { duoInvites, bookings, classSessions, classTemplates, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { creditService } from '@/modules/billing/services/credit.service';
import {
  DUO_INVITE_CUTOFF_HOURS_BEFORE_CLASS,
  DUO_INVITE_MAX_LIFETIME_HOURS,
} from '@/lib/config/duo-invite';
import type { CreditType } from '@/lib/config/class-types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvitePageData {
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expiresAt: Date;
  organizerFirstName: string;
  /** Server-side only — for self-invite check. Never render in UI (DSGVO). */
  organizerUserId: string;
  studioId: string;
  sessionId: string;
  sessionName: string;
  startsAt: Date;
  durationMinutes: number;
  location: string | null;
  creditType: string;
  creditCost: number;
}

export interface EligibilityResult {
  hasCredits: boolean;
  balance: number;
  isAlreadyBooked: boolean;
  isSelf: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeExpiry(sessionStartsAt: Date): Date {
  const cutoffMs = DUO_INVITE_CUTOFF_HOURS_BEFORE_CLASS * 60 * 60 * 1000;
  const maxLifetimeMs = DUO_INVITE_MAX_LIFETIME_HOURS * 60 * 60 * 1000;
  const cutoffBeforeClass = new Date(sessionStartsAt.getTime() - cutoffMs);
  const maxLifetimeFromNow = new Date(Date.now() + maxLifetimeMs);
  return new Date(Math.min(cutoffBeforeClass.getTime(), maxLifetimeFromNow.getTime()));
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const duoInviteService = {
  async create(
    studioId: string,
    organizerBookingId: string,
    organizerUserId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const [booking] = await db
      .select({ sessionId: bookings.sessionId })
      .from(bookings)
      .where(and(eq(bookings.id, organizerBookingId), eq(bookings.studioId, studioId)))
      .limit(1);

    if (!booking?.sessionId) throw new Error('Booking not found');

    const [session] = await db
      .select({ startsAt: classSessions.startsAt })
      .from(classSessions)
      .where(and(eq(classSessions.id, booking.sessionId), eq(classSessions.studioId, studioId)))
      .limit(1);

    if (!session) throw new Error('Session not found');

    const expiresAt = computeExpiry(session.startsAt);
    const token = crypto.randomBytes(32).toString('hex');

    await db.insert(duoInvites).values({
      studioId,
      organizerBookingId,
      organizerUserId,
      sessionId: booking.sessionId,
      token,
      expiresAt,
    });

    return { token, expiresAt };
  },

  async getByToken(token: string, studioId?: string) {
    const where = studioId
      ? and(eq(duoInvites.token, token), eq(duoInvites.studioId, studioId))
      : eq(duoInvites.token, token);
    const [invite] = await db.select().from(duoInvites).where(where).limit(1);
    return invite ?? null;
  },

  async getInvitePageData(token: string, studioId?: string): Promise<InvitePageData | null> {
    const baseWhere = eq(duoInvites.token, token);
    const where = studioId ? and(baseWhere, eq(duoInvites.studioId, studioId)) : baseWhere;

    const [row] = await db
      .select({
        status: duoInvites.status,
        expiresAt: duoInvites.expiresAt,
        organizerName: users.name,
        organizerUserId: duoInvites.organizerUserId,
        studioId: duoInvites.studioId,
        sessionId: classSessions.id,
        sessionName: classTemplates.name,
        startsAt: classSessions.startsAt,
        durationMinutes: classTemplates.durationMinutes,
        location: classTemplates.location,
        creditType: classTemplates.creditType,
        creditCost: classTemplates.creditCost,
      })
      .from(duoInvites)
      .innerJoin(classSessions, eq(duoInvites.sessionId, classSessions.id))
      .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
      .innerJoin(
        users,
        and(eq(duoInvites.organizerUserId, users.id), isNull(users.deletedAt)),
      )
      .where(where)
      .limit(1);

    if (!row) return null;

    // DSGVO: only first name, never full name, email, or photo
    const firstName = (row.organizerName ?? 'Someone').split(' ')[0];

    return {
      status: row.status,
      expiresAt: row.expiresAt,
      organizerFirstName: firstName,
      organizerUserId: row.organizerUserId,
      studioId: row.studioId,
      sessionId: row.sessionId,
      sessionName: row.sessionName,
      startsAt: row.startsAt,
      durationMinutes: row.durationMinutes,
      location: row.location,
      creditType: row.creditType,
      creditCost: row.creditCost,
    };
  },

  async checkPartnerEligibility(
    studioId: string,
    userId: string,
    sessionId: string,
    organizerUserId: string,
    creditType: string,
    creditCost: number,
  ): Promise<EligibilityResult> {
    const isSelf = userId === organizerUserId;

    // Balance check using the unified ledger
    const hasCredits = await creditService.hasSufficientCredits(
      studioId,
      userId,
      creditType as CreditType,
      creditCost,
    );

    // For the UI: total credits the partner currently has available
    const totalAvailable = await creditService.getBalance(studioId, userId, creditType as CreditType);

    const [existing] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.studioId, studioId),
          eq(bookings.userId, userId),
          eq(bookings.sessionId, sessionId),
          eq(bookings.status, 'confirmed'),
        ),
      )
      .limit(1);

    return {
      hasCredits,
      balance: totalAvailable,
      isAlreadyBooked: !!existing,
      isSelf,
    };
  },
};
