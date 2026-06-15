/**
 * Tenant context helpers for Postgres Row Level Security (RLS).
 *
 * These helpers set the `app.current_studio_id` transaction-local configuration
 * variable that the RLS policies in migration 0015 read to scope queries to a
 * single studio.
 *
 * Usage:
 *   import { withTenantContext } from '@/lib/db/tenant-context';
 *
 *   await withTenantContext(studioId, async (tx) => {
 *     // every query inside this transaction is scoped to the studio
 *     return tx.select().from(bookings).where(...);
 *   });
 *
 * For one-off queries you can also call setCurrentStudio(studioId) on the
 * provided transaction before running the query. Because the setting is
 * transaction-local, it is safest to wrap multi-statement work in
 * withTenantContext().
 */

import { sql } from "drizzle-orm";
import { db } from "@/db";
import type * as schema from "@/db/schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

type DbClient = PostgresJsDatabase<typeof schema>;

/**
 * Set the RLS tenant context on a Drizzle client/transaction.
 */
export async function setCurrentStudio(
  studioId: string,
  tx?: DbClient,
): Promise<void> {
  const client = tx ?? db;
  await client.execute(sql`SELECT set_current_studio(${studioId}::uuid)`);
}

/**
 * Run a callback inside a Drizzle transaction with the RLS tenant context set.
 */
export async function withTenantContext<T>(
  studioId: string,
  callback: (tx: DbClient) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setCurrentStudio(studioId, tx);
    return callback(tx);
  });
}
