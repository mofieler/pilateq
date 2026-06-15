import { checkRateLimit, type RateLimitConfig } from './server-action-rate-limiter';

/**
 * Rate limiting configuration for studio member invitations.
 *
 * - Per admin: cap how many invites a single admin can send per hour.
 * - Per email: cap how many invites a single address can receive per day.
 */

export const inviteByAdminRateLimitConfig: RateLimitConfig = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 20, // 20 invites per admin per hour
  keyPrefix: 'invite_by_admin',
};

export const inviteByEmailRateLimitConfig: RateLimitConfig = {
  windowMs: 24 * 60 * 60 * 1000, // 1 day
  maxRequests: 5, // 5 invites per email address per day
  keyPrefix: 'invite_by_email',
};

export interface InviteRateLimitResult {
  adminLimit: { success: boolean; remaining: number; resetTime?: number };
  emailLimit: { success: boolean; remaining: number; resetTime?: number };
}

/**
 * Check both invite rate limits in parallel.
 */
export async function checkInviteRateLimits(
  adminUserId: string,
  email: string,
): Promise<InviteRateLimitResult> {
  const [adminLimit, emailLimit] = await Promise.all([
    checkRateLimit(inviteByAdminRateLimitConfig, adminUserId),
    checkRateLimit(inviteByEmailRateLimitConfig, email.toLowerCase()),
  ]);
  return { adminLimit, emailLimit };
}
