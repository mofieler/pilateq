/**
 * Session package access provider.
 *
 * Students buy a fixed package of sessions (e.g., 10 private sessions) and
 * consume one session per booking. Distinct from credits because the package
 * is tied to specific session types.
 */

import { db } from '@/db';
import type { AccessProviderPlugin, AccessGrant } from '../types';
import { getLogger } from '@/lib/logger';

const logger = getLogger('session-package-plugin');

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const sessionPackageSystemPlugin: AccessProviderPlugin = {
  key: 'session_package_system',
  type: 'access',
  displayName: 'Session Packages',
  description: 'Students buy a fixed number of sessions and consume them per class.',
  availableGlobally: true,

  isEnabled(config) {
    return config.enabledBusinessModels.includes('session_packages');
  },

  async grantAccess(ctx): Promise<AccessGrant | null> {
    if (!this.isEnabled(ctx.studioConfig)) {
      return null;
    }

    const tx = ctx.tx as TxClient | undefined;
    if (!tx) {
      logger.warn({ userId: ctx.userId }, 'Session package provider requires a database transaction');
      return null;
    }
    if (!ctx.userId) {
      logger.warn('Session package provider requires a user id');
      return null;
    }

    logger.warn({ userId: ctx.userId }, 'Session package provider is not implemented yet (Phase 2). Skipping.');
    return null;
  },

  async releaseAccess(ctx): Promise<void> {
    if (!this.isEnabled(ctx.studioConfig)) {
      return;
    }

    const tx = ctx.tx as TxClient | undefined;
    if (!tx) {
      logger.warn({ userId: ctx.userId }, 'Session package provider requires a database transaction');
      return;
    }
    if (!ctx.userId) {
      logger.warn('Session package provider requires a user id');
      return;
    }

    logger.warn({ userId: ctx.userId }, 'Session package release is not implemented yet (Phase 2). Skipping.');
  },
};
