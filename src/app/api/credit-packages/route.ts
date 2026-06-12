import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { creditPackages } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getStudioConfig } from '@/lib/studio/server';
import { handleApiError } from '@/lib/security/error-sanitizer';
import { getLogger } from '@/lib/logger';

const logger = getLogger('credit-packages');

export async function GET(request: NextRequest) {
  try {
    const studioConfig = await getStudioConfig();
    const studioId = studioConfig.id ?? '';

    const packages = await db
      .select()
      .from(creditPackages)
      .where(and(eq(creditPackages.studioId, studioId), eq(creditPackages.isActive, true)))
      .orderBy(creditPackages.sortOrder);

    return NextResponse.json(packages);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching credit packages');
    const errorResponse = handleApiError(error, 'credit-packages');
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
