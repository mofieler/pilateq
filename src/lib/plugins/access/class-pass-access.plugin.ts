/**
 * Class pass access provider.
 *
 * Allows students with an active class pass check-in to book a class.
 * This is the bridge between Phase 3 check-ins and Phase 4 booking.
 */

import { db } from '@/db';
import { classPassCheckins } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import type { AccessProviderPlugin, AccessRequirement, AccessGrant } from '../types';

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const classPassAccessPlugin: AccessProviderPlugin = {
  key: 'class_pass_access',
  type: 'access',
  displayName: 'Class Pass Access',
  description: 'Book classes using external partner check-ins.',
  availableGlobally: true,

  isEnabled(config) {
    return config.enabledBusinessModels.includes('class_passes');
  },

  async grantAccess(ctx, requirement) {
    const tx = ctx.tx as TxClient | undefined;
    if (!tx) {
      throw new Error('Class pass provider requires a database transaction');
    }

    if (!ctx.userId) {
      throw new Error('Class pass provider requires a user id');
    }

    if (!requirement.sessionId) {
      return null;
    }

    // Find a confirmed class pass check-in for this user and session.
    const [checkin] = await tx
      .select()
      .from(classPassCheckins)
      .where(
        and(
          eq(classPassCheckins.userId, ctx.userId),
          eq(classPassCheckins.sessionId, requirement.sessionId),
          eq(classPassCheckins.status, 'confirmed')
        )
      )
      .limit(1);

    if (!checkin) {
      return null;
    }

    return {
      grantId: checkin.id,
      provider: 'class_pass_access',
      label: `Class pass: ${checkin.providerKey}`,
      quantityConsumed: 1,
      metadata: {
        providerKey: checkin.providerKey,
        checkinId: checkin.id,
      },
    } satisfies AccessGrant;
  },

  async releaseAccess(ctx, grant) {
    const tx = ctx.tx as TxClient | undefined;
    if (!tx) {
      throw new Error('Class pass provider requires a database transaction');
    }

    const checkinId = grant.grantId;
    await tx
      .update(classPassCheckins)
      .set({ status: 'pending' })
      .where(eq(classPassCheckins.id, checkinId));
  },
};
