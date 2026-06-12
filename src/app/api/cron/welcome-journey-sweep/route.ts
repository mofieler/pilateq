import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/db';
import { eq, and, isNull, lte, gt } from 'drizzle-orm';
import { welcomeJourneyRequests, users } from '@/db/schema';
import { sendWelcomeJourneyExpiryWarning } from '@/lib/email/welcome.emails';
import { expireWelcomeJourneySlots } from '@/modules/welcome/services/slotManager.service';
import {
  WELCOME_JOURNEY_EXPIRY_WARNING_WINDOW_HOURS,
  WELCOME_JOURNEY_REQUEST_STATUS,
} from '@/constants/BOOKING_RULES';
import { getLogger } from '@/lib/logger';

const logger = getLogger('welcome-journey-sweep-cron');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  let warningsSentCount = 0;
  let expiredCount = 0;

  try {
    const now = new Date();
    const warnWindowEndsAt = new Date(
      Date.now() + WELCOME_JOURNEY_EXPIRY_WARNING_WINDOW_HOURS * 60 * 60 * 1000
    );

    // 1. Process warnings (slots expiring in <= 2 hours, warning not sent yet)
    const warningCandidates = await db
      .select({
        request: welcomeJourneyRequests,
        user: users,
      })
      .from(welcomeJourneyRequests)
      .innerJoin(users, eq(welcomeJourneyRequests.userId, users.id))
      .where(
        and(
          eq(welcomeJourneyRequests.status, WELCOME_JOURNEY_REQUEST_STATUS.slotsOffered),
          isNull(welcomeJourneyRequests.warningEmailSentAt),
          lte(welcomeJourneyRequests.expiresAt, warnWindowEndsAt),
          gt(welcomeJourneyRequests.expiresAt, now)
        )
      );

    for (const row of warningCandidates) {
      if (row.user.email && row.request.expiresAt) {
        try {
          await sendWelcomeJourneyExpiryWarning(
            row.user.email,
            row.user.name ?? 'there',
            row.request.expiresAt
          );
          
          await db
            .update(welcomeJourneyRequests)
            .set({ warningEmailSentAt: new Date() })
            .where(eq(welcomeJourneyRequests.id, row.request.id));
            
          warningsSentCount++;
        } catch (warnErr) {
          logger.error({ err: warnErr, requestId: row.request.id }, 'Failed warning email');
        }
      }
    }

    // 2. Process expirations (slots expired, i.e., expiresAt <= now)
    const expirationCandidates = await db
      .select({
        id: welcomeJourneyRequests.id,
        studioId: welcomeJourneyRequests.studioId,
      })
      .from(welcomeJourneyRequests)
      .where(
        and(
          eq(welcomeJourneyRequests.status, WELCOME_JOURNEY_REQUEST_STATUS.slotsOffered),
          lte(welcomeJourneyRequests.expiresAt, now)
        )
      );

    for (const row of expirationCandidates) {
      try {
        const res = await expireWelcomeJourneySlots(row.id, row.studioId);
        if (res.success) {
          expiredCount++;
        } else {
          logger.error({ requestId: row.id, error: res.error }, 'Expiration failed');
        }
      } catch (expErr) {
        logger.error({ err: expErr, requestId: row.id }, 'Exception during expiration');
      }
    }

    const durationMs = Date.now() - startedAt;
    logger.info(
      { warningsSentCount, expiredCount, durationMs },
      'Welcome Journey sweep complete'
    );

    return NextResponse.json({
      success: true,
      warningsSent: warningsSentCount,
      expired: expiredCount,
      durationMs,
    });
  } catch (err) {
    logger.error({ err }, 'Welcome Journey sweep failed');
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
