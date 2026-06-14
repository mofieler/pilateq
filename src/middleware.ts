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
import { resolveTenantFromHostname } from '@/lib/studio/studio.config.tenant';
import { isSupportedLocale, LOCALE_COOKIE_NAME, DEFAULT_LOCALE } from '@/lib/i18n/config';
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
  '/api/webhooks',
];
const PUBLIC_EXACT = ['/'];

// Match the auth cookie logic: only use secure cookies when NEXTAUTH_URL is HTTPS.
const useSecureCookies =
  process.env.NODE_ENV === 'production' &&
  process.env.NEXTAUTH_URL?.startsWith('https://') === true;

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = generateNonce();

  // Resolve tenant from request hostname. This is used later for studio
  // scoping and for the onboarding first-run flow.
  const hostname = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost';
  const tenant = resolveTenantFromHostname(hostname);

  // ── Locale detection & cookie management ─────────────────────────────────
  // If the user has no locale cookie yet, detect from Accept-Language header
  // and set a cookie so the server can resolve the locale on subsequent requests.
  let localeCookie = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const detectedLocale = detectLocaleFromHeader(request);

  const isPublic =
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublic) {
    const response = addSecurityHeaders(request, NextResponse.next(), nonce);
    response.headers.set('x-nonce', nonce);
    if (tenant.slug) {
      response.headers.set('x-studio-slug', tenant.slug);
    }
    if (!localeCookie && detectedLocale) {
      response.cookies.set(LOCALE_COOKIE_NAME, detectedLocale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 400, // ~400 days
        sameSite: 'lax',
        secure: useSecureCookies,
      });
    }
    return response;
  }

  const session = await auth();

  if (!session?.user) {
    const loginUrl = new URL('/login', request.url);
    return addSecurityHeaders(request, NextResponse.redirect(loginUrl), nonce);
  }

  // /admin/* requires admin or instructor role
  if (pathname.startsWith('/admin')) {
    const role = session.user.role as string | undefined;
    if (role !== 'admin' && role !== 'instructor') {
      return addSecurityHeaders(request, NextResponse.redirect(new URL('/', request.url)), nonce);
    }
  }

  // Basic studio scoping: if the session has a studioId, it should match the
  // resolved tenant. In single-tenant mode or during transition this is a no-op.
  if (session.user.studioId && tenant.slug) {
    // In SaaS mode, the user's studioId is bound to their account; the subdomain
    // must correspond to their studio. Mismatch means they are logged into the
    // wrong subdomain and should sign in again.
    // NOTE: A production implementation should verify the slug -> studioId mapping
    // from the database here. For now we allow the request to proceed and let
    // server actions/queries enforce studio_id filtering.
  }

  const response = addSecurityHeaders(request, NextResponse.next(), nonce);
  response.headers.set('x-nonce', nonce);
  if (tenant.slug) {
    response.headers.set('x-studio-slug', tenant.slug);
  }
  if (!localeCookie && detectedLocale) {
    response.cookies.set(LOCALE_COOKIE_NAME, detectedLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 400,
      sameSite: 'lax',
      secure: useSecureCookies,
    });
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\.ico|.*\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|otf|eot|mp4|webm|pdf|txt|xml|json|webmanifest)$).*)',
  ],
};
