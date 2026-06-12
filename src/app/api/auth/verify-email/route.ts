import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { and, eq, gt } from 'drizzle-orm';

// Get app URL from env or fallback to request URL
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

function getRedirectUrl(path: string, request: NextRequest): string {
  // Use configured app URL if available, otherwise use request origin
  const baseUrl = APP_URL || request.nextUrl.origin;
  return new URL(path, baseUrl).toString();
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get('token');
  const identifier = searchParams.get('identifier');

  // Invalid or missing parameters
  if (!token || !identifier) {
    return NextResponse.redirect(getRedirectUrl('/verification-failed?reason=invalid', request));
  }

  // Check if token exists and is valid
  const tokenRecord = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.token, token),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  // Token not found or expired
  if (!tokenRecord) {
    return NextResponse.redirect(getRedirectUrl('/verification-failed?reason=expired', request));
  }

  // Mark email verified and delete the used token atomically
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ emailVerified: new Date(), updatedAt: new Date() })
      .where(eq(users.email, identifier));

    await tx
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, identifier),
          eq(verificationTokens.token, token),
        ),
      );
  });

  // Success - redirect to styled success page
  return NextResponse.redirect(getRedirectUrl('/email-verified', request));
}
