'use server';

import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import crypto from 'crypto';
import { APP_CONFIG } from '@/constants/APP_CONFIG';
import { sendVerificationEmail } from '@/lib/email/auth.emails';
import { checkRateLimit } from '@/lib/security/server-action-rate-limiter';

const resendRateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3,
  keyPrefix: 'resend-verification',
};

export async function resendVerificationEmailAction(email: string) {
  try {
    const rateLimit = await checkRateLimit(resendRateLimitConfig, email);
    if (!rateLimit.success) {
      return {
        success: false,
        error: 'Too many requests. Please try again in 15 minutes.',
        code: 'RATE_LIMITED',
      };
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await db
      .select({ id: users.id, email: users.email, name: users.name, emailVerified: users.emailVerified })
      .from(users)
      .where(and(eq(users.email, normalizedEmail), isNull(users.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    // Don't reveal whether the account exists.
    if (!user || user.emailVerified) {
      return { success: true };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(
      Date.now() + APP_CONFIG.EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await db.insert(verificationTokens).values({
      identifier: user.email,
      token,
      expires,
    });

    sendVerificationEmail(user.email, user.name ?? 'Studio Admin', token).catch((err) =>
      console.error('[RESEND_VERIFICATION] Failed to send verification email:', err),
    );

    return { success: true };
  } catch (error) {
    console.error('[RESEND_VERIFICATION] Error:', error);
    return { success: false, error: 'An error occurred while resending the verification email' };
  }
}
