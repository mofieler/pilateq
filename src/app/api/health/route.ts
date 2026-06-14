import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import logger from '@/lib/logger';

/**
 * Health check endpoint for Coolify container healthcheck
 * Returns 200 OK if application, database connection, and core schema are healthy
 */
export async function GET() {
  try {
    // Check database connectivity with a lightweight query
    await db.execute(sql`SELECT 1`);

    // Verify the core schema exists. If the entrypoint was bypassed or the
    // migration journal is out of sync, the app would otherwise report healthy
    // while every request fails.
    const [{ exists }] = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'studios'
      ) AS exists
    `);

    if (!exists) {
      logger.error('Health check failed: required "studios" table is missing');
      return NextResponse.json(
        {
          status: 'error',
          ts: new Date().toISOString(),
          checks: {
            database: 'ok',
            schema: 'error',
          },
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: 'ok',
        ts: new Date().toISOString(),
        checks: {
          database: 'ok',
          schema: 'ok',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'Health check failure'
    );

    return NextResponse.json(
      {
        status: 'error',
        ts: new Date().toISOString(),
        checks: {
          database: 'error',
        },
      },
      { status: 503 }
    );
  }
}
