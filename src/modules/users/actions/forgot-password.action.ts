'use server';

import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email/resend';
import { checkRateLimit, authRateLimitConfig } from '@/lib/security/server-action-rate-limiter';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

const schema = z.object({ email: z.string().email('Invalid email') });

export async function forgotPasswordAction(formData: { email: string }) {
  const validated = schema.safeParse(formData);
  if (!validated.success) {
    return { success: true };
  }

  const email = validated.data.email.toLowerCase();

  // Rate limit per email to prevent email bombing
  const rateLimit = await checkRateLimit(authRateLimitConfig, `forgot:${email}`);
  if (!rateLimit.success) {
    // Return generic success to prevent enumeration
    return { success: true };
  }

  try {
    const user = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1)
      .then((r) => r[0]);

    // Only send if user exists and has password hash (not Google-only)
    if (user?.passwordHash) {
      // Delete existing reset tokens for this email to avoid accumulation
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.identifier, user.email));

      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + APP_CONFIG.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

      await db.insert(verificationTokens).values({
        identifier: user.email,
        token,
        expires,
      });

      // Fire-and-forget email send
      sendPasswordResetEmail(user.email, user.name, token).catch(() => {});
    }

    // Always return success to prevent email enumeration
    return { success: true };
  } catch {
    return { success: true };
  }
}
