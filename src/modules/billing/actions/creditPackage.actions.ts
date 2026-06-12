'use server';

import { z } from 'zod';
import { db } from '@/db';
import { creditPackages } from '@/db/schema';
import type { CreditPackage } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import type { ServiceResult } from '@/modules/billing/services/credit.service';
import { getCreditTypeValues } from '@/lib/config/class-types';
import { auditHelpers } from '@/lib/security/audit-system';
import { getCreditPackCategoryValues } from '@/lib/config/financial-config';
import { requireStudioId } from '@/lib/studio/studio-context';

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'admin') return null;
  return session;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name:          z.string().min(1, 'Name is required').max(255),
  description:   z.string().max(1000).optional().nullable(),
  creditsAmount: z.number().int().positive('Credits must be positive'),
  creditType:    z.enum(getCreditTypeValues()),
  category:      z.enum(getCreditPackCategoryValues()).default('credit'),
  priceCents:    z.number().int().min(0, 'Price must be 0 or more'),
  currency:      z.string().length(3).optional().default('eur'),
  validityDays:  z.number().int().positive('Validity must be positive').optional().default(365),
  validityWeeks: z.number().int().positive('Validity weeks must be positive').optional().default(52),
  sortOrder:     z.number().int().min(0).optional().default(0),
  isActive:      z.boolean().optional().default(true),
  stripePriceId: z.string().max(255).optional().nullable(),
});

const updateSchema = z.object({
  id:            z.string().uuid(),
  name:          z.string().min(1).max(255).optional(),
  description:   z.string().max(1000).optional().nullable(),
  creditsAmount: z.number().int().positive().optional(),
  creditType:    z.enum(getCreditTypeValues()).optional(),
  category:      z.enum(getCreditPackCategoryValues()).optional(),
  priceCents:    z.number().int().min(0).optional(),
  currency:      z.string().length(3).optional(),
  validityDays:  z.number().int().positive().optional(),
  validityWeeks: z.number().int().positive().optional(),
  sortOrder:     z.number().int().min(0).optional(),
  isActive:      z.boolean().optional(),
  stripePriceId: z.string().max(255).optional().nullable(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getCreditPackagesAction(): Promise<ServiceResult<CreditPackage[]>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  try {
    const studioId = await requireStudioId();
    const rows = await db
      .select()
      .from(creditPackages)
      .where(eq(creditPackages.studioId, studioId))
      .orderBy(asc(creditPackages.sortOrder));

    return { success: true, data: rows };
  } catch {
    return { success: false, error: 'Failed to fetch credit packages.', code: 'DB_ERROR' };
  }
}

export async function createCreditPackageAction(
  input: z.infer<typeof createSchema>,
): Promise<ServiceResult<CreditPackage>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.', code: 'INVALID_STATE' };
  }

  try {
    const studioId = await requireStudioId();
    const [pkg] = await db.insert(creditPackages).values({ ...parsed.data, studioId }).returning();
    
    // Log admin action
    await auditHelpers.logAdminAction(
      session.user.id,
      'create_credit_package',
      'credit_package',
      pkg.id,
      {
        name: parsed.data.name,
        creditsAmount: parsed.data.creditsAmount,
        creditType: parsed.data.creditType,
        priceCents: parsed.data.priceCents,
      }
    );
    
    revalidatePath('/admin/credits');
    return { success: true, data: pkg as CreditPackage };
  } catch (error) {
    await auditHelpers.logAdminAction(
      session?.user?.id || 'unknown',
      'create_credit_package_failed',
      'credit_package',
      undefined,
      { input, error: error instanceof Error ? error.message : 'Unknown error' },
      false
    );
    return { success: false, error: 'Failed to create credit package.', code: 'DB_ERROR' };
  }
}

export async function deleteCreditPackageAction(
  input: { id: string },
): Promise<ServiceResult<null>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid ID.', code: 'INVALID_STATE' };

  try {
    const studioId = await requireStudioId();
    const deleted = await db
      .delete(creditPackages)
      .where(and(eq(creditPackages.id, parsed.data.id), eq(creditPackages.studioId, studioId)))
      .returning({ id: creditPackages.id });

    if (deleted.length === 0) {
      await auditHelpers.logAdminAction(
        session.user.id,
        'delete_credit_package_failed',
        'credit_package',
        parsed.data.id,
        { reason: 'Package not found' },
        false
      );
      return { success: false, error: 'Package not found.', code: 'NOT_FOUND' };
    }

    // Log successful deletion
    await auditHelpers.logAdminAction(
      session.user.id,
      'delete_credit_package',
      'credit_package',
      parsed.data.id
    );

    revalidatePath('/admin/credits');
    return { success: true, data: null };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23503') {
      await auditHelpers.logAdminAction(
        session.user.id,
        'delete_credit_package_failed',
        'credit_package',
        parsed.data.id,
        { reason: 'Foreign key constraint violation - package has purchases' },
        false
      );
      return { success: false, error: 'Cannot delete — students have purchased this package. Deactivate it instead.', code: 'INVALID_STATE' };
    }
    
    await auditHelpers.logAdminAction(
      session?.user?.id || 'unknown',
      'delete_credit_package_failed',
      'credit_package',
      parsed.data.id,
      { error: err instanceof Error ? err.message : 'Unknown error' },
      false
    );
    return { success: false, error: 'Failed to delete package.', code: 'DB_ERROR' };
  }
}

export async function updateCreditPackageAction(
  input: z.infer<typeof updateSchema>,
): Promise<ServiceResult<CreditPackage>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.', code: 'INVALID_STATE' };
  }

  const { id, ...fields } = parsed.data;

  try {
    const studioId = await requireStudioId();
    const [pkg] = await db
      .update(creditPackages)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(creditPackages.id, id), eq(creditPackages.studioId, studioId)))
      .returning();

    if (!pkg) {
      await auditHelpers.logAdminAction(
        session.user.id,
        'update_credit_package_failed',
        'credit_package',
        id,
        { reason: 'Package not found', fields },
        false
      );
      return { success: false, error: 'Package not found.', code: 'NOT_FOUND' };
    }

    // Log successful update
    await auditHelpers.logAdminAction(
      session.user.id,
      'update_credit_package',
      'credit_package',
      id,
      { fields, updatedPackage: pkg }
    );

    revalidatePath('/admin/credits');
    return { success: true, data: pkg as CreditPackage };
  } catch (error) {
    await auditHelpers.logAdminAction(
      session?.user?.id || 'unknown',
      'update_credit_package_failed',
      'credit_package',
      id,
      { fields, error: error instanceof Error ? error.message : 'Unknown error' },
      false
    );
    return { success: false, error: 'Failed to update package.', code: 'DB_ERROR' };
  }
}

export async function reorderCreditPackagesAction(
  input: z.infer<typeof reorderSchema>,
): Promise<ServiceResult<null>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.', code: 'INVALID_STATE' };
  }

  try {
    const studioId = await requireStudioId();
    await db.transaction(async (tx) => {
      for (let i = 0; i < parsed.data.orderedIds.length; i++) {
        await tx
          .update(creditPackages)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(eq(creditPackages.id, parsed.data.orderedIds[i]), eq(creditPackages.studioId, studioId)));
      }
    });

    revalidatePath('/admin/credits');
    return { success: true, data: null };
  } catch {
    return { success: false, error: 'Failed to reorder packages.', code: 'DB_ERROR' };
  }
}
