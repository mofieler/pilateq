/**
 * Credit system access provider.
 *
 * Students buy credits (pass, mat_pass, reformer_pass, session) and spend them
 * on classes. This plugin wraps the simplified single-ledger credit service.
 */

import { creditService, InsufficientCreditsError } from '@/modules/billing/services/credit.service';
import { getAcceptedCreditTypes } from '@/lib/config/class-types';
import type { ClassType } from '@/lib/config/class-types';
import type { AccessProviderPlugin, AccessRequirement, AccessGrant } from '../types';

type TxClient = Parameters<Parameters<typeof import('@/db').db.transaction>[0]>[0];

export const creditSystemPlugin: AccessProviderPlugin = {
  key: 'credit_system',
  type: 'access',
  displayName: 'Credit System',
  description: 'Students purchase credits and spend them per class.',
  availableGlobally: true,

  isEnabled(config) {
    return config.enabledBusinessModels.includes('credits');
  },

  async grantAccess(ctx, requirement) {
    const tx = ctx.tx as TxClient | undefined;
    if (!tx) {
      throw new Error('Credit system provider requires a database transaction');
    }

    if (!ctx.userId) {
      throw new Error('Credit system provider requires a user id');
    }

    const acceptedCreditTypes = getAcceptedCreditTypes(requirement.classType as ClassType);

    for (const creditType of acceptedCreditTypes) {
      try {
        const transaction = await creditService.debit(tx, {
          studioId: ctx.studioId,
          userId: ctx.userId,
          creditType: creditType as any,
          amount: requirement.cost,
          description: `Booking: ${requirement.classType}`,
        });

        return {
          grantId: transaction.id,
          provider: 'credit_system',
          label: `${requirement.cost} ${creditType}`,
          quantityConsumed: requirement.cost,
          metadata: {
            creditType,
            creditTransactionId: transaction.id,
          },
        } satisfies AccessGrant;
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          continue;
        }
        throw err;
      }
    }

    return null;
  },

  async releaseAccess(ctx, grant) {
    const tx = ctx.tx as TxClient | undefined;
    if (!tx) {
      throw new Error('Credit system provider requires a database transaction');
    }

    if (!ctx.userId) {
      throw new Error('Credit system provider requires a user id');
    }

    const creditType = grant.metadata?.creditType as string;
    const amount = grant.quantityConsumed;
    const bookingId = grant.metadata?.bookingId as string | undefined;

    await creditService.refund(tx, {
      studioId: ctx.studioId,
      userId: ctx.userId,
      creditType: creditType as any,
      amount,
      bookingId: bookingId ?? 'cancelled',
      description: `Refund: ${grant.label}`,
    });
  },
};
