/**
 * Pure tenant-resolution utilities.
 *
 * This file contains NO imports from next/headers, react, db, or Node-specific
 * modules so it can safely be imported by the Edge runtime (middleware).
 */

export interface TenantResolution {
  slug: string | null;
  hostname: string;
  isCustomDomain: boolean;
}

/**
 * Resolve tenant identifier from a hostname string.
 * In SaaS mode, subdomains like "studio.pilatesos.com" yield "studio".
 * Custom domains return the full hostname and are looked up separately.
 */
export function resolveTenantFromHostname(hostname: string): TenantResolution {
  const clean = hostname.toLowerCase().split(':')[0];
  // PLATFORM_DOMAIN is a server-side runtime alias so you don't have to
  // rebuild the image when the deployment domain changes. NEXT_PUBLIC_* is
  // still preferred because it also drives client-side preview links.
  const platformDomain = (
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ??
    process.env.PLATFORM_DOMAIN ??
    ''
  ).toLowerCase();

  if (platformDomain && clean.endsWith(`.${platformDomain}`)) {
    const slug = clean.replace(`.${platformDomain}`, '');
    return { slug, hostname: clean, isCustomDomain: false };
  }

  // Localhost / IP / no platform domain => single-tenant fallback
  if (clean === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(clean) || !platformDomain) {
    return { slug: null, hostname: clean, isCustomDomain: false };
  }

  // Otherwise treat as custom domain mapped to a studio
  return { slug: null, hostname: clean, isCustomDomain: true };
}

/**
 * Extract the hostname from a standard Web Headers object.
 * Safe to call in both Edge and Node runtimes because it only uses the
 * standard Web Fetch API `Headers` interface.
 */
export function getHostnameFromHeaders(h: Headers): string {
  return h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
}
