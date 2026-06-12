'use server';

import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const schema = z.object({
  token: z.string().min(1, 'Token is required'),
  identifier: z.string().email('Invalid email'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export async function resetPasswordAction(formData: {
  token: string;
  identifier: string;
  password: string;
  confirmPassword: string;
}) {
  const validated = schema.safeParse(formData);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || 'Invalid input' };
  }

  const { token, identifier, password } = validated.data;

  try {
    const result = await db.transaction(async (tx) => {
      // Find valid reset token
      const tokenRow = await tx
        .select()
        .from(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, identifier),
            eq(verificationTokens.token, token),
            gt(verificationTokens.expires, new Date()),
          ),
        )
        .limit(1)
        .then((r) => r[0]);

      if (!tokenRow) {
        return { success: false, error: 'expired' };
      }

      // Verify user exists
      const user = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, identifier), isNull(users.deletedAt)))
        .limit(1)
        .then((r) => r[0]);

      if (!user) {
        return { success: false, error: 'expired' };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Update password and delete token atomically
      await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));

      await tx
        .delete(verificationTokens)
        .where(
          and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, token)),
        );

      return { success: true };
    });

    return result;
  } catch {
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}
