/**
 * Studio resolver for auth and middleware.
 *
 * Determines which studio a request belongs to and loads the DB row.
 * Falls back to the single-tenant default studio when no subdomain matches.
 */

import { eq } from 'drizzle-orm';
import { studios } from '@/db/schema';
import { resolveTenantFromHostname } from './studio.config.tenant';

export interface ResolvedStudio {
  id: string;
  slug: string;
  name: string;
  status: string;
  timezone: string;
  defaultLocale: string;
}

/**
 * Resolve a studio from a hostname.
 * Returns the matching studio row, or the single-tenant default studio,
 * or null if the database is unreachable.
 */
export async function resolveStudioFromHostname(hostname: string): Promise<ResolvedStudio | null> {
  const tenant = resolveTenantFromHostname(hostname);

  try {
    const { db } = await import('@/db');
    let row;
    if (tenant.slug) {
      [row] = await db.select().from(studios).where(eq(studios.slug, tenant.slug)).limit(1);
    }

    if (!row) {
      // Single-tenant fallback: use the first active studio, or the first studio.
      [row] = await db
        .select()
        .from(studios)
        .orderBy(studios.createdAt)
        .limit(1);
    }

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      timezone: row.timezone,
      defaultLocale: row.defaultLocale,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[StudioResolver] Could not resolve studio from DB:', error);
    return null;
  }
}

/**
 * Resolve the default studio (for single-tenant mode or fallback).
 */
export async function resolveDefaultStudio(): Promise<ResolvedStudio | null> {
  return resolveStudioFromHostname('localhost');
}
