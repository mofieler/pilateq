import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserOwnership } from '@/lib/auth/api-auth';
import { bookingRateLimiter } from '@/lib/security/rate-limiter';
import { logSecurityEvent } from '@/lib/security/audit-logger';
import { handleApiError } from '@/lib/security/error-sanitizer';
import { cancellationService } from '@/modules/booking/services/cancellation.service';

const cancelSchema = z.object({
  bookingId: z.string().uuid(),
  userId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  // Rate limiting check
  const rateLimitResult = await bookingRateLimiter(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Reset': rateLimitResult.resetTime?.toString() || ''
        }
      }
    );
  }

  try {
    const body = await request.json();
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { bookingId, userId } = parsed.data;

    // Authenticate and verify user ownership
    const authResult = await requireUserOwnership(request, userId);
    if (authResult instanceof NextResponse) {
      return authResult; // This is an error response
    }

    const session = authResult; // This is the valid session

    // Log security event
    await logSecurityEvent({
      userId: session.user.id,
      action: 'booking_cancel',
      resource: 'booking',
      resourceId: bookingId,
      details: { requestedUserId: userId }
    });

    // Use cancellationService for consistent behavior with server action
    const result = await cancellationService.cancel(bookingId, userId);

    if (!result.success) {
      // Map error codes to appropriate HTTP status
      let status = 500;
      switch (result.code) {
        case 'NOT_FOUND': status = 404; break;
        case 'UNAUTHORIZED': status = 401; break;
        case 'ALREADY_CANCELLED': status = 409; break;
        case 'RATE_LIMITED': status = 429; break;
        default: status = 500;
      }
      return NextResponse.json(result, { status });
    }

    return NextResponse.json({
      success: true,
      creditsRefunded: result.data.creditsRefunded,
      mercyApplied: result.data.mercyApplied,
      message: result.data.message,
    });
  } catch (error) {
    const errorResponse = handleApiError(error, 'booking-cancel');
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
