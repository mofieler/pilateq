/**
 * Rate limiting for Server Actions. Uses Redis when REDIS_URL is set,
 * otherwise an in-memory Map. The store decision lives in rate-limit-store.ts;
 * this module just composes the key from (prefix, IP, identifier) and calls
 * the store.
 */

import { headers } from "next/headers";
import { resolveClientIP } from "./client-ip";
import { rateLimitHit } from "./rate-limit-store";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

/**
 * Get client IP from headers (Next.js 16 — must await headers()).
 * Honours TRUSTED_PROXY_COUNT to avoid trusting attacker-supplied XFF.
 */
async function getClientIP(): Promise<string> {
  const headersList = await headers();
  return resolveClientIP(headersList);
}

/**
 * Check rate limit for a given action and identifier. Returns success=true
 * if the call fits within the window, false if the limit is exceeded.
 */
export async function checkRateLimit(
  config: RateLimitConfig,
  identifier: string,
): Promise<{ success: boolean; remaining: number; resetTime?: number }> {
  const ip = await getClientIP();
  const key = `${config.keyPrefix}:${ip}:${identifier}`;
  const result = await rateLimitHit(key, config.windowMs, config.maxRequests);
  return {
    success: result.success,
    remaining: result.remaining,
    resetTime: result.resetTime,
  };
}

// ─── Predefined rate limiting configs ────────────────────────────────────────

export const authRateLimitConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  keyPrefix: "auth",
};

export const registerRateLimitConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3, // 3 registrations per 15 minutes
  keyPrefix: "register",
};

export const bookingRateLimitConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 bookings per minute per user
  keyPrefix: "booking",
};

export const cancellationRateLimitConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 cancellations per minute per user
  keyPrefix: "cancellation",
};

export const duoInviteRateLimitConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 duo invite ops per minute per user
  keyPrefix: "duo_invite",
};

export const membershipSubscribeRateLimitConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 subscription attempts per 15 minutes per user
  keyPrefix: "membership_subscribe",
};

export const inviteAcceptRateLimitConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 invite-token attempts per 15 minutes per token/IP
  keyPrefix: "invite_accept",
};
