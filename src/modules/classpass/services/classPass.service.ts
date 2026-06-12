/**
 * Class Pass Service
 *
 * Manages check-ins for external fitness partner platforms.
 * This is the operational backend for Phase 3 class pass integrations.
 */

import { db } from '@/db';
import { classPassCheckins, classSessions, classTemplates, users } from '@/db/schema';
import { eq, and, gte, lte, isNull, desc } from 'drizzle-orm';
import { getStudioConfig } from '@/lib/studio/server';

export interface CreateCheckinInput {
  studioId: string;
  userId: string;
  sessionId: string;
  providerKey: string;
  status?: 'pending' | 'confirmed' | 'rejected';
  notes?: string;
}

export interface ReconciliationFilter {
  studioId: string;
  providerKey?: string;
  from?: Date;
  to?: Date;
  status?: string;
}

export async function createClassPassCheckin(input: CreateCheckinInput) {
  const config = await getStudioConfig();
  const maxSpots = getMaxSpotsForProvider(config.accessProviders, input.providerKey);

  return await db.transaction(async (tx) => {
    // Count existing confirmed check-ins for this session/provider.
    const [{ count }] = await tx
      .select({ count: db.$count(classPassCheckins) })
      .from(classPassCheckins)
      .where(
        and(
          eq(classPassCheckins.studioId, input.studioId),
          eq(classPassCheckins.sessionId, input.sessionId),
          eq(classPassCheckins.providerKey, input.providerKey),
          eq(classPassCheckins.status, 'confirmed')
        )
      );

    if (count >= maxSpots) {
      throw new Error(`Maximum ${maxSpots} class pass spots already reserved for this provider`);
    }

    const [checkin] = await tx
      .insert(classPassCheckins)
      .values({
        studioId: input.studioId,
        userId: input.userId,
        sessionId: input.sessionId,
        providerKey: input.providerKey,
        status: input.status ?? 'confirmed',
        notes: input.notes,
        checkedInAt: input.status === 'confirmed' ? new Date() : undefined,
      })
      .returning();

    return checkin;
  });
}

export async function updateCheckinStatus(
  checkinId: string,
  status: 'pending' | 'confirmed' | 'reconciled' | 'rejected',
  notes?: string
) {
  const [updated] = await db
    .update(classPassCheckins)
    .set({
      status,
      notes,
      checkedInAt: status === 'confirmed' || status === 'reconciled' ? new Date() : undefined,
    })
    .where(eq(classPassCheckins.id, checkinId))
    .returning();
  return updated;
}

export async function listCheckins(filter: ReconciliationFilter) {
  const conditions = [eq(classPassCheckins.studioId, filter.studioId)];
  if (filter.providerKey) conditions.push(eq(classPassCheckins.providerKey, filter.providerKey));
  if (filter.from) conditions.push(gte(classPassCheckins.createdAt, filter.from));
  if (filter.to) conditions.push(lte(classPassCheckins.createdAt, filter.to));
  if (filter.status) conditions.push(eq(classPassCheckins.status, filter.status));

  return await db
    .select({
      checkin: classPassCheckins,
      userName: users.name,
      userEmail: users.email,
      sessionStartsAt: classSessions.startsAt,
      className: classTemplates.name,
    })
    .from(classPassCheckins)
    .leftJoin(users, eq(classPassCheckins.userId, users.id))
    .leftJoin(classSessions, eq(classPassCheckins.sessionId, classSessions.id))
    .leftJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
    .where(and(...conditions))
    .orderBy(desc(classPassCheckins.createdAt));
}

export async function getReconciliationSummary(studioId: string, from: Date, to: Date) {
  const rows = await db
    .select({
      providerKey: classPassCheckins.providerKey,
      status: classPassCheckins.status,
      count: db.$count(classPassCheckins),
    })
    .from(classPassCheckins)
    .where(
      and(
        eq(classPassCheckins.studioId, studioId),
        gte(classPassCheckins.createdAt, from),
        lte(classPassCheckins.createdAt, to)
      )
    )
    .groupBy(classPassCheckins.providerKey, classPassCheckins.status);

  const summary: Record<string, { confirmed: number; reconciled: number; pending: number; rejected: number }> = {};
  for (const row of rows) {
    const provider = summary[row.providerKey] ?? { confirmed: 0, reconciled: 0, pending: 0, rejected: 0 };
    if (row.status === 'confirmed') provider.confirmed += Number(row.count);
    if (row.status === 'reconciled') provider.reconciled += Number(row.count);
    if (row.status === 'pending') provider.pending += Number(row.count);
    if (row.status === 'rejected') provider.rejected += Number(row.count);
    summary[row.providerKey] = provider;
  }
  return summary;
}

function getMaxSpotsForProvider(
  accessProviders: { provider: string; config?: Record<string, unknown> }[],
  providerKey: string
): number {
  const provider = accessProviders.find((p) => p.provider === providerKey);
  const max = provider?.config?.maxSpotsPerClass;
  return typeof max === 'number' && max > 0 ? max : 2;
}
