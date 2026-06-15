'use server';

import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireSuperAdmin } from '@/lib/auth/action-auth';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(255)
      .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export async function changeSuperadminPasswordAction(input: unknown) {
  const ctx = await requireSuperAdmin();

  const validated = changePasswordSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const { currentPassword, newPassword } = validated.data;

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .limit(1);

  if (!user?.passwordHash) {
    return {
      success: false,
      error: 'This account is not eligible for password change.',
    };
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  const newHash = await bcrypt.hash(newPassword, 12);

  await db
    .update(users)
    .set({
      passwordHash: newHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, ctx.userId));

  return { success: true };
}
