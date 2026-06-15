import type { NextRequest } from 'next/server';

/** CSP frame-ancestors for /embed routes — comma-separated origins in env, or safe defaults. */
export function getEmbedFrameAncestors(): string {
  const devOrigins = process.env.NODE_ENV === 'production'
    ? []
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ];

  // Default to self only. Customer domains must be added via EMBED_FRAME_ANCESTORS.
  const defaults = ["'self'", ...devOrigins];

  const fromEnv = process.env.EMBED_FRAME_ANCESTORS?.trim();
  if (!fromEnv) {
    return defaults.join(' ');
  }

  // Combine environmental origins with default origins to avoid lockouts
  const envOrigins = fromEnv.split(/\s+/).filter(Boolean);
  const combined = Array.from(new Set([...defaults, ...envOrigins]));
  return combined.join(' ');
}

export function isEmbedPath(pathname: string): boolean {
  return pathname.startsWith('/embed') || pathname.startsWith('/api/embed');
}

export function buildCspForRequest(request: NextRequest, embed: boolean, nonce?: string): string {
  const frameAncestors = embed ? getEmbedFrameAncestors() : "'none'";

  // Per CSP3, a present nonce-source causes supporting browsers to ignore
  // 'unsafe-inline'. We keep the nonce for script-src so Next.js-injected
  // inline scripts are allowed, but style-src only needs 'unsafe-inline'
  // because many UI libraries (and Next.js chunks) apply dynamic inline
  // styles that cannot carry a nonce.
  const scriptNonce = nonce ? `'nonce-${nonce}'` : "'unsafe-inline'";

  return [
    "default-src 'self';",
    `script-src 'self' ${scriptNonce} 'unsafe-inline' https://challenges.cloudflare.com;`,
    "style-src 'self' 'unsafe-inline';",
    "style-src-attr 'self' 'unsafe-inline';",
    "style-src-elem 'self' 'unsafe-inline';",
    "img-src 'self' blob: data: https:;",
    "font-src 'self' data:;",
    "connect-src 'self' https://challenges.cloudflare.com;",
    "frame-src https://challenges.cloudflare.com;",
    "object-src 'none';",
    "base-uri 'self';",
    "form-action 'self';",
    `frame-ancestors ${frameAncestors};`,
    "upgrade-insecure-requests;",
  ].join(' ');
}
