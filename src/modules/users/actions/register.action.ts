'use server';

import { z } from 'zod';
import { db } from '@/db';
import { users, verificationTokens, studioMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { headers } from 'next/headers';
import { checkRateLimit, registerRateLimitConfig } from '@/lib/security/server-action-rate-limiter';
import { resolveClientIP } from '@/lib/security/client-ip';
import { verifyTurnstileToken } from '@/lib/security/turnstile';
import { sendVerificationEmail } from '@/lib/email/resend';
import { APP_CONFIG } from '@/constants/APP_CONFIG';
import { resolveStudioFromHostname } from '@/lib/studio/server';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(255)
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  turnstileToken: z.string().nullable().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type RegisterInput = z.infer<typeof registerSchema>;

export async function registerAction(input: unknown) {
  try {
    const rateLimitResult = await checkRateLimit(registerRateLimitConfig, 'register');
    if (!rateLimitResult.success) {
      return {
        success: false,
        error: 'Too many registration attempts. Please try again in 15 minutes.',
        code: 'RATE_LIMITED',
      };
    }

    const validated = registerSchema.parse(input);

    // Captcha verification BEFORE we hash a password (which is expensive) or
    // touch the DB. If TURNSTILE_SECRET_KEY is unset (dev) the helper
    // short-circuits to success.
    const headersList = await headers();
    const remoteIp = resolveClientIP(headersList);
    const captcha = await verifyTurnstileToken(
      validated.turnstileToken,
      remoteIp === 'untrusted' ? undefined : remoteIp,
    );
    if (!captcha.success) {
      return { success: false, error: captcha.error, code: 'CAPTCHA_FAILED' };
    }

    const existingUser = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, validated.email))
      .limit(1)
      .then((rows) => rows[0]);

    if (existingUser) {
      // Don't reveal whether the account exists — same response either way.
      // Optionally send a "you already have an account" email.
      return { success: true };
    }

    const passwordHash = await bcrypt.hash(validated.password, 12);

    // Resolve the tenant from the request hostname before creating the user.
    // Registration is only allowed when a real studio can be resolved.
    const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost';
    const studio = await resolveStudioFromHostname(host);
    if (!studio?.id) {
      return { success: false, error: 'No studio configured for this host.', code: 'NO_STUDIO', redirect: '/start' };
    }

    // Create user + membership + verification token atomically.
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + APP_CONFIG.EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: validated.email,
          name: validated.name,
          passwordHash,
          role: 'student',
          studioId: studio.id,
          emailVerified: null,
        })
        .returning();

      await tx.insert(studioMemberships).values({
        userId: user.id,
        studioId: studio.id,
        role: 'student',
        status: 'active',
        invitedByUserId: null,
        joinedAt: new Date(),
      });

      await tx.insert(verificationTokens).values({
        identifier: validated.email,
        token,
        expires,
      });
    });

    // Send verification email (fire and forget — don't fail registration on email error)
    sendVerificationEmail(validated.email, validated.name, token).catch((err) =>
      console.error('[REGISTER] Failed to send verification email:', err),
    );

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      if (firstError) return { success: false, error: firstError.message };
    }
    console.error('[REGISTER] Error:', error);
    return { success: false, error: 'An error occurred during registration' };
  }
}
