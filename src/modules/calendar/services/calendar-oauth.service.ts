import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '@/db';
import { calendarConnections, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  fetchTokenOwnerEmail,
} from './google-calendar.client';
import { encryptToken } from '@/lib/calendar/token-crypto';

// CSRF protection for the OAuth round-trip.
// We sign a state token with HMAC-SHA256(secret, userId + nonce + expiry).
// State lives in an HttpOnly cookie; on callback we verify the signature AND
// match against the cookie. Both must agree to prevent CSRF + state swapping.

const STATE_TTL_MS = 10 * 60 * 1000; // 10 min

function getStateSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET missing — required for OAuth state signing');
  return secret;
}

export interface OAuthState {
  userId: string;
  nonce: string;
  expiresAt: number;
}

export function createState(userId: string): { state: string; cookieValue: string } {
  const nonce = randomBytes(16).toString('base64url');
  const expiresAt = Date.now() + STATE_TTL_MS;
  const payload: OAuthState = { userId, nonce, expiresAt };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', getStateSecret()).update(payloadB64).digest('base64url');
  const state = `${payloadB64}.${sig}`;
  // Cookie value is the same signed state — we match them on callback.
  return { state, cookieValue: state };
}

export function verifyState(state: string, cookieValue: string | undefined): OAuthState | null {
  if (!state || !cookieValue) return null;

  // 1. Constant-time comparison of state vs cookie (CSRF guard).
  const a = Buffer.from(state);
  const b = Buffer.from(cookieValue);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [payloadB64, sig] = state.split('.');
  if (!payloadB64 || !sig) return null;

  // 2. Verify HMAC signature BEFORE decoding payload — never trust the payload
  //    unless the signature checks out.
  const expectedSig = createHmac('sha256', getStateSecret())
    .update(payloadB64)
    .digest('base64url');
  const sigA = Buffer.from(sig);
  const sigB = Buffer.from(expectedSig);
  if (sigA.length !== sigB.length || !timingSafeEqual(sigA, sigB)) return null;

  // 3. Signature is valid → decode and check expiry.
  let payload: OAuthState;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (payload.expiresAt < Date.now()) return null;
  return payload;
}

export function getAuthorizationUrl(userId: string): { url: string; cookieValue: string } {
  const { state, cookieValue } = createState(userId);
  return { url: buildAuthUrl(state), cookieValue };
}

/**
 * Handles the post-consent callback:
 *  1. Validates state (caller already did the cookie check).
 *  2. Exchanges code → tokens.
 *  3. Fetches the connected Google account's email (for display).
 *  4. Upserts the calendar_connections row for this user (encrypted tokens).
 */
export async function completeConnection(userId: string, code: string): Promise<void> {
  const tokens = await exchangeCodeForTokens(code);
  const googleEmail = await fetchTokenOwnerEmail(tokens.accessToken);

  const encryptedAccess = encryptToken(tokens.accessToken);
  const encryptedRefresh = encryptToken(tokens.refreshToken);

  const existing = await db
    .select({ id: calendarConnections.id })
    .from(calendarConnections)
    .where(eq(calendarConnections.userId, userId))
    .limit(1);

  const [userRow] = await db
    .select({ studioId: users.studioId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const studioId = userRow?.studioId;
  if (!studioId) throw new Error('User studio not found');

  if (existing[0]) {
    // Reconnect — keep selectedCalendarId so the user doesn't have to re-pick.
    await db
      .update(calendarConnections)
      .set({
        googleAccountEmail: googleEmail,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: tokens.expiresAt,
        syncEnabled: true,
        lastSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(calendarConnections.id, existing[0].id));
  } else {
    await db.insert(calendarConnections).values({
      studioId,
      userId,
      provider: 'google',
      googleAccountEmail: googleEmail,
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      tokenExpiresAt: tokens.expiresAt,
      syncEnabled: true,
    });
  }
}

/**
 * Disconnects a calendar — removes the row entirely.
 * Cascade deletes any external_calendar_blocks that were synced from it.
 * Class sessions with googleCalendarEventId keep the ID (it just won't sync anymore).
 */
export async function disconnect(userId: string, studioId: string): Promise<void> {
  await db
    .delete(calendarConnections)
    .where(and(eq(calendarConnections.userId, userId), eq(calendarConnections.studioId, studioId)));
}
