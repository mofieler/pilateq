import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import {
  verifyState,
  completeConnection,
} from '@/modules/calendar/services/calendar-oauth.service';

// GET /api/calendar/oauth/callback?code=...&state=...
// Google redirects here after the user grants (or denies) consent.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const url = new URL(req.url);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  // User denied or Google returned an error
  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/admin/calendar-sync?error=${encodeURIComponent(errorParam)}`, appUrl),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL('/admin/calendar-sync?error=missing_params', appUrl));
  }

  // Re-check session — Google can take minutes; user could have logged out.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', appUrl));
  }
  const role = session.user.role as string | undefined;
  if (role !== 'admin' && role !== 'instructor') {
    return NextResponse.redirect(new URL('/', appUrl));
  }

  const cookieValue = req.cookies.get('calendar_oauth_state')?.value;
  const verified = verifyState(state, cookieValue);
  if (!verified || verified.userId !== session.user.id) {
    return NextResponse.redirect(new URL('/admin/calendar-sync?error=invalid_state', appUrl));
  }

  try {
    await completeConnection(session.user.id, code);
  } catch (err) {
    console.error('[CALENDAR-OAUTH] Token exchange failed:', err);
    return NextResponse.redirect(new URL('/admin/calendar-sync?error=token_exchange', appUrl));
  }

  const res = NextResponse.redirect(new URL('/admin/calendar-sync?connected=1', appUrl));
  // Clear the one-shot state cookie
  res.cookies.set('calendar_oauth_state', '', {
    httpOnly: true,
    path: '/api/calendar/oauth',
    maxAge: 0,
  });
  return res;
}
