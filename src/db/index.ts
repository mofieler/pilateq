import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { DATABASE_CONFIG } from "@/constants/DATABASE_CONFIG";

// Singleton pattern — prevents connection pool exhaustion during Next.js hot reload in dev.
const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

// postgres.js accepts statement_timeout / lock_timeout at runtime, but the
// shipped TypeScript types don't declare them yet. Extend Options so we keep
// autocompletion for the standard keys while allowing the timeout params.
type PostgresConnectionOptions = postgres.Options<{}> & {
  statement_timeout?: number;
  lock_timeout?: number;
};

const connectionOptions: PostgresConnectionOptions = {
  max: DATABASE_CONFIG.CONNECTION_POOL.MAX_CONNECTIONS,
  idle_timeout: DATABASE_CONFIG.CONNECTION_POOL.IDLE_TIMEOUT_SECONDS,
  connect_timeout: DATABASE_CONFIG.CONNECTION_POOL.CONNECT_TIMEOUT_SECONDS,
  statement_timeout: DATABASE_CONFIG.STATEMENT_TIMEOUT_SECONDS,
  lock_timeout: DATABASE_CONFIG.LOCK_TIMEOUT_SECONDS,
  // NOTE: `prepare: false` should be enabled when running behind pgBouncer
  // in transaction-pooling mode, because postgres.js prepared statements
  // keep named prepared statements open across queries. Leaving it unset
  // keeps the current default behavior while making the knob visible.
};

const client =
  globalForDb.client ?? postgres(process.env.DATABASE_URL!, connectionOptions);

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema });

// NOTE: Automatic RLS tenant-context injection is intentionally NOT wired here
// because Next.js request handling is heterogeneous (RSC, Server Actions,
// Route Handlers, middleware) and silently wrapping every query could break
// existing flows (e.g. studio resolution by hostname happens before the tenant
// is known). To enforce RLS, wrap tenant-scoped database work with:
//   import { withTenantContext } from '@/lib/db/tenant-context';
//   await withTenantContext(studioId, (tx) => { ... });
