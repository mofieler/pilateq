import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getAuthorizationUrl } from '@/modules/calendar/services/calendar-oauth.service';

// GET /api/calendar/oauth/start
// Initiates the Google OAuth flow for calendar access.
// Sets a signed CSRF state cookie and redirects to Google's consent screen.
//
// Auth: must be a logged-in admin or instructor.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!));
  }
  const role = session.user.role as string | undefined;
  if (role !== 'admin' && role !== 'instructor') {
    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL!));
  }

  const { url, cookieValue } = getAuthorizationUrl(session.user.id);

  const res = NextResponse.redirect(url);
  res.cookies.set('calendar_oauth_state', cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/calendar/oauth',
    maxAge: 600, // 10 min, matches state TTL
  });
  return res;
}
