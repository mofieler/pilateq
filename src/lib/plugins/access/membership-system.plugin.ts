/**
 * Membership / subscription access provider.
 *
 * Students subscribe to a recurring plan that grants credits periodically or
 * provides unlimited access. Wraps the existing membership engine.
 */

import { db } from '@/db';
import type { AccessProviderPlugin, AccessGrant } from '../types';
import { getLogger } from '@/lib/logger';

const logger = getLogger('membership-plugin');

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const membershipSystemPlugin: AccessProviderPlugin = {
  key: 'membership_system',
  type: 'access',
  displayName: 'Memberships',
  description: 'Recurring subscriptions with periodic credit grants or unlimited access.',
  availableGlobally: true,

  isEnabled(config) {
    return config.enabledBusinessModels.includes('memberships');
  },

  async grantAccess(ctx): Promise<AccessGrant | null> {
    if (!this.isEnabled(ctx.studioConfig)) {
      return null;
    }

    const tx = ctx.tx as TxClient | undefined;
    if (!tx) {
      logger.warn({ userId: ctx.userId }, 'Membership access provider requires a database transaction');
      return null;
    }
    if (!ctx.userId) {
      logger.warn('Membership access provider requires a user id');
      return null;
    }

    logger.warn({ userId: ctx.userId }, 'Membership access provider is not wired yet (Phase 4). Skipping.');
    return null;
  },

  async releaseAccess(ctx): Promise<void> {
    if (!this.isEnabled(ctx.studioConfig)) {
      return;
    }

    const tx = ctx.tx as TxClient | undefined;
    if (!tx) {
      logger.warn({ userId: ctx.userId }, 'Membership access provider requires a database transaction');
      return;
    }
    if (!ctx.userId) {
      logger.warn('Membership access provider requires a user id');
      return;
    }

    // Memberships typically do not refund a single grant on cancellation.
    // Phase 4 will implement the specific rules.
    logger.warn({ userId: ctx.userId }, 'Membership release is not wired yet (Phase 4). Skipping.');
  },
};
