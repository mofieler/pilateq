import { join } from 'path';
import { readFile, stat } from 'fs/promises';
import { createHash } from 'crypto';
import { NextResponse } from 'next/server';

// Security validation: Only allow UUIDs and valid timestamps for files
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILENAME_REGEX = /^[0-9]+\.webp$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string; filename: string }> },
) {
  try {
    const { userId, filename } = await params;

    // Validate parameters to prevent path traversal and arbitrary reading
    if (
      !userId ||
      !filename ||
      !UUID_REGEX.test(userId) ||
      !FILENAME_REGEX.test(filename)
    ) {
      return new NextResponse('Invalid path parameters', { status: 400 });
    }

    const primaryPath = join(process.cwd(), 'storage', 'avatars', userId, filename);
    const fallbackPath = join(process.cwd(), 'public', 'avatars', userId, filename);

    let fileBuffer: Buffer;
    let resolvedPath: string;
    try {
      fileBuffer = await readFile(primaryPath);
      resolvedPath = primaryPath;
      console.log('[api/avatars] Serving from primary:', primaryPath);
    } catch {
      try {
        fileBuffer = await readFile(fallbackPath);
        resolvedPath = fallbackPath;
        console.log('[api/avatars] Serving from fallback:', fallbackPath);
      } catch {
        console.error('[api/avatars] Neither primary nor fallback found. Primary:', primaryPath, 'Fallback:', fallbackPath);
        throw new Error('Avatar file not found');
      }
    }

    // Compute ETag (MD5 of content) for conditional requests
    const etag = createHash('md5').update(fileBuffer).digest('hex').slice(0, 16);

    // Check If-None-Match for 304 Not Modified
    const clientEtag = request.headers.get('if-none-match');
    if (clientEtag === etag) {
      return new NextResponse(null, { status: 304 });
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(fileBuffer.length),
        'ETag': etag,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('[api/avatars] Avatar not found:', err);
    return new NextResponse('Avatar not found', { status: 404 });
  }
}
