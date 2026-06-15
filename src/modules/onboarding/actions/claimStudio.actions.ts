'use server';

import { z } from 'zod';
import { db } from '@/db';
import { studios, studioSettings, users, verificationTokens, studioMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/security/server-action-rate-limiter';
import { resolveClientIP } from '@/lib/security/client-ip';
import { sendVerificationEmail } from '@/lib/email/auth.emails';
import { APP_CONFIG } from '@/constants/APP_CONFIG';
import { parseStudioConfig, DEFAULT_STUDIO_CONFIG } from '@/lib/studio';

const claimStudioRateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3,
  keyPrefix: 'claim-studio',
};

function isSelfServiceSignupAllowed(): boolean {
  return process.env.ALLOW_SELF_SERVICE_SIGNUP !== 'false';
}

function getAllowedSignupDomains(): string[] | null {
  const raw = process.env.ALLOWED_SIGNUP_DOMAINS;
  if (!raw) return null;
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function matchesAllowedDomain(email: string, allowedDomains: string[]): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return allowedDomains.includes(domain);
}

const claimStudioSchema = z
  .object({
    studioName: z.string().min(1, 'Studio name is required').max(120),
    studioSlug: z
      .string()
      .min(1, 'Studio slug is required')
      .max(63)
      .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'),
    adminEmail: z.string().email('Invalid email address'),
    adminPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(255)
      .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.adminPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ClaimStudioInput = z.infer<typeof claimStudioSchema>;

function emailToName(email: string): string {
  const local = email.split('@')[0] ?? 'Studio Admin';
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 120);
}

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/**
 * Public server action for the very first studio owner.
 * Creates the studio in onboarding mode, attaches an admin user, and sends
 * a verification email. After verification the admin completes onboarding.
 */
export async function claimStudioAction(input: unknown) {
  try {
    const headersList = await headers();
    const ip = resolveClientIP(headersList);

    // Rate limit per IP before any validation work.
    const ipLimit = await checkRateLimit(claimStudioRateLimitConfig, 'ip');
    if (!ipLimit.success) {
      return {
        success: false,
        error: 'Too many attempts. Please try again in 15 minutes.',
        code: 'RATE_LIMITED',
      };
    }

    if (!isSelfServiceSignupAllowed()) {
      return {
        success: false,
        error: 'Self-service signup is currently disabled. Please contact support.',
        code: 'SELF_SERVICE_DISABLED',
      };
    }

    const validated = claimStudioSchema.safeParse(input);
    if (!validated.success) {
      const first = validated.error.issues[0];
      return { success: false, error: first?.message ?? 'Invalid input', code: 'INVALID_INPUT' };
    }

    const { studioName, studioSlug, adminEmail, adminPassword } = validated.data;
    const cleanSlug = sanitizeSlug(studioSlug);

    if (!cleanSlug) {
      return { success: false, error: 'Invalid studio slug', code: 'INVALID_INPUT' };
    }

    const normalizedEmail = adminEmail.toLowerCase().trim();

    const allowedDomains = getAllowedSignupDomains();
    if (allowedDomains && !matchesAllowedDomain(normalizedEmail, allowedDomains)) {
      return {
        success: false,
        error: 'This email domain is not allowed for self-service signup.',
        code: 'DOMAIN_NOT_ALLOWED',
      };
    }

    // Re-check the per-email rate limit now that the email is known.
    const emailRateLimit = await checkRateLimit(claimStudioRateLimitConfig, normalizedEmail);
    if (!emailRateLimit.success) {
      return {
        success: false,
        error: 'Too many attempts for this email. Please try again in 15 minutes.',
        code: 'RATE_LIMITED',
      };
    }

    const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost';
    const timezone = process.env.DEFAULT_STUDIO_TIMEZONE ?? DEFAULT_STUDIO_CONFIG.timezone ?? 'Europe/Berlin';

    // Check slug uniqueness
    const existingSlug = await db
      .select({ id: studios.id })
      .from(studios)
      .where(eq(studios.slug, cleanSlug))
      .limit(1)
      .then((rows) => rows[0]);

    if (existingSlug) {
      return {
        success: false,
        error: `The slug "${cleanSlug}" is already taken. Please choose another one.`,
        code: 'SLUG_TAKEN',
      };
    }

    // Check email uniqueness
    const existingEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)
      .then((rows) => rows[0]);

    if (existingEmail) {
      // Don't reveal account existence
      return { success: true };
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // Create studio and admin user in one transaction
    const result = await db.transaction(async (tx) => {
      const [studio] = await tx
        .insert(studios)
        .values({
          slug: cleanSlug,
          name: studioName,
          status: 'onboarding',
          timezone,
          defaultLocale: DEFAULT_STUDIO_CONFIG.defaultLocale ?? 'en',
        })
        .returning();

      await tx.insert(studioSettings).values({
        studioId: studio.id,
        configJson: parseStudioConfig({
          ...DEFAULT_STUDIO_CONFIG,
          identity: {
            ...DEFAULT_STUDIO_CONFIG.identity,
            name: studioName,
            slug: cleanSlug,
            email: adminEmail,
          },
        }) as unknown as Record<string, unknown>,
      });

      const [adminUser] = await tx
        .insert(users)
        .values({
          email: normalizedEmail,
          name: emailToName(adminEmail),
          passwordHash,
          role: 'admin',
          studioId: studio.id,
          emailVerified: null,
        })
        .returning();

      await tx.update(studios).set({ createdByUserId: adminUser.id }).where(eq(studios.id, studio.id));

      await tx.insert(studioMemberships).values({
        userId: adminUser.id,
        studioId: studio.id,
        role: 'owner',
        status: 'active',
        invitedByUserId: null,
        joinedAt: new Date(),
      });

      return { studio, adminUser };
    });

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(
      Date.now() + APP_CONFIG.EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await db.insert(verificationTokens).values({
      identifier: result.adminUser.email,
      token,
      expires,
    });

    // Fire-and-forget verification email
    sendVerificationEmail(result.adminUser.email, result.adminUser.name ?? 'Studio Admin', token).catch((err) =>
      console.error('[CLAIM_STUDIO] Failed to send verification email:', err),
    );

    return { success: true, studioId: result.studio.id, slug: cleanSlug, host };
  } catch (error) {
    console.error('[CLAIM_STUDIO] Error:', error);
    return { success: false, error: 'An error occurred while claiming your studio', code: 'UNKNOWN_ERROR' };
  }
}
