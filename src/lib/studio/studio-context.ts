/**
 * Studio Context Helpers
 *
 * Centralized functions for resolving the current studio ID from:
 * - Authenticated user session (JWT token)
 * - Request hostname (for middleware/API routes)
 * - Explicit parameter (for services called from other services)
 *
 * Every service/action that touches tenant-scoped data MUST use one of these.
 */

import { auth } from '@/lib/auth/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Resolve studioId from the current auth session.
 *
 * This intentionally does NOT fall back to a "default" studio. In SaaS mode
 * falling back to the first tenant in the database would break tenant
 * isolation and allow cross-tenant data access.
 */
export async function getStudioIdFromSession(): Promise<string | null> {
  const session = await auth();
  return session?.user?.studioId ?? null;
}

/**
 * Strict variant: throws if no studio can be resolved.
 * Use this when studio context is mandatory (e.g. credit transactions).
 */
export async function requireStudioId(): Promise<string> {
  const studioId = await getStudioIdFromSession();
  if (!studioId) {
    throw new Error('No studio context available — cannot proceed without tenant isolation');
  }
  return studioId;
}

/**
 * Resolve studioId from an explicit userId lookup.
 * Use this in cron jobs or background tasks where no session exists.
 *
 * Does NOT fall back to a default studio.
 */
export async function getStudioIdForUser(userId: string): Promise<string | null> {
  const [userRow] = await db
    .select({ studioId: users.studioId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return userRow?.studioId ?? null;
}
