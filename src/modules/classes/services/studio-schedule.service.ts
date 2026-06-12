/**
 * Studio Schedule Collision Service
 *
 * Centralizes studio-wide scheduling constraints. The studio is small and
 * can only host one class at a time — regardless of which instructor teaches it.
 * All scheduling actions (create, reschedule, availability check) must query
 * this service before committing.
 */

import { and, gt, lt, ne, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { classSessions, classTemplates, instructors, users } from '@/db/schema';
import { STUDIO_MAX_CONCURRENT_CLASSES, STUDIO_SINGLE_CLASS_MODE } from '@/constants/BOOKING_RULES';

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudioCollision {
  /** The overlapping session that blocks the slot */
  sessionId: string;
  startsAt: Date;
  endsAt: Date;
  className: string | null;
  instructorName: string | null;
}

export interface StudioCollisionResult {
  /** True if the requested slot collides with >= STUDIO_MAX_CONCURRENT_CLASSES existing sessions */
  hasCollision: boolean;
  /** The overlapping sessions that cause the collision */
  collisions: StudioCollision[];
  /** How many additional concurrent sessions would exceed the limit */
  overCapacityBy: number;
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Check whether scheduling a new session at [startsAt, endsAt) would violate
 * the studio's concurrent-class limit.
 *
 * @param tx        — Drizzle transaction (or db singleton for non-transactional)
 * @param startsAt  — Proposed session start
 * @param endsAt    — Proposed session end
 * @param opts.excludeSessionId — Session to ignore (used during rescheduling)
 */
export async function checkStudioCollision(
  tx: TxClient | typeof db,
  {
    startsAt,
    endsAt,
    excludeSessionId,
    studioId,
  }: {
    startsAt: Date;
    endsAt: Date;
    excludeSessionId?: string;
    studioId: string;
  },
): Promise<StudioCollisionResult> {
  if (!STUDIO_SINGLE_CLASS_MODE) {
    return { hasCollision: false, collisions: [], overCapacityBy: 0 };
  }

  const overlapping = await tx
    .select({
      sessionId: classSessions.id,
      startsAt: classSessions.startsAt,
      endsAt: classSessions.endsAt,
      className: classTemplates.name,
      instructorName: users.name,
    })
    .from(classSessions)
    .leftJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
    .leftJoin(instructors, eq(classSessions.instructorId, instructors.id))
    .leftJoin(users, eq(instructors.userId, users.id))
    .where(
      and(
        eq(classSessions.studioId, studioId),
        ne(classSessions.status, 'cancelled'),
        lt(classSessions.startsAt, endsAt),
        gt(classSessions.endsAt, startsAt),
        excludeSessionId ? ne(classSessions.id, excludeSessionId) : undefined,
      ),
    );

  const overCapacityBy = Math.max(0, overlapping.length - STUDIO_MAX_CONCURRENT_CLASSES + 1);

  return {
    hasCollision: overlapping.length >= STUDIO_MAX_CONCURRENT_CLASSES,
    collisions: overlapping.map((row) => ({
      sessionId: row.sessionId,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      className: row.className,
      instructorName: row.instructorName,
    })),
    overCapacityBy,
  };
}

/**
 * Return every non-cancelled session that falls inside [from, to).
 * Used by the suggestion engine to build a "busy intervals" map.
 *
 * @param tx        — Drizzle transaction or db singleton
 * @param opts.from — Start of the search window
 * @param opts.to   — End of the search window
 * @param opts.excludeSessionId — Session to ignore
 */
export async function getStudioBusyIntervals(
  tx: TxClient | typeof db,
  {
    from,
    to,
    excludeSessionId,
    studioId,
  }: {
    from: Date;
    to: Date;
    excludeSessionId?: string;
    studioId: string;
  },
): Promise<Array<{ startsAt: Date; endsAt: Date }>> {
  if (!STUDIO_SINGLE_CLASS_MODE) {
    // In multi-class mode there is no studio-wide busy interval —
    // collisions are per-instructor only.
    return [];
  }

  const rows: Array<{ startsAt: Date; endsAt: Date }> = await tx
    .select({
      startsAt: classSessions.startsAt,
      endsAt: classSessions.endsAt,
    })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.studioId, studioId),
        ne(classSessions.status, 'cancelled'),
        lt(classSessions.startsAt, to),
        gt(classSessions.endsAt, from),
        excludeSessionId ? ne(classSessions.id, excludeSessionId) : undefined,
      ),
    );

  return rows;
}

/**
 * Check whether a single time slot is studio-wide available.
 * Convenience wrapper for simple boolean checks.
 */
export async function isStudioSlotAvailable(
  tx: TxClient | typeof db,
  startsAt: Date,
  endsAt: Date,
  studioId: string,
  excludeSessionId?: string,
): Promise<boolean> {
  const result = await checkStudioCollision(tx, { startsAt, endsAt, excludeSessionId, studioId });
  return !result.hasCollision;
}
