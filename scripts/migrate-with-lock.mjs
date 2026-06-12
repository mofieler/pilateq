#!/usr/bin/env node
/**
 * Runtime database migration runner for pilatesOS.
 *
 * Uses drizzle-orm/postgres-js/migrator and a PostgreSQL advisory lock
 * to guarantee that only one container applies migrations at a time,
 * even if Coolify starts multiple instances during a rolling deploy.
 *
 * Exit codes:
 *   0 = migrations applied (or nothing to do)
 *   1 = error, block container start
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const LOCK_ID = 824726341; // arbitrary, stable integer used as advisory lock key

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = postgres(process.env.DATABASE_URL, { max: 1 });

  try {
    // 1) Acquire advisory lock (non-blocking first, then poll)
    let locked = false;
    const [{ acquired }] = await client.unsafe(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [LOCK_ID]
    );
    locked = acquired;

    if (!locked) {
      console.log('[migrate] Another instance is already running migrations, waiting...');
      while (!locked) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const [{ acquired: now }] = await client.unsafe(
          'SELECT pg_try_advisory_lock($1) AS acquired',
          [LOCK_ID]
        );
        locked = now;
      }
    }

    // 2) Run migrations
    console.log('[migrate] Applying pending migrations...');
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: './src/db/migrations' });
    console.log('[migrate] Migrations finished successfully.');
  } finally {
    await client.unsafe('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    await client.end().catch(() => {});
  }
}

run().catch((err) => {
  console.error('[migrate] Migration failed:', err.message || err);
  process.exit(1);
});
