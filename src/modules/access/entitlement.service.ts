/**
 * Access Entitlement Service
 *
 * Resolves how a user can access (book) a class by asking enabled access
 * provider plugins in priority order. Each plugin decides whether it can cover
 * the access requirement and consumes its entitlement if so.
 *
 * This is the heart of Phase 4: it makes credits, memberships, session
 * packages, and class passes interchangeable from the booking engine's
 * perspective.
 */

import { getEnabledAccessPlugins } from '@/lib/plugins/registry';
import type {
  AccessRequirement,
  AccessGrant,
  AccessProviderPlugin,
} from '@/lib/plugins/types';
import type { StudioConfig } from '@/lib/studio';

export interface EntitlementContext {
  studioConfig: StudioConfig;
  studioId: string;
  userId: string;
  tx?: unknown;
}

export interface EntitlementResult {
  grant: AccessGrant;
  provider: AccessProviderPlugin;
}

export class EntitlementError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'INSUFFICIENT_ACCESS'
  ) {
    super(message);
    this.name = 'EntitlementError';
  }
}

/**
 * Attempt to grant access for a class by trying each enabled access provider
 * in priority order. The first provider that returns a grant wins.
 */
export async function resolveAccessGrant(
  ctx: EntitlementContext,
  requirement: AccessRequirement
): Promise<EntitlementResult> {
  const plugins = getEnabledAccessPlugins(ctx.studioConfig);

  if (plugins.length === 0) {
    throw new EntitlementError('No access providers are enabled for this studio.');
  }

  for (const provider of plugins) {
    try {
      const grant = await provider.grantAccess(
        {
          studioConfig: ctx.studioConfig,
          studioId: ctx.studioId,
          userId: ctx.userId,
          tx: ctx.tx,
        },
        requirement
      );
      if (grant) {
        return { grant, provider };
      }
    } catch (error) {
      // If a provider fails, log and continue to the next one.
      console.warn(`[Entitlement] Provider ${provider.key} failed:`, error);
    }
  }

  throw new EntitlementError(
    `No access provider could cover this ${requirement.classType} class.`,
    'INSUFFICIENT_ACCESS'
  );
}

/**
 * Release a previously granted access (e.g. on cancellation).
 */
export async function releaseAccessGrant(
  ctx: EntitlementContext,
  grant: AccessGrant
): Promise<void> {
  const plugin = getEnabledAccessPlugins(ctx.studioConfig).find((p) => p.key === grant.provider);
  if (!plugin) {
    throw new EntitlementError(`Access provider ${grant.provider} is no longer enabled.`);
  }

  await plugin.releaseAccess(
    {
      studioConfig: ctx.studioConfig,
      studioId: ctx.studioId,
      userId: ctx.userId,
      tx: ctx.tx,
    },
    grant
  );
}
