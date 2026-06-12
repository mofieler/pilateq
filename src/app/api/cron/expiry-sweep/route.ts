import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/db';
import { creditTransactions } from '@/db/schema';
import { and, lte, isNotNull, sql, count } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';

// POST /api/cron/expiry-sweep
// Runs daily (e.g. every day at 02:00 UTC via Coolify scheduled task).
// Auth: Authorization: Bearer <CRON_SECRET>
//
// The ledger is immutable: this cron only DETECTS expired credit rows and
// reports the count. Balance queries already exclude expired rows, so no
// mutation of the ledger is required (or allowed).

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const logger = getLogger('expiry-sweep');

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
  const now = new Date();

  try {
    // Count positive credit rows whose expiry has passed. Debits/refunds have
    // no expiry and are never counted here.
    const [row] = await db
      .select({ expiredRows: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.amount} > 0 THEN 1 ELSE 0 END), 0)::int` })
      .from(creditTransactions)
      .where(and(
        isNotNull(creditTransactions.expiresAt),
        lte(creditTransactions.expiresAt, now),
      ));

    const expiredRows = row?.expiredRows ?? 0;

    if (expiredRows > 0) {
      logger.warn(
        { expiredRows, sweptAt: now.toISOString() },
        '[CRON] expiry-sweep detected expired credit rows; balances will exclude them automatically',
      );
    } else {
      logger.info('[CRON] expiry-sweep: no expired credit rows detected');
    }

    return NextResponse.json({
      ok: true,
      report: {
        expiredRows,
        ms: Date.now() - startedAt,
      },
    });
  } catch (error) {
    logger.error({ err: error }, '[CRON] expiry-sweep failed');
    return NextResponse.json(
      { ok: false, error: 'Expiry sweep failed' },
      { status: 500 },
    );
  }
}

export const GET = POST;
