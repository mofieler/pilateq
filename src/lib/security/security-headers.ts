import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { APP_CONFIG } from '@/constants/APP_CONFIG';
import { buildCspForRequest, isEmbedPath } from '@/lib/security/embed-headers';

export function addSecurityHeaders(
  request: NextRequest,
  response: NextResponse,
  nonce?: string,
) {
  const embed = isEmbedPath(request.nextUrl.pathname);
  const cspHeader = buildCspForRequest(request, embed, nonce);

  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  if (!embed) {
    response.headers.set('X-Frame-Options', 'DENY');
  }
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), browsing-topics=()');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    const allowedOrigins = APP_CONFIG.ALLOWED_ORIGINS;
    const requestOrigin = request.headers.get('origin');
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      response.headers.set('Access-Control-Allow-Origin', requestOrigin);
      response.headers.set('Vary', 'Origin');
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
  }

  return response;
}

export function createSecurityResponse(request: NextRequest, response?: NextResponse) {
  const res = response || NextResponse.next();
  return addSecurityHeaders(request, res);
}
