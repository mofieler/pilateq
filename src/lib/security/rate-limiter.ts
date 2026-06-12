/**
 * Rate limiting for Next.js API route handlers. Uses Redis when REDIS_URL is
 * set, otherwise an in-memory Map (see rate-limit-store.ts).
 */

import { NextRequest } from 'next/server';
import { resolveClientIP } from './client-ip';
import { rateLimitHit } from './rate-limit-store';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export type ApiRateLimiter = (
  request: NextRequest,
) => Promise<{ success: boolean; resetTime?: number }>;

export function createRateLimiter(config: RateLimitConfig): ApiRateLimiter {
  return async function rateLimit(request: NextRequest) {
    const clientIp = resolveClientIP(request.headers);
    const key = `api:${clientIp}:${request.nextUrl.pathname}`;
    const result = await rateLimitHit(key, config.windowMs, config.maxRequests);
    return { success: result.success, resetTime: result.resetTime };
  };
}

// Predefined rate limiters for different endpoints
export const authRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 5 }); // 5 per 15min
export const bookingRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 10 }); // 10 per minute
export const purchaseRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 10 }); // 10 per minute
