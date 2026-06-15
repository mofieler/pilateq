'use server';

import { auth } from '@/lib/auth/auth';
import { db } from '@/db';
import { studios } from '@/db/schema';
import { getUserMemberships } from '@/lib/studio/membership';
import { eq, inArray } from 'drizzle-orm';
import type { StudioMembershipRole } from '@/db/schema';

export type MyMembershipItem = {
  studioId: string;
  name: string;
  role: StudioMembershipRole;
};

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function getMyMembershipsAction(): Promise<ActionResult<MyMembershipItem[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  const memberships = await getUserMemberships(session.user.id);
  if (memberships.length === 0) {
    return { success: true, data: [] };
  }

  const studioIds = memberships.map((m) => m.studioId);
  const studioRows = await db
    .select({ id: studios.id, name: studios.name })
    .from(studios)
    .where(inArray(studios.id, studioIds));

  const nameById = new Map(studioRows.map((r) => [r.id, r.name]));

  const data = memberships.map((m) => ({
    studioId: m.studioId,
    name: nameById.get(m.studioId) ?? 'Unknown Studio',
    role: m.role,
  }));

  return { success: true, data };
}
