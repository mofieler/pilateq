/**
 * Studio resolver for auth and middleware.
 *
 * Determines which studio a request belongs to and loads the DB row.
 * In production unknown hostnames return null to prevent cross-tenant leaks.
 * A safe fallback to the first studio is kept for localhost/development and
 * static generation only.
 */

import { eq } from "drizzle-orm";
import { studios } from "@/db/schema";
import { resolveTenantFromHostname } from "./studio.config.tenant";
import { MemoryCache } from "@/lib/cache/memory-cache";

const STUDIO_CACHE_TTL_MS = 60_000;
const studioCache = new MemoryCache<ResolvedStudio | null>({
  ttlMs: STUDIO_CACHE_TTL_MS,
});

export interface ResolvedStudio {
  id: string;
  slug: string;
  name: string;
  status: string;
  timezone: string;
  defaultLocale: string;
}

function isLocalhostOrDev(hostname: string): boolean {
  const clean = hostname.toLowerCase().split(":")[0];
  return (
    clean === "localhost" ||
    clean.endsWith(".localhost") ||
    /^127\./.test(clean) ||
    /^192\.168\./.test(clean) ||
    /^10\./.test(clean) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(clean) ||
    /^\d+\.\d+\.\d+\.\d+$/.test(clean)
  );
}

/**
 * Resolve a studio from a hostname.
 *
 * - Multi-tenant SaaS: match by subdomain slug or verified custom domain.
 * - In production, an unknown hostname returns null instead of falling back to
 *   the first active studio (which would break tenant isolation).
 * - Localhost/development and static generation may fall back to the first
 *   studio row so the app remains usable without a configured tenant.
 */
export async function resolveStudioFromHostname(
  hostname: string,
): Promise<ResolvedStudio | null> {
  const key = hostname.toLowerCase();
  const cached = studioCache.get(key);
  if (cached !== undefined) return cached;

  const result = await resolveStudioFromHostnameUncached(hostname);
  studioCache.set(key, result);
  return result;
}

async function resolveStudioFromHostnameUncached(
  hostname: string,
): Promise<ResolvedStudio | null> {
  const tenant = resolveTenantFromHostname(hostname);

  try {
    const { db } = await import("@/db");
    let row;

    if (tenant.slug) {
      [row] = await db
        .select()
        .from(studios)
        .where(eq(studios.slug, tenant.slug))
        .limit(1);
    } else if (tenant.isCustomDomain) {
      [row] = await db
        .select()
        .from(studios)
        .where(eq(studios.customDomain, tenant.hostname))
        .limit(1);
    }

    if (!row) {
      const allowFallback =
        process.env.NODE_ENV !== "production" ||
        isLocalhostOrDev(tenant.hostname) ||
        tenant.hostname === "localhost";

      if (!allowFallback) {
        return null;
      }

      // Safe fallback for localhost/development and static generation.
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
    console.warn("[StudioResolver] Could not resolve studio from DB:", error);
    return null;
  }
}

/**
 * Resolve the default studio (for single-tenant mode or fallback).
 */
export async function resolveDefaultStudio(): Promise<ResolvedStudio | null> {
  return resolveStudioFromHostname("localhost");
}
