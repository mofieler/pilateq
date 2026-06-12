'use server';

import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth, unstable_update } from '@/lib/auth/auth';
import bcrypt from 'bcryptjs';

// ─── Update display name + phone ─────────────────────────────────────────────

const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .regex(/^[^\x00-\x1f<>{}|\\^`]+$/, 'Name contains invalid characters'),
  phone: z
    .string()
    .max(50)
    .regex(/^[+\d\s\-().]*$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
});

export async function updateProfileAction(input: unknown): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' };

  try {
    const { name, phone } = updateProfileSchema.parse(input);

    await db
      .update(users)
      .set({ name, phone: phone || null, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));

    // Sync name into JWT so the nav avatar reflects immediately
    await unstable_update({ name } as any);

    return { success: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.issues[0]?.message ?? 'Invalid input' };
    }
    console.error('[updateProfileAction]', err);
    return { success: false, error: 'Failed to save profile. Please try again.' };
  }
}

// ─── Change password ──────────────────────────────────────────────────────────

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(128, 'Password too long'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export async function changePasswordAction(input: unknown): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' };

  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(input);

    const user = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
      .then((rows) => rows[0]);

    if (!user?.passwordHash) {
      return { success: false, error: 'No password set. Your account uses social login.' };
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    if (currentPassword === newPassword) {
      return { success: false, error: 'New password must differ from current password.' };
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));

    return { success: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.issues[0]?.message ?? 'Invalid input' };
    }
    console.error('[changePasswordAction]', err);
    return { success: false, error: 'Failed to change password. Please try again.' };
  }
}
