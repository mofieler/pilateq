import type { Session } from 'next-auth';
import { auth } from '@/lib/auth/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface AuthActionContext {
  userId: string;
  role: string;
  studioId: string;
}

export class ActionAuthError extends Error {
  code = 'UNAUTHORIZED' as const;

  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'ActionAuthError';
  }
}

interface SessionUser {
  id: string;
  role?: string | null;
  studioId?: string | null;
}

function getSessionUser(session: Session | null): SessionUser | null {
  if (!session?.user?.id) return null;
  return session.user as SessionUser;
}

async function getAuthSession(): Promise<Session | null> {
  return (await auth()) as unknown as Session | null;
}

/**
 * Require an authenticated admin session.
 * Returns `{ userId, role, studioId }` or throws `ActionAuthError` with code `UNAUTHORIZED`.
 */
export async function requireAdmin(): Promise<AuthActionContext> {
  const session = await getAuthSession();
  const user = getSessionUser(session);

  if (!user || user.role !== 'admin' || !user.studioId) {
    throw new ActionAuthError();
  }

  return { userId: user.id, role: user.role, studioId: user.studioId };
}

/**
 * Require an authenticated admin or instructor session.
 * Returns `{ userId, role, studioId }` or throws `ActionAuthError` with code `UNAUTHORIZED`.
 */
export async function requireAdminOrInstructor(): Promise<AuthActionContext> {
  const session = await getAuthSession();
  const user = getSessionUser(session);
  const role = user?.role;

  if (!user || !user.studioId || (role !== 'admin' && role !== 'instructor')) {
    throw new ActionAuthError();
  }

  return { userId: user.id, role, studioId: user.studioId };
}

/**
 * Require an authenticated student session.
 * Returns `{ userId, studioId }` or throws `ActionAuthError` with code `UNAUTHORIZED`.
 */
export async function requireStudent(): Promise<{ userId: string; studioId: string }> {
  const session = await getAuthSession();
  const user = getSessionUser(session);

  if (!user || !user.studioId) {
    throw new ActionAuthError();
  }

  return { userId: user.id, studioId: user.studioId };
}

/**
 * Require an authenticated admin that belongs to the given studio.
 * Returns `{ userId, role, studioId }` or throws `ActionAuthError` with code `UNAUTHORIZED`.
 */
export async function requireStudioAdmin(studioId: string): Promise<AuthActionContext> {
  const ctx = await requireAdmin();

  if (ctx.studioId === studioId) {
    return ctx;
  }

  // Session may be stale or cross-tenant — verify the latest DB record.
  const [row] = await db
    .select({ studioId: users.studioId, role: users.role })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .limit(1);

  if (row?.role !== 'admin' || row?.studioId !== studioId) {
    throw new ActionAuthError();
  }

  return ctx;
}
