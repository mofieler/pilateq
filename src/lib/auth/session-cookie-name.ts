/**
 * Auth.js session cookie name helper.
 *
 * Mirrors the cookie-name logic in auth.config.ts so that middleware can clear
 * the exact cookie that Auth.js sets.
 */

// Auth.js uses secure cookies in production by default. Self-hosted deployments
// often run on HTTP (e.g. Coolify sslip.io domains), so we derive the secure
// flag from NEXTAUTH_URL unless AUTH_COOKIE_SECURE is explicitly set.
export function useSecureCookies(): boolean {
  if (process.env.AUTH_COOKIE_SECURE === 'true') return true;
  if (process.env.AUTH_COOKIE_SECURE === 'false') return false;
  return (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXTAUTH_URL?.startsWith('https://') === true
  );
}

/**
 * Choose the strictest valid cookie prefix for an Auth.js cookie.
 *
 * - __Host- requires Secure, Path '/', and NO Domain attribute. Use it whenever
 *   cookies are secure and AUTH_COOKIE_DOMAIN is not set so the session cannot
 *   be shared across subdomains.
 * - __Secure- is used when cookies are secure but a shared domain is configured.
 * - Unprefixed names are used for insecure contexts (e.g. local HTTP dev).
 */
export function getAuthCookieName(baseName: string): string {
  if (!useSecureCookies()) return baseName;
  if (process.env.AUTH_COOKIE_DOMAIN) return `__Secure-${baseName}`;
  return `__Host-${baseName}`;
}
