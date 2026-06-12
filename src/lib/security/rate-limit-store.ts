/**
 * Unified rate-limit store. Picks Redis when REDIS_URL is set, falls back to
 * an in-memory Map otherwise (single-process dev). Both rate limiters in this
 * folder (rate-limiter.ts for API routes, server-action-rate-limiter.ts for
 * server actions) consult this store so a multi-instance deploy actually
 * shares state.
 *
 * The Redis algorithm is the standard fixed-window: INCR a key, PEXPIRE on the
 * first hit. Atomic per Redis command semantics; no Lua needed for this
 * coarse window.
 */

import type { RedisClientType } from 'redis';
import { db } from '@/db';
import { rateLimits, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface HitResult {
  /** true if the request fits within the limit */
  success: boolean;
  /** how many hits are still available in the current window */
  remaining: number;
  /** epoch ms when the current window ends */
  resetTime: number;
}

// ─── In-memory fallback ──────────────────────────────────────────────────────

interface MemEntry {
  count: number;
  resetTime: number;
}

const memStore = new Map<string, MemEntry>();

function memHit(key: string, windowMs: number, maxRequests: number): HitResult {
  const now = Date.now();
  let entry = memStore.get(key);
  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + windowMs };
    memStore.set(key, entry);
    return { success: true, remaining: maxRequests - 1, resetTime: entry.resetTime };
  }
  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, resetTime: entry.resetTime };
  }
  entry.count += 1;
  return { success: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime };
}

// Periodic cleanup for the mem store. No-op when Redis is in use.
const CLEANUP_INTERVAL = 5 * 60 * 1000;
if (typeof setInterval === 'function') {
  const globalKey = '__pilatesos_rate_limit_cleanup';
  if (typeof globalThis !== 'undefined' && (globalThis as any)[globalKey]) {
    clearInterval((globalThis as any)[globalKey]);
  }
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [k, e] of memStore.entries()) {
      if (now > e.resetTime) memStore.delete(k);
    }
  }, CLEANUP_INTERVAL);
  interval.unref?.();
  if (typeof globalThis !== 'undefined') {
    (globalThis as any)[globalKey] = interval;
  }
}

// ─── Redis connection (lazy, cached) ─────────────────────────────────────────

type RedisClient = RedisClientType<any, any, any>;

let redisPromise: Promise<RedisClient | null> | null = null;

async function getRedis(): Promise<RedisClient | null> {
  if (!process.env.REDIS_URL) return null;
  if (redisPromise) return redisPromise;

  redisPromise = (async () => {
    try {
      const { createClient } = await import('redis');
      const client = createClient({
        url: process.env.REDIS_URL,
        socket: { reconnectStrategy: (retries) => Math.min(retries * 50, 2000) },
      }) as RedisClient;
      client.on('error', (err) => {
        console.warn('[rate-limit] Redis error, fall-through to DB/mem store:', err?.message ?? err);
        // Reset cached promise so next request creates a fresh connection
        redisPromise = null;
        client.disconnect().catch(() => {});
      });
      await client.connect();
      console.info('[rate-limit] Redis connected');
      return client;
    } catch (err) {
      console.warn('[rate-limit] Redis connect failed, using DB/in-memory store:', err);
      return null;
    }
  })();

  return redisPromise;
}

async function redisHit(
  client: RedisClient,
  key: string,
  windowMs: number,
  maxRequests: number,
): Promise<HitResult> {
  const fullKey = `pilatesos:rl:${key}`;
  const count = await client.incr(fullKey);
  if (count === 1) {
    await client.pExpire(fullKey, windowMs);
  }
  let pttl = await client.pTTL(fullKey);
  if (pttl < 0) {
    await client.pExpire(fullKey, windowMs);
    pttl = windowMs;
  }
  const resetTime = Date.now() + pttl;
  if (count > maxRequests) {
    return { success: false, remaining: 0, resetTime };
  }
  return { success: true, remaining: maxRequests - count, resetTime };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Register one hit against the limiter. Returns whether the call is allowed
 * and how much budget is left in the current window. Falls back to the
 * in-memory store on any Redis error so the limiter never fails open by
 * accident.
 */
export async function rateLimitHit(
  key: string,
  windowMs: number,
  maxRequests: number,
): Promise<HitResult> {
  const redis = await getRedis().catch(() => null);
  if (!redis) return memHit(key, windowMs, maxRequests);
  try {
    return await redisHit(redis, key, windowMs, maxRequests);
  } catch (err) {
    console.warn('[rate-limit] Redis op failed, fall-through to mem store:', err);
    return memHit(key, windowMs, maxRequests);
  }
}

// ─── Advanced Auth Rate Limiting (Exponential Backoff, Admin Bypass, DB Fallback) ───

export interface RateLimitState {
  key: string;
  attempts: number;
  lockedUntil: Date | null;
  backoffTier: number;
}

function calculateLock(attempts: number): { tier: number; durationMinutes: number } {
  if (attempts < 5) return { tier: 0, durationMinutes: 0 };
  if (attempts === 5) return { tier: 1, durationMinutes: 1 };
  if (attempts === 6) return { tier: 2, durationMinutes: 5 };
  if (attempts === 7) return { tier: 3, durationMinutes: 15 };
  return { tier: 4, durationMinutes: 60 }; // 8+ attempts
}

async function getState(key: string): Promise<RateLimitState> {
  const redis = await getRedis().catch(() => null);
  if (redis) {
    try {
      const data = await redis.get(`pilatesos:rl:auth:${key}`);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          key,
          attempts: parsed.attempts ?? 0,
          lockedUntil: parsed.lockedUntil ? new Date(parsed.lockedUntil) : null,
          backoffTier: parsed.backoffTier ?? 0,
        };
      }
    } catch (err) {
      console.warn('[rate-limit] Redis get state failed, falling back to DB:', err);
    }
  }

  // Fallback to DB
  try {
    const row = await db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.key, key))
      .limit(1)
      .then((r) => r[0]);
    if (row) {
      return {
        key,
        attempts: row.attempts,
        lockedUntil: row.lockedUntil,
        backoffTier: row.backoffTier,
      };
    }
  } catch (err) {
    console.error('[rate-limit] DB get state failed:', err);
  }

  return {
    key,
    attempts: 0,
    lockedUntil: null,
    backoffTier: 0,
  };
}

async function saveState(state: RateLimitState): Promise<void> {
  const redis = await getRedis().catch(() => null);
  if (redis) {
    try {
      await redis.set(
        `pilatesos:rl:auth:${state.key}`,
        JSON.stringify({
          attempts: state.attempts,
          lockedUntil: state.lockedUntil?.toISOString() ?? null,
          backoffTier: state.backoffTier,
        }),
        {
          EX: state.lockedUntil
            ? Math.max(Math.ceil((state.lockedUntil.getTime() - Date.now()) / 1000), 60)
            : 24 * 60 * 60, // Store for 24h if not locked
        }
      );
      // Synchronize with DB so state is always persisted in DB
    } catch (err) {
      console.warn('[rate-limit] Redis save state failed, falling back to DB:', err);
    }
  }

  // Always write to DB if Redis fails or alongside Redis to guarantee persistence across container restarts
  try {
    await db
      .insert(rateLimits)
      .values({
        key: state.key,
        attempts: state.attempts,
        lockedUntil: state.lockedUntil,
        backoffTier: state.backoffTier,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          attempts: state.attempts,
          lockedUntil: state.lockedUntil,
          backoffTier: state.backoffTier,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.error('[rate-limit] DB save state failed:', err);
  }
}

async function deleteState(key: string): Promise<void> {
  const redis = await getRedis().catch(() => null);
  if (redis) {
    try {
      await redis.del(`pilatesos:rl:auth:${key}`);
    } catch (err) {
      console.warn('[rate-limit] Redis delete state failed, falling back to DB:', err);
    }
  }

  try {
    await db.delete(rateLimits).where(eq(rateLimits.key, key));
  } catch (err) {
    console.error('[rate-limit] DB delete state failed:', err);
  }
}

/**
 * Check if the current client is rate limited based on IP and/or email address.
 * Bypasses checks if the user's role is 'admin'.
 */
export async function checkAuthRateLimit(
  ip: string,
  email: string,
): Promise<{ success: boolean; lockedUntil?: Date }> {
  // Check if admin to bypass rate limits
  try {
    const user = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1)
      .then((r) => r[0]);

    if (user && user.role === 'admin') {
      return { success: true };
    }
  } catch (err) {
    console.error('[rate-limit] Admin check failed in checkAuthRateLimit:', err);
  }

  const now = new Date();
  const ipKey = `ip:${ip}`;
  const emailKey = `email:${email.toLowerCase().trim()}`;

  const [ipState, emailState] = await Promise.all([getState(ipKey), getState(emailKey)]);

  let maxLockedUntil: Date | undefined;

  if (ipState.lockedUntil && ipState.lockedUntil > now) {
    maxLockedUntil = ipState.lockedUntil;
  }

  if (emailState.lockedUntil && emailState.lockedUntil > now) {
    if (!maxLockedUntil || emailState.lockedUntil > maxLockedUntil) {
      maxLockedUntil = emailState.lockedUntil;
    }
  }

  if (maxLockedUntil) {
    return { success: false, lockedUntil: maxLockedUntil };
  }

  return { success: true };
}

/**
 * Record a failed authentication attempt for the IP and email.
 */
export async function recordAuthFailure(ip: string, email: string): Promise<void> {
  try {
    const user = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1)
      .then((r) => r[0]);

    if (user && user.role === 'admin') {
      return;
    }
  } catch (err) {
    console.error('[rate-limit] Admin check failed in recordAuthFailure:', err);
  }

  const now = new Date();
  const keys = [`ip:${ip}`, `email:${email.toLowerCase().trim()}`];

  await Promise.all(
    keys.map(async (key) => {
      const state = await getState(key);
      state.attempts += 1;
      const { tier, durationMinutes } = calculateLock(state.attempts);
      state.backoffTier = tier;
      if (durationMinutes > 0) {
        state.lockedUntil = new Date(now.getTime() + durationMinutes * 60 * 1000);
      } else {
        state.lockedUntil = null;
      }
      await saveState(state);
    })
  );
}

/**
 * Reset all failed attempts for the given IP and email (called on successful login).
 */
export async function resetAuthLimits(ip: string, email: string): Promise<void> {
  const keys = [`ip:${ip}`, `email:${email.toLowerCase().trim()}`];
  await Promise.all(keys.map((key) => deleteState(key)));
}

/**
 * Get the current failed attempts count for either IP or email (returns the max).
 */
export async function getAuthAttempts(ip: string, email: string): Promise<number> {
  const ipKey = `ip:${ip}`;
  const emailKey = `email:${email.toLowerCase().trim()}`;
  const [ipState, emailState] = await Promise.all([getState(ipKey), getState(emailKey)]);
  return Math.max(ipState.attempts, emailState.attempts);
}
