'use server';

import { z } from 'zod';
import { db } from '@/db';
import { instructors, users, studioMemberships } from '@/db/schema';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import type { ServiceResult } from '@/modules/billing/services/credit.service';
import { requireStudioId } from '@/lib/studio/studio-context';
import bcrypt from 'bcryptjs';

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'admin') return null;
  return session;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type InstructorRow = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  phone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Valid email is required').max(255),
  phone: z.string().max(50).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  avatarUrl: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  createAccount: z.boolean().optional().default(false),
  password: z.string().min(8).max(255).optional().nullable(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  avatarUrl: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getInstructorsAction(): Promise<ServiceResult<InstructorRow[]>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  try {
    const studioId = await requireStudioId();
    const rows = await db
      .select({
        id: instructors.id,
        userId: instructors.userId,
        name: users.name,
        email: users.email,
        phone: users.phone,
        bio: instructors.bio,
        avatarUrl: instructors.avatarUrl,
        isActive: instructors.isActive,
        createdAt: instructors.createdAt,
      })
      .from(instructors)
      .innerJoin(users, and(eq(instructors.userId, users.id), isNull(users.deletedAt)))
      .where(eq(instructors.studioId, studioId))
      .orderBy(asc(users.name));

    return { success: true, data: rows };
  } catch {
    return { success: false, error: 'Failed to fetch instructors.', code: 'DB_ERROR' };
  }
}

export async function createInstructorAction(
  input: z.infer<typeof createSchema>,
): Promise<ServiceResult<InstructorRow>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
      code: 'INVALID_STATE',
    };
  }

  try {
    const studioId = await requireStudioId();
    const { name, email, phone, bio, avatarUrl, isActive, createAccount, password } = parsed.data;

    // Email must be unique globally (users are shared across studios).
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email.toLowerCase()), isNull(users.deletedAt)))
      .limit(1);

    if (existingUser) {
      return { success: false, error: 'An account with this email already exists. Invite them via Members instead.', code: 'INVALID_STATE' };
    }

    const result = await db.transaction(async (tx) => {
      // Create the underlying user account. Instructors log in with role 'instructor'.
      const passwordHash = createAccount && password
        ? await bcrypt.hash(password, 10)
        : null;

      const [user] = await tx
        .insert(users)
        .values({
          name,
          email: email.toLowerCase(),
          phone: phone ?? null,
          role: 'instructor',
          studioId,
          passwordHash,
          emailVerified: createAccount ? new Date() : null,
          avatarUrl: avatarUrl ?? null,
        })
        .returning();

      const [instructor] = await tx
        .insert(instructors)
        .values({
          studioId,
          userId: user.id,
          bio: bio ?? null,
          avatarUrl: avatarUrl ?? null,
          isActive,
        })
        .returning();

      await tx.insert(studioMemberships).values({
        userId: user.id,
        studioId,
        role: 'instructor',
        status: 'active',
        invitedByUserId: null,
        joinedAt: new Date(),
      });

      return { user, instructor };
    });

    revalidatePath('/admin/instructors');
    return {
      success: true,
      data: {
        id: result.instructor.id,
        userId: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        bio: result.instructor.bio,
        avatarUrl: result.instructor.avatarUrl,
        isActive: result.instructor.isActive,
        createdAt: result.instructor.createdAt,
      },
    };
  } catch {
    return { success: false, error: 'Failed to create instructor.', code: 'DB_ERROR' };
  }
}

export async function updateInstructorAction(
  input: z.infer<typeof updateSchema>,
): Promise<ServiceResult<InstructorRow>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
      code: 'INVALID_STATE',
    };
  }

  try {
    const studioId = await requireStudioId();
    const { id, ...fields } = parsed.data;

    const [existing] = await db
      .select({ userId: instructors.userId })
      .from(instructors)
      .where(and(eq(instructors.id, id), eq(instructors.studioId, studioId)))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Instructor not found.', code: 'NOT_FOUND' };
    }

    // If email is changing, ensure it doesn't collide with another user in the studio.
    if (fields.email) {
      const [duplicate] = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.email, fields.email.toLowerCase()),
            eq(users.studioId, studioId),
            isNull(users.deletedAt),
          ),
        )
        .limit(1);

      if (duplicate && duplicate.id !== existing.userId) {
        return { success: false, error: 'An account with this email already exists.', code: 'INVALID_STATE' };
      }
      fields.email = fields.email.toLowerCase();
    }

    const { name, email, phone, bio, avatarUrl, isActive } = fields;

    const result = await db.transaction(async (tx) => {
      const userUpdates: { name?: string; email?: string; phone?: string | null; avatarUrl?: string | null } = {};
      if (name !== undefined) userUpdates.name = name;
      if (email !== undefined) userUpdates.email = email;
      if (phone !== undefined) userUpdates.phone = phone;
      if (avatarUrl !== undefined) userUpdates.avatarUrl = avatarUrl;

      if (Object.keys(userUpdates).length > 0) {
        await tx
          .update(users)
          .set({ ...userUpdates, updatedAt: new Date() })
          .where(eq(users.id, existing.userId));
      }

      const instructorUpdates: { bio?: string | null; avatarUrl?: string | null; isActive?: boolean } = {};
      if (bio !== undefined) instructorUpdates.bio = bio;
      if (avatarUrl !== undefined) instructorUpdates.avatarUrl = avatarUrl;
      if (isActive !== undefined) instructorUpdates.isActive = isActive;

      const [updated] = await tx
        .update(instructors)
        .set({ ...instructorUpdates, updatedAt: new Date() })
        .where(and(eq(instructors.id, id), eq(instructors.studioId, studioId)))
        .returning();

      return updated;
    });

    revalidatePath('/admin/instructors');

    const [user] = await db
      .select({ name: users.name, email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.id, existing.userId))
      .limit(1);

    return {
      success: true,
      data: {
        id: result.id,
        userId: existing.userId,
        name: user?.name ?? null,
        email: user?.email ?? '',
        phone: user?.phone ?? null,
        bio: result.bio,
        avatarUrl: result.avatarUrl,
        isActive: result.isActive,
        createdAt: result.createdAt,
      },
    };
  } catch {
    return { success: false, error: 'Failed to update instructor.', code: 'DB_ERROR' };
  }
}

export async function deleteInstructorAction(
  input: z.infer<typeof deleteSchema>,
): Promise<ServiceResult<null>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid ID.', code: 'INVALID_STATE' };

  try {
    const studioId = await requireStudioId();
    const [existing] = await db
      .select({ userId: instructors.userId })
      .from(instructors)
      .where(and(eq(instructors.id, parsed.data.id), eq(instructors.studioId, studioId)))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Instructor not found.', code: 'NOT_FOUND' };
    }

    // Soft-delete the user instead of hard-deleting because the instructor may have
    // financial/operational history (classes, bookings, etc.).
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, existing.userId));

      await tx
        .update(instructors)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(instructors.id, parsed.data.id), eq(instructors.studioId, studioId)));

      await tx
        .update(studioMemberships)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(studioMemberships.userId, existing.userId), eq(studioMemberships.studioId, studioId)));
    });

    revalidatePath('/admin/instructors');
    return { success: true, data: null };
  } catch {
    return { success: false, error: 'Failed to delete instructor.', code: 'DB_ERROR' };
  }
}
