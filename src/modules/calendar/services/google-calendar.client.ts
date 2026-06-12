import { google, calendar_v3 } from 'googleapis';
import { db } from '@/db';
import { calendarConnections } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { encryptToken, decryptToken } from '@/lib/calendar/token-crypto';
import type { CalendarConnection } from '@/db/schema';

// Centralised Google Calendar client factory.
// Handles OAuth2 client creation + lazy token refresh.
// All sync operations should go through here so token persistence stays correct.

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
export const CALENDAR_OAUTH_SCOPES = [
  CALENDAR_SCOPE,
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
] as const;
const REFRESH_SAFETY_BUFFER_MS = 60_000; // refresh if token expires within 60s

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

function getOAuth2Client(): OAuth2Client {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET missing — cannot create OAuth client');
  }
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/oauth/callback`;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Builds the URL the user is redirected to in order to grant calendar access.
 * `state` is an opaque CSRF token validated on callback.
 */
export function buildAuthUrl(state: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force refresh_token issuance even on re-auth
    scope: [...CALENDAR_OAUTH_SCOPES],
    state,
    include_granted_scopes: true,
  });
}

/**
 * Exchanges the auth code for tokens. Returns the raw token set.
 * Caller is responsible for persisting (encrypted) into calendar_connections.
 */
export async function exchangeCodeForTokens(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error(
      'Google did not return a complete token set — ensure prompt=consent and access_type=offline',
    );
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(tokens.expiry_date),
    scope: tokens.scope ?? '',
  };
}

/**
 * Returns an authorised OAuth2Client for the given connection.
 * Refreshes the access token if it's about to expire, and PERSISTS the new
 * token back to DB (encrypted). Caller can then build the calendar API.
 */
async function getAuthorisedClient(conn: CalendarConnection): Promise<OAuth2Client> {
  const client = getOAuth2Client();
  const accessToken = decryptToken(conn.accessToken);
  const refreshToken = decryptToken(conn.refreshToken);

  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: conn.tokenExpiresAt.getTime(),
  });

  // Listen for refresh events so we can persist rotated tokens.
  // Google may rotate the refresh_token on refresh; if so it appears here.
  client.on('tokens', async (tokens) => {
    const updates: Record<string, unknown> = {};
    if (tokens.access_token) {
      updates.accessToken = encryptToken(tokens.access_token);
    }
    if (tokens.expiry_date) {
      updates.tokenExpiresAt = new Date(tokens.expiry_date);
    }
    if (tokens.refresh_token) {
      updates.refreshToken = encryptToken(tokens.refresh_token);
    }
    if (Object.keys(updates).length === 0) return;
    await db
      .update(calendarConnections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(calendarConnections.id, conn.id));
  });

  // Eager refresh if the access token will expire soon.
  if (conn.tokenExpiresAt.getTime() - Date.now() < REFRESH_SAFETY_BUFFER_MS) {
    await client.getAccessToken(); // triggers the 'tokens' listener above
  }

  return client;
}

export type CalendarApi = calendar_v3.Calendar;

/**
 * Returns a ready-to-use Calendar API client for the given connection.
 * Use this for ALL outbound calls — it ensures tokens stay fresh.
 */
export async function getCalendarApi(conn: CalendarConnection): Promise<CalendarApi> {
  const auth = await getAuthorisedClient(conn);
  return google.calendar({ version: 'v3', auth });
}

/**
 * Lists the user's writable calendars after a successful OAuth.
 * Used by the calendar-selector dropdown.
 */
export async function listAccessibleCalendars(conn: CalendarConnection) {
  const api = await getCalendarApi(conn);
  const res = await api.calendarList.list({
    minAccessRole: 'writer',
    showHidden: false,
  });
  return (res.data.items ?? []).map((c) => ({
    id: c.id!,
    summary: c.summary ?? c.id!,
    primary: c.primary ?? false,
    backgroundColor: c.backgroundColor ?? null,
  }));
}

/**
 * Fetches the email of the user that owns these tokens.
 * Called once during OAuth callback to populate googleAccountEmail.
 */
export async function fetchTokenOwnerEmail(accessToken: string): Promise<string> {
  const client = getOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const res = await oauth2.userinfo.get();
  if (!res.data.email) {
    throw new Error('Could not read Google account email from userinfo');
  }
  return res.data.email;
}
