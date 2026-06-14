import { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { db } from '@/db';
import { users, studios, studioSettings, verificationTokens } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { parseStudioConfig, DEFAULT_STUDIO_CONFIG } from '@/lib/studio';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { checkAuthRateLimit, recordAuthFailure } from '@/lib/security/rate-limit-store';
import { resolveClientIP } from '@/lib/security/client-ip';
import { getLogger } from '@/lib/logger';
import { sendVerificationEmail } from '@/lib/email/auth.emails';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

const logger = getLogger('auth');

import { headers } from 'next/headers';

// Auth.js uses secure cookies in production by default. Self-hosted deployments
// often run on HTTP (e.g. Coolify sslip.io domains), so we derive the secure
// flag from NEXTAUTH_URL unless AUTH_COOKIE_SECURE is explicitly set.
const useSecureCookies =
  process.env.AUTH_COOKIE_SECURE === 'true' ||
  (process.env.AUTH_COOKIE_SECURE !== 'false' &&
    process.env.NODE_ENV === 'production' &&
    process.env.NEXTAUTH_URL?.startsWith('https://') === true);

// Trust the host by default in production; most self-hosted/reverse-proxy
// setups need this. Set AUTH_TRUST_HOST=false to disable.
const trustHost = process.env.AUTH_TRUST_HOST !== 'false';

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'protonmail.com',
]);

function slugFromEmail(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase() ?? 'studio';
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return `studio-${crypto.randomUUID().slice(0, 8)}`;
  }
  return domain.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63) || 'studio';
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let attempt = 0;
  while (attempt < 10) {
    const existing = await db.select({ id: studios.id }).from(studios).where(eq(studios.slug, slug)).limit(1);
    if (existing.length === 0) return slug;
    slug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;
    attempt++;
  }
  return `${baseSlug}-${Date.now()}`;
}

async function createPlaceholderStudio(adminEmail: string) {
  const timezone = process.env.DEFAULT_STUDIO_TIMEZONE ?? DEFAULT_STUDIO_CONFIG.timezone ?? 'Europe/Berlin';
  const baseSlug = slugFromEmail(adminEmail);
  const slug = await ensureUniqueSlug(baseSlug);
  const name = adminEmail.split('@')[0]?.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'My Studio';

  const [studio] = await db
    .insert(studios)
    .values({
      slug,
      name: `${name} Studio`,
      status: 'onboarding',
      timezone,
      defaultLocale: DEFAULT_STUDIO_CONFIG.defaultLocale ?? 'en',
    })
    .returning();

  await db.insert(studioSettings).values({
    studioId: studio.id,
    configJson: parseStudioConfig({
      ...DEFAULT_STUDIO_CONFIG,
      identity: {
        ...DEFAULT_STUDIO_CONFIG.identity,
        name: `${name} Studio`,
        slug,
        email: adminEmail,
      },
    }) as unknown as Record<string, unknown>,
  });

  return studio;
}

export const authConfig: NextAuthConfig = {
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60,     // absolute expiry: 8 hours
    updateAge: 15 * 60,       // extend the cookie if active within 15 min
  },

  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.callback-url' : 'next-auth.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
      },
    },
    csrfToken: {
      // __Host- prefix forbids Domain attribute — CSRF stays per-origin even with cross-subdomain sessions
      name: process.env.NODE_ENV === 'production' ? '__Host-next-auth.csrf-token' : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
    pkceCodeVerifier: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.pkce.code_verifier' : 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
      },
    },
    state: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.state' : 'next-auth.state',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
      },
    },
  },

  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).toLowerCase().trim();
        const headersList = await headers();
        const ip = resolveClientIP(headersList);

        const limit = await checkAuthRateLimit(ip, email);
        if (!limit.success) {
          logger.warn({ ip }, 'Rate limit hit on credentials authorize');
          return null;
        }

        try {
          const user = await db
            .select()
            .from(users)
            .where(and(eq(users.email, email), isNull(users.deletedAt)))
            .limit(1)
            .then((rows) => rows[0]);

          if (!user || !user.passwordHash) {
            await recordAuthFailure(ip, email);
            return null;
          }

          // Block login until email is verified
          if (!user.emailVerified) {
            logger.warn({ userId: user.id }, 'Login blocked — email not verified');
            await recordAuthFailure(ip, email);
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash,
          );

          if (!isPasswordValid) {
            await recordAuthFailure(ip, email);
            return null;
          }

          // Resolve the studio for the current hostname (single-tenant fallback supported).
          const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost';
          const { resolveStudioFromHostname } = await import('@/lib/studio/server');
          const studio = await resolveStudioFromHostname(host);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image || user.avatarUrl || undefined,
            role: user.role,
            studioId: user.studioId ?? studio?.id,
            needsProfileCompletion: false,
          };
        } catch (error) {
          logger.error({ err: error }, 'Credentials authorize error');
          return null;
        }
      },
    }),

    Google({
      clientId: process.env.AUTH_GOOGLE_ID || '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET || '',
    }),
  ],

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user, account }) {
      // Only intercept Google OAuth — credentials are handled by authorize()
      if (account?.provider !== 'google') return true;
      if (!user.email) return false;

      try {
        // Resolve the tenant from the request hostname BEFORE any DB mutation.
        // OAuth auto-provisioning is only allowed when a real tenant can be
        // resolved from the hostname. This prevents anonymous Google sign-ups
        // from leaking into the wrong studio or creating orphan users.
        const headersList = await headers();
        const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost';
        const { resolveStudioFromHostname } = await import('@/lib/studio/server');
        const studio = await resolveStudioFromHostname(host);

        const existing = await db
          .select()
          .from(users)
          .where(and(eq(users.email, user.email), isNull(users.deletedAt)))
          .limit(1)
          .then((rows) => rows[0]);

        if (existing) {
          // Returning Google user — ensure they belong to the resolved tenant.
          if (studio?.id && existing.studioId !== studio.id) {
            logger.warn({ userId: existing.id, studioId: existing.studioId, resolvedStudioId: studio.id }, 'Google sign-in blocked — user tenant mismatch');
            return false;
          }

          // Re-check profileCompleted so skipping only dismisses the overlay
          // for one session, not permanently.
          user.id = existing.id;
          (user as any).role = existing.role;
          (user as any).studioId = existing.studioId;
          (user as any).needsProfileCompletion = !existing.profileCompleted;
        } else {
          // OAuth auto-provisioning is gated by ALLOW_OAUTH_AUTO_PROVISION.
          // When disabled, Google sign-in is only allowed for existing users.
          if (process.env.ALLOW_OAUTH_AUTO_PROVISION !== 'true') {
            logger.warn({ host, email: user.email }, 'Google sign-in blocked — OAuth auto-provisioning is disabled');
            return false;
          }

          let targetStudioId = studio?.id;

          // SaaS first-run: if no studio exists for this host, create a
          // placeholder studio and make the Google user its admin.
          if (!targetStudioId) {
            const placeholder = await createPlaceholderStudio(user.email);
            targetStudioId = placeholder.id;
          }

          if (!targetStudioId) {
            logger.warn({ host, email: user.email }, 'Google sign-in blocked — could not provision studio');
            return false;
          }

          // First-time Google user — create account scoped to the resolved tenant.
          // The placeholder studio stays in onboarding status and the admin must
          // verify their email before the account is considered fully active.
          const [newUser] = await db
            .insert(users)
            .values({
              email: user.email,
              name: user.name ?? user.email.split('@')[0],
              emailVerified: null,
              image: user.image ?? null,
              role: 'admin',
              studioId: targetStudioId,
            })
            .returning();

          // Link the placeholder studio to the new admin user.
          await db.update(studios).set({ createdByUserId: newUser.id }).where(eq(studios.id, targetStudioId));

          // Generate and send email verification token.
          const token = crypto.randomBytes(32).toString('hex');
          const expires = new Date(
            Date.now() + APP_CONFIG.EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
          );
          await db.insert(verificationTokens).values({
            identifier: newUser.email,
            token,
            expires,
          });
          sendVerificationEmail(newUser.email, newUser.name ?? 'Studio Admin', token).catch((err) =>
            logger.warn({ err }, 'Failed to send verification email to OAuth-provisioned user'),
          );

          user.id = newUser.id;
          (user as any).role = 'admin';
          (user as any).studioId = newUser.studioId;
          (user as any).needsProfileCompletion = true;
        }

        return true;
      } catch (error) {
        logger.error({ err: error }, 'Google signIn error');
        return false;
      }
    },

    async jwt({ token, user, trigger, session }) {
      // First sign-in: persist user data into the JWT
      if (user) {
        token.id = user.id;
        
        // Fetch latest user details from DB to sync custom avatarUrl
        const dbUser = await db
          .select()
          .from(users)
          .where(eq(users.id, user.id!))
          .limit(1)
          .then((rows) => rows[0]);

        token.role = dbUser?.role ?? (user as any).role ?? 'student';
        token.studioId = dbUser?.studioId ?? (user as any).studioId;
        token.needsProfileCompletion = dbUser ? !dbUser.profileCompleted : ((user as any).needsProfileCompletion ?? false);
        token.image = dbUser?.avatarUrl || dbUser?.image || user.image || undefined;
      }

      // Session update triggered by unstable_update() after profile completion
      if (trigger === 'update' && session?.needsProfileCompletion === false) {
        token.needsProfileCompletion = false;
      }

      // Session update triggered by avatar upload
      if (trigger === 'update' && session?.image) {
        token.image = session.image as string;
      }

      // Session update triggered after onboarding completion
      if (trigger === 'update' && session?.role) {
        token.role = session.role as string;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.studioId = token.studioId as string | undefined;
        session.user.image = token.image as string | undefined;
        (session.user as any).needsProfileCompletion = token.needsProfileCompletion as boolean;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url === baseUrl || url.startsWith(`${baseUrl}/login`)) return baseUrl;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },

  trustHost,
};
