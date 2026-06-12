'use server';

import { auth } from '@/lib/auth/auth';
import {
  createClassPassCheckin,
  updateCheckinStatus,
  listCheckins,
  getReconciliationSummary,
  type CreateCheckinInput,
  type ReconciliationFilter,
} from '../services/classPass.service';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
  if (session.user.role !== 'admin') throw new Error('Forbidden');
  if (!session.user.studioId) throw new Error('Studio not assigned');
  return session.user;
}

export async function createClassPassCheckinAction(input: Omit<CreateCheckinInput, 'studioId'>) {
  const user = await requireAdmin();
  return createClassPassCheckin({ ...input, studioId: user.studioId! });
}

export async function updateClassPassCheckinStatusAction(
  checkinId: string,
  status: 'pending' | 'confirmed' | 'reconciled' | 'rejected',
  notes?: string
) {
  await requireAdmin();
  return updateCheckinStatus(checkinId, status, notes);
}

export async function listClassPassCheckinsAction(filter: Omit<ReconciliationFilter, 'studioId'>) {
  const user = await requireAdmin();
  return listCheckins({ ...filter, studioId: user.studioId! });
}

export async function getClassPassReconciliationSummaryAction(from: Date, to: Date) {
  const user = await requireAdmin();
  return getReconciliationSummary(user.studioId!, from, to);
}
