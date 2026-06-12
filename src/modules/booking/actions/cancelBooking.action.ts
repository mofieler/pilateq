'use server';

import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { cancellationService } from '@/modules/booking/services/cancellation.service';
import type { ServiceResult } from '@/modules/billing/services/credit.service';
import type { CancellationResult } from '@/modules/booking/services/cancellation.service';
import { checkRateLimit, cancellationRateLimitConfig } from '@/lib/security/server-action-rate-limiter';

// ─── Input Validation ─────────────────────────────────────────────────────────

const schema = z.object({
  bookingId: z.string().uuid('Invalid booking ID'),
  reason: z.string().max(500).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────

export async function cancelBookingAction(
  input: z.infer<typeof schema>,
): Promise<ServiceResult<CancellationResult>> {
  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };
  }

  // ── 1a. Rate Limiting ────────────────────────────────────────────────────────
  const rateLimitResult = await checkRateLimit(cancellationRateLimitConfig, `cancel:${session.user.id}`);
  if (!rateLimitResult.success) {
    return {
      success: false,
      error: 'Too many cancellation attempts. Please try again in a minute.',
      code: 'RATE_LIMITED',
    };
  }

  // ── 2. Zod validation ────────────────────────────────────────────────────────
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
      code: 'INVALID_STATE',
    };
  }

  // ── 3. Delegate to service ───────────────────────────────────────────────────
  return cancellationService.cancel(parsed.data.bookingId, session.user.id, parsed.data.reason);
}
