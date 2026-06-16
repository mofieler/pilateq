/**
 * NOTE: Next.js 16 deprecates the file-based `middleware` convention in favor of
 * explicit `proxy` routes or Edge middleware. This project intentionally keeps
 * `src/middleware.ts` running on the Node.js runtime because authentication
 * (`auth()`), password hashing (`bcryptjs`), and direct database access are
 * required on every request.
 *
 * Future migration path: either adopt the new `proxy` convention once it
 * supports Node.js runtime, or split this into a thin Edge middleware for
 * static routing plus Node.js route guards for auth/tenant resolution.
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { addSecurityHeaders } from '@/lib/security/security-headers';
import { resolveStudioFromHostname } from '@/lib/studio/server';
import { isSupportedLocale, LOCALE_COOKIE_NAME, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getAuthCookieName, useSecureCookies } from '@/lib/auth/session-cookie-name';
import '@/lib/config/env-init';

const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/verify-email',
  '/complete-profile',
  '/forgot-password',
  '/reset-password',
  '/email-verified',
  '/verification-failed',
  '/impressum',
  '/datenschutz',
  '/agb',
  '/widerrufsrecht',
  '/embed',
  '/onboarding',
  '/start',
  '/api/auth',
  '/api/webhooks',
];

const ONBOARDING_REQUIRED_PREFIXES = [
  '/login',
  '/register',
  '/verify-email',
  '/complete-profile',
  '/forgot-password',
  '/reset-password',
  '/email-verified',
  '/verification-failed',
  '/onboarding',
  '/start',
  '/api',
];

function isOnboardingPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return ONBOARDING_REQUIRED_PREFIXES.some((p) => pathname.startsWith(p));
}
const PUBLIC_EXACT = ['/'];

const sessionTokenName = getAuthCookieName('next-auth.session-token');

/**
 * Detect preferred locale from Accept-Language header.
 * Returns the first supported locale, or null.
 */
function detectLocaleFromHeader(request: NextRequest): string | null {
  const acceptLang = request.headers.get('accept-language');
  if (!acceptLang) return null;

  const preferred = acceptLang
    .split(',')
    .map((s) => s.trim().split(';')[0].trim().split('-')[0].toLowerCase())
    .filter(isSupportedLocale);

  return preferred[0] ?? null;
}

/** Generate a fresh CSP nonce for every request (16 bytes, base64url). */
function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/** Clear the Auth.js session cookie and redirect to login. */
function clearSessionAndRedirect(request: NextRequest, target: string, nonce: string): NextResponse {
  const url = new URL(target, request.url);
  const response = NextResponse.redirect(url);
  response.cookies.set(sessionTokenName, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: useSecureCookies(),
    domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    maxAge: 0,
  });
  return addSecurityHeaders(request, response, nonce);
}

function setNoStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  );
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = generateNonce();

  // Never cache HTML pages by CDN/browser after a redeploy, because they
  // contain build-specific Server Action IDs. Static assets and API routes are
  // excluded by the matcher below, so this only affects page responses.
  const mustNeverCache = true;

  // Resolve tenant from request hostname. This is used later for studio
  // scoping and for the onboarding first-run flow.
  const hostname = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost';
  const resolvedStudio = await resolveStudioFromHostname(hostname);

  // ── Locale detection & cookie management ─────────────────────────────────
  // If the user has no locale cookie yet, detect from Accept-Language header
  // and set a cookie so the server can resolve the locale on subsequent requests.
  let localeCookie = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const detectedLocale = detectLocaleFromHeader(request);

  const isPublic =
    PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublic) {
    const response = addSecurityHeaders(request, NextResponse.next(), nonce);
    response.headers.set('x-nonce', nonce);
    if (resolvedStudio?.slug) {
      response.headers.set('x-studio-slug', resolvedStudio.slug);
    }
    if (!localeCookie && detectedLocale) {
      response.cookies.set(LOCALE_COOKIE_NAME, detectedLocale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 400, // ~400 days
        sameSite: 'lax',
        secure: useSecureCookies(),
      });
    }
    if (mustNeverCache) setNoStoreHeaders(response);
    return response;
  }

  const session = await auth();

  if (!session?.user) {
    const loginUrl = new URL('/login', request.url);
    return addSecurityHeaders(request, NextResponse.redirect(loginUrl), nonce);
  }

  const isSuperAdmin = session.user.role === 'superadmin';

  // /superadmin is platform-only and requires the superadmin role.
  if (pathname.startsWith('/superadmin')) {
    if (!isSuperAdmin) {
      return addSecurityHeaders(
        request,
        NextResponse.redirect(new URL('/login?error=AccessDenied', request.url)),
        nonce,
      );
    }
    const response = addSecurityHeaders(request, NextResponse.next(), nonce);
    response.headers.set('x-nonce', nonce);
    if (mustNeverCache) setNoStoreHeaders(response);
    return response;
  }

  // Superadmins bypass tenant scoping and onboarding for all other routes.
  if (isSuperAdmin) {
    const response = addSecurityHeaders(request, NextResponse.next(), nonce);
    response.headers.set('x-nonce', nonce);
    if (mustNeverCache) setNoStoreHeaders(response);
    return response;
  }

  // Platform apex domain (e.g. pilateq.de): no tenant is resolved here.
  // Authenticated non-superadmin users should be redirected to their studio
  // subdomain instead of getting stuck on the wrong hostname.
  if (!resolvedStudio && session.user.studioId) {
    const { db } = await import('@/db');
    const { eq } = await import('drizzle-orm');
    const { studios } = await import('@/db/schema');
    const [studioRow] = await db
      .select({ slug: studios.slug })
      .from(studios)
      .where(eq(studios.id, session.user.studioId as string))
      .limit(1);

    if (studioRow?.slug) {
      const platformDomain =
        process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'pilateq.de';
      const target = new URL(request.url);
      target.hostname = `${studioRow.slug}.${platformDomain}`;
      return addSecurityHeaders(request, NextResponse.redirect(target), nonce);
    }
  }

  // Studio scoping: the session's active studio must match the resolved tenant.
  // If the user is logged into the wrong studio, clear the session and make them
  // sign in again on the correct hostname.
  if (resolvedStudio?.id !== session.user.studioId) {
    return clearSessionAndRedirect(request, '/login?error=WrongStudio', nonce);
  }

  // Onboarding gate: authenticated users with an incomplete studio onboarding
  // must finish the onboarding wizard before accessing the app.
  const user = session.user as {
    studioId?: string;
    onboardingCompletedAt?: string | null;
    studioStatus?: string;
  };
  if (user.studioId && !isOnboardingPublicPath(pathname)) {
    const onboardingCompleted = !!user.onboardingCompletedAt;
    const studioStillOnboarding = user.studioStatus === 'onboarding';
    if (!onboardingCompleted || studioStillOnboarding) {
      const onboardingUrl = new URL('/onboarding', request.url);
      return addSecurityHeaders(request, NextResponse.redirect(onboardingUrl), nonce);
    }
  }

  // /admin/* requires owner, admin, or instructor role.
  if (pathname.startsWith('/admin')) {
    const memberRole = session.user.memberRole as string | undefined;
    const allowedBaseRoles = ['owner', 'admin', 'instructor'];
    if (!memberRole || !allowedBaseRoles.includes(memberRole)) {
      return addSecurityHeaders(request, NextResponse.redirect(new URL('/', request.url)), nonce);
    }

    // These sections are restricted to owners and admins.
    const ownerAdminOnlyPrefixes = [
      '/admin/settings',
      '/admin/payments',
      '/admin/tax',
      '/admin/user-credits',
      '/admin/credits',
      '/admin/memberships',
    ];
    const requiresOwnerAdmin = ownerAdminOnlyPrefixes.some((p) => pathname.startsWith(p));
    if (requiresOwnerAdmin && memberRole !== 'owner' && memberRole !== 'admin') {
      return addSecurityHeaders(request, NextResponse.redirect(new URL('/admin', request.url)), nonce);
    }
  }

  const response = addSecurityHeaders(request, NextResponse.next(), nonce);
  response.headers.set('x-nonce', nonce);
  if (resolvedStudio?.slug) {
    response.headers.set('x-studio-slug', resolvedStudio.slug);
  }
  if (!localeCookie && detectedLocale) {
    response.cookies.set(LOCALE_COOKIE_NAME, detectedLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 400,
      sameSite: 'lax',
      secure: useSecureCookies(),
    });
  }
  if (mustNeverCache) setNoStoreHeaders(response);
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\.ico|.*\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|otf|eot|mp4|webm|pdf|txt|xml|json|webmanifest)$).*)',
  ],
};
