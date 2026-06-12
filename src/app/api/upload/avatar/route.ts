import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { uploadAvatar, deleteAvatar } from '@/lib/storage/avatar-upload';
import { checkRateLimit } from '@/lib/security/server-action-rate-limiter';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const rateLimit = await checkRateLimit(
      { keyPrefix: 'avatar-upload', windowMs: 3600_000, maxRequests: 5 },
      userId,
    );
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: 'Too many uploads. Please try again later.' },
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided.' }, { status: 400 });
    }

    // Validate size and content-type from headers BEFORE reading the body.
    const maxFileSizeBytes = APP_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxFileSizeBytes) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large. Maximum size is ${APP_CONFIG.MAX_FILE_SIZE_MB} MB.`,
          code: 'FILE_TOO_LARGE',
        },
        { status: 413 },
      );
    }

    if (!APP_CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type as (typeof APP_CONFIG.ALLOWED_IMAGE_TYPES)[number])) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file type. Allowed types: ${APP_CONFIG.ALLOWED_IMAGE_TYPES.join(', ')}.`,
          code: 'INVALID_FILE_TYPE',
        },
        { status: 415 },
      );
    }

    const cropXStr = formData.get('cropX');
    const cropYStr = formData.get('cropY');
    const cropWidthStr = formData.get('cropWidth');
    const cropHeightStr = formData.get('cropHeight');

    let crop = undefined;
    if (cropXStr !== null && cropYStr !== null && cropWidthStr !== null && cropHeightStr !== null) {
      const x = parseFloat(String(cropXStr));
      const y = parseFloat(String(cropYStr));
      const width = parseFloat(String(cropWidthStr));
      const height = parseFloat(String(cropHeightStr));
      if (!isNaN(x) && !isNaN(y) && !isNaN(width) && !isNaN(height)) {
        crop = { x, y, width, height };
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadAvatar(userId, buffer, file.type, crop);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, avatarUrl: result.avatarUrl });
  } catch (err) {
    console.error('[api/upload/avatar] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await deleteAvatar(session.user.id);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/upload/avatar] Delete error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 },
    );
  }
}
