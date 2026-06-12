import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import logger from '@/lib/logger';

/**
 * Health check endpoint for Coolify container healthcheck
 * Returns 200 OK if application and database are healthy
 */
export async function GET() {
  try {
    // Check database connectivity with a lightweight query
    await db.execute(sql`SELECT 1`);

    return NextResponse.json({
      status: 'ok',
      ts: new Date().toISOString(),
      checks: {
        database: 'ok',
      },
    }, { status: 200 });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Health check database failure');

    return NextResponse.json({
      status: 'error',
      ts: new Date().toISOString(),
      checks: {
        database: 'error',
      },
    }, { status: 503 });
  }
}
