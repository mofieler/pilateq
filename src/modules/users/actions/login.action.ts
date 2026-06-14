'use server';

import { z } from 'zod';
import { signIn } from '@/lib/auth/auth';
import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users, studios } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { resolveClientIP } from '@/lib/security/client-ip';
import {
  checkAuthRateLimit,
  recordAuthFailure,
  resetAuthLimits,
  getAuthAttempts,
} from '@/lib/security/rate-limit-store';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export async function loginAction(input: unknown) {
  try {
    const validated = loginSchema.parse(input);
    const headersList = await headers();
    const ip = resolveClientIP(headersList);
    const email = validated.email.toLowerCase().trim();

    // 1. Check rate limit
    const rateLimitResult = await checkAuthRateLimit(ip, email);
    if (!rateLimitResult.success) {
      const resetTime = rateLimitResult.lockedUntil
        ? rateLimitResult.lockedUntil.getTime()
        : Date.now();
      const attempts = await getAuthAttempts(ip, email);
      return {
        success: false as const,
        code: 'RATE_LIMITED' as const,
        resetTime,
        attempts,
        error: 'Too many attempts — please wait.',
      };
    }

    // 2. Retrieve user with linked studio status for post-login routing
    const user = await db
      .select({
        user: users,
        studioStatus: studios.status,
      })
      .from(users)
      .leftJoin(studios, eq(studios.id, users.studioId))
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!user || !user.user.passwordHash) {
      await recordAuthFailure(ip, email);
      const attempts = await getAuthAttempts(ip, email);
      return {
        success: false as const,
        code: 'INVALID_CREDENTIALS' as const,
        attempts,
        error: 'Invalid email or password. If you just registered, please check your email for a verification link.',
      };
    }

    // 3. Check email verification
    if (!user.user.emailVerified) {
      await recordAuthFailure(ip, email);
      const attempts = await getAuthAttempts(ip, email);
      return {
        success: false as const,
        code: 'EMAIL_NOT_VERIFIED' as const,
        attempts,
        error: 'Please verify your email address first. We have sent a verification link to your email.',
      };
    }

    // 4. Compare password
    const isPasswordValid = await bcrypt.compare(validated.password, user.user.passwordHash);
    if (!isPasswordValid) {
      await recordAuthFailure(ip, email);
      const attempts = await getAuthAttempts(ip, email);
      return {
        success: false as const,
        code: 'INVALID_CREDENTIALS' as const,
        attempts,
        error: 'Invalid email or password. If you just registered, please check your email for a verification link.',
      };
    }

    // 5. Successful login — reset rate limits
    await resetAuthLimits(ip, email);

    // 6. Sign in via Auth.js
    await signIn('credentials', {
      email,
      password: validated.password,
      redirect: false,
    });

    return {
      success: true as const,
      role: user.user.role,
      onboardingCompletedAt: user.user.onboardingCompletedAt?.toISOString() ?? null,
      studioStatus: user.studioStatus ?? 'unknown',
    };
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      String((error as any).digest).startsWith('NEXT_REDIRECT')
    ) {
      throw error;
    }

    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return {
        success: false as const,
        error: firstError ? firstError.message : 'Invalid input',
      };
    }

    if (error instanceof AuthError) {
      return {
        success: false as const,
        error: 'Authentication failed',
      };
    }

    console.error('[loginAction] Error:', error);
    return {
      success: false as const,
      error: 'A technical problem occurred — please try again later.',
    };
  }
}
