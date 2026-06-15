/**
 * StudioConfig Loader
 *
 * Loads the active StudioConfig for the current tenant.
 *
 * Supports two deployment models transparently:
 *   1. Multi-tenant SaaS: resolve tenant from request hostname/subdomain,
 *      load config from `studios` + `studio_settings` tables.
 *   2. Single-tenant / self-hosted: no DB tenant row exists; derive config
 *      from legacy environment variables or a local config file.
 *
 * This file is the single entry point for ALL runtime StudioConfig access.
 * Services, React Server Components, and middleware should call
 * `getStudioConfig()` or `getStudioConfigSync()`.
 */

import { cache } from 'react';
import { headers } from 'next/headers';
import { parseStudioConfig, type StudioConfig } from './studio.config.schema';
import { DEFAULT_STUDIO_CONFIG } from './studio.config.default';
import { studioConfigFromLegacyEnv } from './studio.config.schema';
import {
  resolveTenantFromHostname,
  getHostnameFromHeaders,
  type TenantResolution,
} from './studio.config.tenant';

export type { TenantResolution };

// ---------------------------------------------------------------------------
// DB loading (prepared for Phase 0.3)
// ---------------------------------------------------------------------------

let dbLoadAttempted = false;
let dbLoadAvailable = false;

function isLocalhostOrDev(hostname: string): boolean {
  const clean = hostname.toLowerCase().split(':')[0];
  return (
    clean === 'localhost' ||
    clean.endsWith('.localhost') ||
    /^127\./.test(clean) ||
    /^192\.168\./.test(clean) ||
    /^10\./.test(clean) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(clean) ||
    /^\d+\.\d+\.\d+\.\d+$/.test(clean)
  );
}

async function loadStudioConfigFromDb(resolution: TenantResolution): Promise<StudioConfig | null> {
  // Lazy-load DB modules to avoid import errors while the schema is being migrated.
  if (!dbLoadAttempted) {
    dbLoadAttempted = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/db');
      dbLoadAvailable = true;
    } catch {
      dbLoadAvailable = false;
    }
  }

  if (!dbLoadAvailable) {
    return null;
  }

  try {
    const { db } = await import('@/db');
    const { eq } = await import('drizzle-orm');
    const schema = await import('@/db/schema');

    // Dynamic lookup with fallbacks while schema is being migrated.
    const studiosTable = (schema as unknown as Record<string, unknown>).studios as
      | { slug: unknown; customDomain: unknown; id: unknown; name: unknown; status: unknown; timezone: unknown; defaultLocale: unknown; updatedAt: unknown }
      | undefined;
    const settingsTable = (schema as unknown as Record<string, unknown>).studioSettings as
      | { studioId: unknown; configJson: unknown }
      | undefined;

    if (!studiosTable || !settingsTable) {
      return null;
    }

    let studioRow;
    if (resolution.slug) {
      [studioRow] = await db
        .select()
        .from(studiosTable as never)
        .where(eq(studiosTable.slug as never, resolution.slug))
        .limit(1);
    } else if (resolution.isCustomDomain) {
      [studioRow] = await db
        .select()
        .from(studiosTable as never)
        .where(eq(studiosTable.customDomain as never, resolution.hostname))
        .limit(1);
    }

    if (!studioRow) {
      // In production, never fall back to an arbitrary studio row. Only
      // localhost/development and static generation are allowed to use the
      // first studio as a safe fallback.
      const allowFallback =
        process.env.NODE_ENV !== 'production' ||
        isLocalhostOrDev(resolution.hostname) ||
        resolution.hostname === 'localhost';

      if (!allowFallback) {
        return null;
      }

      [studioRow] = await db.select().from(studiosTable as never).limit(1);
    }

    if (!studioRow) {
      return null;
    }

    const [settingsRow] = await db
      .select()
      .from(settingsTable as never)
      .where(eq(settingsTable.studioId as never, (studioRow as { id: string }).id))
      .limit(1);

    const row = studioRow as Record<string, unknown>;
    const settings = settingsRow as Record<string, unknown> | undefined;
    const configJson = (settings?.configJson as Record<string, unknown> | undefined) ?? {};

    return parseStudioConfig({
      // Start from the validated defaults so missing nested objects (branding,
      // bookingRules, financial, features, notifications) get sensible values.
      ...DEFAULT_STUDIO_CONFIG,
      ...configJson,
      id: row.id as string,
      status: row.status as StudioConfig['status'],
      identity: {
        ...DEFAULT_STUDIO_CONFIG.identity,
        ...(configJson.identity as Record<string, unknown> | undefined),
        name: row.name as string,
        slug: row.slug as string,
      },
      timezone: row.timezone as string,
      defaultLocale: row.defaultLocale as string,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : (row.updatedAt as string | undefined),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[StudioConfig] DB load failed, falling back to env/file config.', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// File / env loading
// ---------------------------------------------------------------------------

function loadStudioConfigFromEnv(): StudioConfig {
  const legacy = studioConfigFromLegacyEnv();
  const legacyIdentity = (legacy.identity ?? {}) as Partial<StudioConfig['identity']>;

  return parseStudioConfig({
    ...DEFAULT_STUDIO_CONFIG,
    ...legacy,
    status: 'active',
    identity: {
      ...DEFAULT_STUDIO_CONFIG.identity,
      ...legacyIdentity,
      // Keep the validated defaults for email/website if the env values are empty.
      ...(legacyIdentity.email?.trim() ? { email: legacyIdentity.email } : {}),
      ...(legacyIdentity.website?.trim() ? { website: legacyIdentity.website } : {}),
    },
    classTypes: {
      ...DEFAULT_STUDIO_CONFIG.classTypes,
      ...legacy.classTypes,
    },
    creditTypes: {
      ...DEFAULT_STUDIO_CONFIG.creditTypes,
      ...legacy.creditTypes,
    },
    branding: {
      ...DEFAULT_STUDIO_CONFIG.branding,
      ...legacy.branding,
    },
    bookingRules: {
      ...DEFAULT_STUDIO_CONFIG.bookingRules,
      ...legacy.bookingRules,
    },
    financial: {
      ...DEFAULT_STUDIO_CONFIG.financial,
      ...legacy.financial,
    },
    features: {
      ...DEFAULT_STUDIO_CONFIG.features,
      ...legacy.features,
    },
    notifications: {
      ...DEFAULT_STUDIO_CONFIG.notifications,
      ...legacy.notifications,
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface StudioConfigContext {
  config: StudioConfig;
  tenant: TenantResolution;
}

const buildStudioConfigContext = cache(async (hostname?: string): Promise<StudioConfigContext> => {
  let resolvedHostname: string;
  try {
    resolvedHostname = hostname ?? getHostnameFromHeaders(await headers());
  } catch {
    // During static generation (e.g. _not-found prerender) there is no request
    // context. Fall back to env/file config so layouts can still render.
    return { config: loadStudioConfigFromEnv(), tenant: resolveTenantFromHostname('localhost') };
  }
  const tenant = resolveTenantFromHostname(resolvedHostname);

  const fromDb = await loadStudioConfigFromDb(tenant);
  if (fromDb) {
    return { config: fromDb, tenant };
  }

  return { config: loadStudioConfigFromEnv(), tenant };
});

/**
 * Get the StudioConfig for the current request.
 * Safe to call from React Server Components, Server Actions, and API routes.
 */
export async function getStudioConfig(): Promise<StudioConfig> {
  const ctx = await buildStudioConfigContext();
  return ctx.config;
}

/**
 * Get the StudioConfig plus tenant resolution info.
 */
export async function getStudioConfigContext(): Promise<StudioConfigContext> {
  return buildStudioConfigContext();
}

/**
 * Get the StudioConfig for an explicit hostname (useful in middleware or tests).
 */
export async function getStudioConfigForHostname(hostname: string): Promise<StudioConfigContext> {
  return buildStudioConfigContext(hostname);
}

/**
 * Synchronous loader for contexts where async is not available.
 * Returns the env/file-based config. Prefer `getStudioConfig()` in RSC/actions.
 */
export function getStudioConfigSync(): StudioConfig {
  return loadStudioConfigFromEnv();
}
