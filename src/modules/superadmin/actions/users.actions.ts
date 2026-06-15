'use server';

import { db } from '@/db';
import { users, studios, type UserRole } from '@/db/schema';
import { requireSuperAdmin } from '@/lib/auth/action-auth';
import { isNull, desc, like, or, eq, and, SQL } from 'drizzle-orm';

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  studioSlug: string | null;
  studioName: string | null;
  emailVerified: Date | null;
  createdAt: Date;
}

type ListUsersResult =
  | { success: true; items: UserListItem[] }
  | { success: false; error: string };

export async function listUsersAction(query?: string, limit = 100): Promise<ListUsersResult> {
  try {
    await requireSuperAdmin();

    const conditions: SQL[] = [isNull(users.deletedAt)];

    if (query?.trim()) {
      const q = `%${query.trim()}%`;
      const queryCondition = or(like(users.email, q), like(users.name, q));
      if (queryCondition) conditions.push(queryCondition);
    }

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        studioSlug: studios.slug,
        studioName: studios.name,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(studios, eq(users.studioId, studios.id))
      .where(and(...conditions))
      .orderBy(desc(users.createdAt))
      .limit(limit);

    return {
      success: true,
      items: rows,
    };
  } catch (error) {
    console.error('[SUPERADMIN_USERS] Failed to list users:', error);
    return { success: false, error: 'Failed to load users.' };
  }
}
