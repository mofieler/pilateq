/**
 * Cloudflare Turnstile verification helper.
 *
 * Server-side check: take a token issued by the client widget and confirm
 * it with Cloudflare. The widget has a managed/invisible mode by default,
 * so most legitimate users never see a challenge.
 *
 * Dev mode: if TURNSTILE_SECRET_KEY is unset (no keys provisioned yet),
 * the helper short-circuits to success. The widget client-side similarly
 * renders nothing if NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset. This means
 * local development works without any setup, and prod fails closed only
 * once keys are provisioned.
 *
 * Provisioning: create a "managed" Turnstile widget at
 *   https://dash.cloudflare.com/?to=/:account/turnstile
 * and set:
 *   - NEXT_PUBLIC_TURNSTILE_SITE_KEY (client-visible, for the widget)
 *   - TURNSTILE_SECRET_KEY (server-only, for verification)
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult =
  | { success: true }
  | { success: false; error: string };

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Dev / un-provisioned: skip verification so local development works
    // without keys. Production MUST fail closed.
    if (process.env.NODE_ENV === 'production') {
      console.error('[turnstile] TURNSTILE_SECRET_KEY not set — rejecting request');
      return { success: false, error: 'Captcha verification is not configured.' };
    }
    return { success: true };
  }

  if (!token) {
    return { success: false, error: 'Captcha required.' };
  }

  try {
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token);
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      // Hard cap so a slow Cloudflare doesn't hang the registration request.
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      console.warn('[turnstile] siteverify HTTP', res.status);
      return { success: false, error: 'Captcha verification failed. Please try again.' };
    }

    const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] };
    if (!data.success) {
      console.warn('[turnstile] verification rejected:', data['error-codes']);
      return { success: false, error: 'Captcha challenge failed. Please try again.' };
    }
    return { success: true };
  } catch (err) {
    console.warn('[turnstile] verification error:', err);
    // Fail closed on errors so this can't be bypassed by causing a network
    // timeout to Cloudflare from the server.
    return { success: false, error: 'Captcha verification failed. Please try again.' };
  }
}
