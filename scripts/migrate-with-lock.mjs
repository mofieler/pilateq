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
import dotenv from 'dotenv';
import path from 'path';

// Load .env files the same way Next.js does, overriding existing env vars so
// the migration script uses the exact same DATABASE_URL as the app runtime.
dotenv.config({ path: '.env', override: true });
dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: '.env.production', override: true });
dotenv.config({ path: '.env.production.local', override: true });

import { fileURLToPath } from 'url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCK_ID = 824726341; // arbitrary, stable integer used as advisory lock key
const MIGRATIONS_FOLDER = path.resolve(__dirname, '../src/db/migrations');

function log(message) {
  console.log(`[migrate ${new Date().toISOString()}] ${message}`);
}

function sanitizeDatabaseUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username}:****@${u.host}${u.pathname}`;
  } catch {
    return 'invalid-url';
  }
}

async function listAppliedMigrations(client) {
  try {
    const rows = await client.unsafe('SELECT id, created_at FROM "drizzle"."__drizzle_migrations" ORDER BY created_at');
    return rows.map((r) => r.id);
  } catch (err) {
    // Table may not exist on a completely fresh database.
    return [];
  }
}

async function listPublicTables(client) {
  const rows = await client.unsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  return rows.map((r) => r.tablename);
}

async function connectWithRetry(url, options, maxAttempts = 30) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let client;
    try {
      client = postgres(url, options);
      // Verify the connection with a lightweight query before returning.
      await client.unsafe('SELECT 1');
      return client;
    } catch (err) {
      lastError = err;
      log(`DB connection attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      await client?.end().catch(() => {});
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
  throw lastError;
}

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  log(`Migrations folder: ${MIGRATIONS_FOLDER}`);
  log(`Connecting to database: ${sanitizeDatabaseUrl(process.env.DATABASE_URL)}`);

  const client = await connectWithRetry(process.env.DATABASE_URL, {
    max: 1,
    // Defensive timeouts so a stuck migration or a lock held by a previous
    // crashed deployment cannot block the container forever. statement_timeout
    // is intentionally large (600s) because applying a big initial schema with
    // many indexes on a slow VPS can take several minutes.
    connect_timeout: 30,
    statement_timeout: 600,
    lock_timeout: 30,
  });

  try {
    // 1) Acquire advisory lock (non-blocking first, then poll)
    let locked = false;
    const [{ acquired }] = await client.unsafe(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [LOCK_ID]
    );
    locked = acquired;

    if (!locked) {
      log('Another instance is already running migrations, waiting...');
      while (!locked) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const [{ acquired: now }] = await client.unsafe(
          'SELECT pg_try_advisory_lock($1) AS acquired',
          [LOCK_ID]
        );
        locked = now;
      }
    }

    const beforeApplied = await listAppliedMigrations(client);
    log(`Applied migrations before run: ${beforeApplied.length ? beforeApplied.join(', ') : '(none)'}`);

    // 2) Run migrations
    log('Applying pending migrations...');
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    log('Migrations finished successfully.');

    const afterApplied = await listAppliedMigrations(client);
    log(`Applied migrations after run: ${afterApplied.length ? afterApplied.join(', ') : '(none)'}`);

    // 3) Verify that the schema actually exists. A corrupted journal can make
    //    migrate() return success while critical tables are missing.
    const tables = await listPublicTables(client);
    log(`Public tables found: ${tables.length ? tables.join(', ') : '(none)'}`);

    const requiredTables = ['studios', 'users', 'studio_settings'];
    const missing = requiredTables.filter((t) => !tables.includes(t));
    if (missing.length > 0) {
      throw new Error(
        `Schema verification failed: required table(s) missing after migration: ${missing.join(', ')}. ` +
        `This usually means the drizzle migration journal is out of sync with the actual database state. ` +
        `Inspect "drizzle"."__drizzle_migrations" and consider resetting the database or repairing the journal.`
      );
    }
  } finally {
    await client.unsafe('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    await client.end().catch(() => {});
  }
}

run().catch((err) => {
  console.error(`[migrate ${new Date().toISOString()}] Migration failed:`, err.message || err);
  process.exit(1);
});
