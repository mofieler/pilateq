import NextAuth, { type NextAuthConfig } from "next-auth";
import type { NextRequest } from "next/server";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/db";
import { users, studios } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  checkAuthRateLimit,
  recordAuthFailure,
} from "@/lib/security/rate-limit-store";
import { resolveClientIP } from "@/lib/security/client-ip";
import { getLogger } from "@/lib/logger";
import { headers } from "next/headers";
import { getMembership, getActiveMembership } from "@/lib/studio/membership";
import { getAuthCookieName, useSecureCookies } from "./session-cookie-name";

const logger = getLogger("auth");

// Trust the host by default in production; most self-hosted/reverse-proxy
// setups need this. Set AUTH_TRUST_HOST=false to disable.
const trustHost = process.env.AUTH_TRUST_HOST !== "false";

function getBaseUrlFromHeaders(headersList: Headers): string {
  const host =
    headersList.get("x-forwarded-host") ??
    headersList.get("host") ??
    "localhost";
  const proto =
    headersList.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

async function getCurrentBaseUrl(
  req?: NextRequest,
): Promise<string | undefined> {
  if (req) {
    const host =
      req.headers.get("x-forwarded-host") ??
      req.headers.get("host") ??
      "localhost";
    const proto =
      req.headers.get("x-forwarded-proto") ??
      (process.env.NODE_ENV === "production" ? "https" : "http");
    return `${proto}://${host}`;
  }
  try {
    const headersList = await headers();
    return getBaseUrlFromHeaders(headersList);
  } catch {
    return process.env.NEXTAUTH_URL ?? undefined;
  }
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth(
  async (req): Promise<NextAuthConfig> => {
    const baseUrl = await getCurrentBaseUrl(req);
    const redirectProxyUrl = baseUrl ? `${baseUrl}/api/auth` : undefined;

    return {
      session: {
        strategy: "jwt",
        maxAge: 8 * 60 * 60, // absolute expiry: 8 hours
        updateAge: 15 * 60, // extend the cookie if active within 15 min
      },

      cookies: {
        sessionToken: {
          name: getAuthCookieName("next-auth.session-token"),
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: useSecureCookies(),
            domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
          },
        },
        callbackUrl: {
          name: getAuthCookieName("next-auth.callback-url"),
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: useSecureCookies(),
            domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
          },
        },
        csrfToken: {
          // __Host- prefix forbids Domain attribute — CSRF stays per-origin even with cross-subdomain sessions
          name: useSecureCookies()
            ? "__Host-next-auth.csrf-token"
            : "next-auth.csrf-token",
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: useSecureCookies(),
          },
        },
        pkceCodeVerifier: {
          name: getAuthCookieName("next-auth.pkce.code_verifier"),
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: useSecureCookies(),
            domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
          },
        },
        state: {
          name: getAuthCookieName("next-auth.state"),
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: useSecureCookies(),
            domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
          },
        },
      },

      redirectProxyUrl,

      providers: [
        Credentials({
          name: "Credentials",
          credentials: {
            email: { label: "Email", type: "email" },
            password: { label: "Password", type: "password" },
          },
          async authorize(credentials) {
            if (!credentials?.email || !credentials?.password) return null;

            const email = String(credentials.email).toLowerCase().trim();
            const headersList = await headers();
            const ip = resolveClientIP(headersList);

            const limit = await checkAuthRateLimit(ip, email);
            if (!limit.success) {
              logger.warn({ ip }, "Rate limit hit on credentials authorize");
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
                logger.warn(
                  { userId: user.id },
                  "Login blocked — email not verified",
                );
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

              // Resolve the studio for the current hostname and verify the user
              // has an active membership there.
              const host =
                headersList.get("x-forwarded-host") ??
                headersList.get("host") ??
                "localhost";
              const { resolveStudioFromHostname } =
                await import("@/lib/studio/server");
              const studio = await resolveStudioFromHostname(host);

              if (!studio) {
                logger.warn(
                  { userId: user.id, host },
                  "Credentials authorize rejected — no studio resolved",
                );
                return null;
              }

              const membership = await getMembership(user.id, studio.id);
              if (!membership || membership.status !== "active") {
                logger.warn(
                  { userId: user.id, studioId: studio.id },
                  "Credentials authorize rejected — no active membership",
                );
                return null;
              }

              return {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image || user.avatarUrl || undefined,
                role: user.role,
                studioId: membership.studioId,
                memberRole: membership.role,
                needsProfileCompletion: false,
              };
            } catch (error) {
              logger.error({ err: error }, "Credentials authorize error");
              return null;
            }
          },
        }),

        Google({
          clientId: process.env.AUTH_GOOGLE_ID || "",
          clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
        }),
      ],

      pages: {
        signIn: "/login",
        error: "/login",
      },

      callbacks: {
        async signIn({ user, account }) {
          // Resolve the tenant from the request hostname BEFORE any access decision.
          const headersList = await headers();
          const host =
            headersList.get("x-forwarded-host") ??
            headersList.get("host") ??
            "localhost";
          const { resolveStudioFromHostname } =
            await import("@/lib/studio/server");
          const studio = await resolveStudioFromHostname(host);

          if (!studio) {
            logger.warn({ host }, "signIn rejected — no studio resolved");
            return false;
          }

          // Credentials provider already verified active membership in authorize().
          if (account?.provider === "credentials") {
            if (!user.memberRole || !user.studioId) {
              const membership = await getMembership(user.id!, studio.id);
              if (!membership || membership.status !== "active") {
                return "/?error=NoMembership";
              }
              user.studioId = membership.studioId;
              (user as any).memberRole = membership.role;
            }
            return true;
          }

          // Google OAuth: existing users must have an active membership for the
          // resolved studio. Auto-provisioning of placeholder studios is disabled.
          if (account?.provider === "google") {
            if (!user.email) return false;

            const existing = await db
              .select()
              .from(users)
              .where(and(eq(users.email, user.email), isNull(users.deletedAt)))
              .limit(1)
              .then((rows) => rows[0]);

            if (!existing) {
              logger.warn(
                { host, email: user.email },
                "Google sign-in blocked — user does not exist and auto-provisioning is disabled",
              );
              return "/?error=NoMembership";
            }

            const membership = await getMembership(existing.id, studio.id);
            if (!membership || membership.status !== "active") {
              logger.warn(
                { userId: existing.id, studioId: studio.id },
                "Google sign-in blocked — no active membership for resolved studio",
              );
              return "/?error=NoMembership";
            }

            user.id = existing.id;
            (user as any).role = existing.role;
            user.studioId = membership.studioId;
            (user as any).memberRole = membership.role;
            (user as any).needsProfileCompletion = !existing.profileCompleted;
            return true;
          }

          return true;
        },

        async jwt({ token, user, trigger, session }) {
          // First sign-in: persist user data into the JWT.
          if (user) {
            token.id = user.id;

            // Resolve the current studio and load the user's active membership there.
            const headersList = await headers().catch(() => null);
            const host =
              headersList?.get("x-forwarded-host") ??
              headersList?.get("host") ??
              "localhost";
            const { resolveStudioFromHostname } =
              await import("@/lib/studio/server");
            const studio = await resolveStudioFromHostname(host);

            let membership = studio
              ? await getMembership(user.id!, studio.id)
              : undefined;
            if (!membership || membership.status !== "active") {
              // Fall back to the user's highest-precedence active membership if
              // the resolved studio has none. This keeps the session usable when
              // signIn already verified a membership on a slightly different host.
              const fallback = await getActiveMembership(user.id!);
              if (fallback && fallback.status === "active") {
                membership = fallback;
              }
            }

            if (membership && membership.status === "active") {
              token.studioId = membership.studioId;
              token.memberRole = membership.role;
            }

            // Fetch latest user details from DB to sync custom avatarUrl and
            // onboarding state. Also pull the linked studio status so middleware can
            // decide whether the user still needs to complete onboarding.
            const dbUser = await db
              .select()
              .from(users)
              .where(eq(users.id, user.id!))
              .limit(1)
              .then((rows) => rows[0]);

            token.role =
              (user as any).role ??
              dbUser?.role ??
              membership?.role ??
              "student";
            token.needsProfileCompletion = dbUser
              ? !dbUser.profileCompleted
              : ((user as any).needsProfileCompletion ?? false);
            token.image =
              dbUser?.avatarUrl || dbUser?.image || user.image || undefined;
            token.onboardingCompletedAt =
              dbUser?.onboardingCompletedAt?.toISOString() ?? null;

            const activeStudioId = token.studioId;
            if (activeStudioId) {
              const studioRow = await db
                .select({ status: studios.status })
                .from(studios)
                .where(eq(studios.id, activeStudioId as string))
                .limit(1)
                .then((rows) => rows[0]);
              token.studioStatus = studioRow?.status ?? "unknown";
            }
          }

          // Session update triggered by unstable_update() after profile completion
          if (
            trigger === "update" &&
            session?.needsProfileCompletion === false
          ) {
            token.needsProfileCompletion = false;
          }

          // Session update triggered by avatar upload
          if (trigger === "update" && session?.image) {
            token.image = session.image as string;
          }

          // Session update triggered after onboarding completion
          if (trigger === "update" && session?.role) {
            token.role = session.role as string;
          }
          if (trigger === "update" && session?.onboardingCompletedAt) {
            token.onboardingCompletedAt =
              session.onboardingCompletedAt as string;
            token.studioStatus =
              (session.studioStatus as string) ??
              token.studioStatus ??
              "active";
          }

          // Session update triggered by studio switch
          if (trigger === "update" && session?.studioId) {
            token.studioId = session.studioId as string;
            const studioRow = await db
              .select({ status: studios.status })
              .from(studios)
              .where(eq(studios.id, session.studioId as string))
              .limit(1)
              .then((rows) => rows[0]);
            token.studioStatus = studioRow?.status ?? "unknown";
          }
          if (trigger === "update" && session?.memberRole) {
            token.memberRole = session.memberRole as any;
          }

          return token;
        },

        async session({ session, token }) {
          if (session.user) {
            session.user.id = token.id as string;
            session.user.role = token.role as string;
            session.user.studioId = token.studioId as string | undefined;
            session.user.studioStatus = token.studioStatus as
              | string
              | undefined;
            session.user.memberRole = token.memberRole as any;
            session.user.image = token.image as string | undefined;
            (session.user as any).needsProfileCompletion =
              token.needsProfileCompletion as boolean;
            (session.user as any).onboardingCompletedAt =
              token.onboardingCompletedAt as string | null | undefined;
          }
          return session;
        },

        async redirect({ url, baseUrl }) {
          if (url === baseUrl || url.startsWith(`${baseUrl}/login`))
            return baseUrl;
          if (url.startsWith("/")) return `${baseUrl}${url}`;
          if (url.startsWith(baseUrl)) return url;
          return baseUrl;
        },
      },

      trustHost,
    };
  },
);
