'use server';

import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { auth } from '@/lib/auth/auth';
import { eq, desc } from 'drizzle-orm';

export type AuditLogListItem = {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  severity: string;
  category: string;
  success: boolean;
  createdAt: Date;
  details: Record<string, unknown> | null;
};

export async function getRecentAuditLogsAction(
  studioId: string,
  limit: number = 8,
): Promise<{ success: true; data: AuditLogListItem[] } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        severity: auditLogs.severity,
        category: auditLogs.category,
        success: auditLogs.success,
        createdAt: auditLogs.createdAt,
        details: auditLogs.details,
        actorName: users.name,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.studioId, studioId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    return {
      success: true,
      data: rows.map((row) => ({
        ...row,
        details: (row.details as Record<string, unknown>) ?? null,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load audit logs',
    };
  }
}
