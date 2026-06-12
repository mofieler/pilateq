import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/db';
import { userMemberships, users } from '@/db/schema';
import { and, eq, inArray, isNull, lte } from 'drizzle-orm';
import { addDays } from 'date-fns';
import {
  sendMembershipCreditGrantEmail,
  sendMembershipExpiryEmail,
} from '@/lib/email/resend';
import type { CreditType } from '@/db/schema';
import { creditService } from '@/modules/billing/services/credit.service';
import { getLogger } from '@/lib/logger';

const logger = getLogger('membership-credit-grant-cron');

// POST /api/cron/membership-credit-grant
// Runs weekly (e.g. every Monday at 06:00 UTC via Coolify scheduled task).
// Auth: Authorization: Bearer <CRON_SECRET>
//
// For every active membership whose next_credit_grant_at <= NOW():
//  1. Add weekly_credits to the user's credit_balance (atomic transaction).
//  2. Advance next_credit_grant_at by 7 days.
//  3. If ends_at has passed: mark membership expired + send expiry email.
//  4. Otherwise: send weekly grant notification email.
//
// [PERF] Batch-fetches user rows up-front to avoid N+1 queries.
// Uses creditService.addMembershipGrant + getBalance.

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

  const now = new Date();
  const startedAt = Date.now();

  const due = await db
    .select()
    .from(userMemberships)
    .where(
      and(
        eq(userMemberships.status, 'active'),
        lte(userMemberships.nextCreditGrantAt, now),
      ),
    );

  if (due.length === 0) {
    logger.info('membership-credit-grant: nothing due');
    return NextResponse.json({ ok: true, report: { processed: 0, granted: 0, expired: 0, errors: 0, ms: 0 } });
  }

  // Batch-fetch users so we don't N+1 during email sending.
  const userIds = [...new Set(due.map((m) => m.userId))];
  const userRows = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(and(inArray(users.id, userIds), isNull(users.deletedAt)));
  const userMap = new Map(userRows.map((u) => [u.id, u]));

  let granted = 0;
  let expired = 0;
  let errors = 0;

  for (const membership of due) {
    let isExpired = false;
    let newBalance: number | undefined;
    try {
      // Atomic: grant credits via ledger + advance schedule.
      // Re-read the membership under FOR UPDATE so overlapping cron runs don't
      // double-grant the same week's credits.
      await db.transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(userMemberships)
          .where(eq(userMemberships.id, membership.id))
          .for('update')
          .limit(1);

        if (!locked || locked.status !== 'active' || locked.nextCreditGrantAt > now) {
          // Another process already handled this membership — skip.
          return;
        }

        isExpired = locked.endsAt <= now;

        const transaction = await creditService.addMembershipGrant(tx, {
          studioId: locked.studioId,
          userId: locked.userId,
          creditType: locked.creditType as CreditType,
          amount: locked.weeklyCredits,
          membershipId: locked.id,
          expiresAt: locked.endsAt,
          description: `Membership weekly grant (membership ${locked.id})`,
        });
        newBalance = await creditService.getBalance(locked.studioId, locked.userId, locked.creditType as CreditType, tx);

        // Advance grant date by 7 days; expire if membership has ended
        await tx
          .update(userMemberships)
          .set({
            lastCreditGrantAt: now,
            nextCreditGrantAt: addDays(locked.nextCreditGrantAt, 7),
            status: isExpired ? 'expired' : 'active',
            updatedAt: now,
          })
          .where(eq(userMemberships.id, locked.id));
      });

      // Fire-and-forget email — never block the sweep on email failures
      const userRow = userMap.get(membership.userId);
      if (userRow?.email) {
        if (isExpired) {
          sendMembershipExpiryEmail(
            userRow.email,
            userRow.name ?? 'there',
            `Membership Plan`,
            membership.endsAt,
          ).catch((err) => logger.warn({ err }, 'expiry email failed'));
          expired++;
        } else {
          sendMembershipCreditGrantEmail(
            userRow.email,
            userRow.name ?? 'there',
            `Membership Plan`,
            membership.weeklyCredits,
            membership.creditType,
            newBalance ?? membership.weeklyCredits,
            addDays(membership.nextCreditGrantAt, 7),
            membership.endsAt,
          ).catch((err) => logger.warn({ err }, 'grant email failed'));
          granted++;
        }
      } else {
        isExpired ? expired++ : granted++;
      }
    } catch (err) {
      errors++;
      logger.error({ err, membershipId: membership.id }, 'failed for membership');
    }
  }

  const report = { processed: due.length, granted, expired, errors, ms: Date.now() - startedAt };
  logger.info({ report }, 'membership-credit-grant done');
  return NextResponse.json({ ok: true, report });
}

export const GET = POST;
