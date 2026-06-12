'use server';

import { z } from 'zod';
import { db } from '@/db';
import {
  membershipPlans,
  userMemberships,
  users,
  creditPurchases,
  creditPackages,
} from '@/db/schema';
import type { CreditType } from '@/db/schema';
import { eq, and, isNull, desc, asc } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { addDays } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { getCreditTypeValues } from '@/lib/config/class-types';
import { FINANCIAL_CONFIG, CREDIT_PACK_CATEGORIES } from '@/lib/config/financial-config';
import { generateInvoicePDF, InvoiceIdentityIncompleteError } from '@/lib/invoice/invoice.generator';
import { getStudioConfig } from '@/lib/studio/server';
import { sendMembershipPurchaseEmail, sendManualMembershipAssignmentEmail } from '@/lib/email/membership.emails';
import { creditService } from '@/modules/billing/services/credit.service';
import {
  generateInvoiceNumber,
  getInvoicePrefix,
} from '@/modules/billing/services/invoiceNumber.service';
import { requireStudioId } from '@/lib/studio/studio-context';
import { verifyMembershipPlanStudio, verifyUserStudio } from '@/lib/security/tenant-guard';
import { getLogger } from '@/lib/logger';
import { checkRateLimit, membershipSubscribeRateLimitConfig } from '@/lib/security/server-action-rate-limiter';


// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string; name: string | null } | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') return null;
  return { userId: session.user.id, name: session.user.name ?? null };
}

// ─── Invoice number helper ────────────────────────────────────────────────────

async function nextInvoiceNumber(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  studioId: string,
): Promise<string> {
  const { getStudioConfig } = await import('@/lib/studio/server');
  const studioConfig = await getStudioConfig();
  const prefix = getInvoicePrefix(studioConfig);
  return generateInvoiceNumber(tx, studioId, prefix);
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const planCreateSchema = z.object({
  name:          z.string().min(1, 'Name is required').max(255),
  description:   z.string().max(1000).optional().nullable(),
  creditType:    z.enum(getCreditTypeValues()),
  sessionSubtype: z.enum(['private', 'duo']).optional().nullable(),
  weeklyCredits: z.number().int().positive('Weekly credits must be positive'),
  durationWeeks: z.number().int().positive('Duration must be positive'),
  priceCents:    z.number().int().min(0, 'Price must be 0 or more'),
  currency:      z.string().length(3).default('eur'),
  isActive:      z.boolean().default(true),
  sortOrder:     z.number().int().min(0).default(0),
});

const planUpdateSchema = planCreateSchema.partial().extend({ id: z.string().uuid() });

const assignSchema = z.object({
  userId:    z.string().uuid(),
  planId:    z.string().uuid(),
  startedAt: z.coerce.date(),
});

// ─── Plan CRUD ────────────────────────────────────────────────────────────────

export type MembershipPlanRow = Awaited<ReturnType<typeof getMembershipPlansAction>>['data'][number];

export async function getMembershipPlansAction() {
  const admin = await requireAdmin();
  if (!admin) return { success: false as const, error: 'Unauthorized', data: [] as never[] };

  try {
    const studioId = await requireStudioId();
    const plans = await db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.studioId, studioId))
      .orderBy(asc(membershipPlans.sortOrder), asc(membershipPlans.name));
    return { success: true as const, data: plans };
  } catch {
    return { success: false as const, error: 'Failed to fetch plans', data: [] as never[] };
  }
}

export async function createMembershipPlanAction(input: z.infer<typeof planCreateSchema>) {
  const admin = await requireAdmin();
  if (!admin) return { success: false as const, error: 'Unauthorized' };

  const parsed = planCreateSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  try {
    const studioId = await requireStudioId();
    const [plan] = await db.insert(membershipPlans).values({ ...parsed.data, studioId }).returning();
    revalidatePath('/admin/memberships');
    return { success: true as const, data: plan };
  } catch {
    return { success: false as const, error: 'Failed to create plan' };
  }
}

export async function updateMembershipPlanAction(input: z.infer<typeof planUpdateSchema>) {
  const admin = await requireAdmin();
  if (!admin) return { success: false as const, error: 'Unauthorized' };

  const parsed = planUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { id, ...fields } = parsed.data;

  try {
    const studioId = await requireStudioId();
    const [plan] = await db
      .update(membershipPlans)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(membershipPlans.id, id), eq(membershipPlans.studioId, studioId)))
      .returning();
    if (!plan) return { success: false as const, error: 'Plan not found' };
    revalidatePath('/admin/memberships');
    return { success: true as const, data: plan };
  } catch {
    return { success: false as const, error: 'Failed to update plan' };
  }
}

export async function deleteMembershipPlanAction(input: { id: string }) {
  const admin = await requireAdmin();
  if (!admin) return { success: false as const, error: 'Unauthorized' };

  try {
    const studioId = await requireStudioId();

    // Verify the plan belongs to the current studio before checking history.
    const planBelongs = await verifyMembershipPlanStudio(input.id, studioId);
    if (!planBelongs) return { success: false as const, error: 'Plan not found' };

    // Block deletion if ANY membership rows reference this plan (active or historical).
    // userMemberships are financial records — destroying them would erase the audit
    // trail of who had which plan and when. The FK onDelete: 'restrict' also enforces
    // this at the DB level. Use deactivation (isActive = false) to retire a plan.
    const [anyMembership] = await db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(eq(userMemberships.planId, input.id))
      .limit(1);

    if (anyMembership) {
      return {
        success: false as const,
        error: 'Cannot delete — this plan has membership history. Deactivate it instead.',
      };
    }

    const deleted = await db
      .delete(membershipPlans)
      .where(and(eq(membershipPlans.id, input.id), eq(membershipPlans.studioId, studioId)))
      .returning({ id: membershipPlans.id });
    if (deleted.length === 0) return { success: false as const, error: 'Plan not found' };

    revalidatePath('/admin/memberships');
    return { success: true as const, data: null };
  } catch {
    return { success: false as const, error: 'Failed to delete plan' };
  }
}

// ─── User memberships ─────────────────────────────────────────────────────────

export type ActiveMembershipRow = Awaited<ReturnType<typeof getActiveMembershipsAction>>['data'][number];

export async function getActiveMembershipsAction() {
  const admin = await requireAdmin();
  if (!admin) return { success: false as const, error: 'Unauthorized', data: [] as never[] };

  try {
    const studioId = await requireStudioId();
    const rows = await db
      .select({
        id:                 userMemberships.id,
        userId:             userMemberships.userId,
        userName:           users.name,
        userEmail:          users.email,
        planId:             userMemberships.planId,
        planName:           membershipPlans.name,
        creditType:         userMemberships.creditType,
        sessionSubtype:     userMemberships.sessionSubtype,
        weeklyCredits:      userMemberships.weeklyCredits,
        status:             userMemberships.status,
        startedAt:          userMemberships.startedAt,
        endsAt:             userMemberships.endsAt,
        lastCreditGrantAt:  userMemberships.lastCreditGrantAt,
        nextCreditGrantAt:  userMemberships.nextCreditGrantAt,
        createdAt:          userMemberships.createdAt,
      })
      .from(userMemberships)
      .innerJoin(users, and(eq(userMemberships.userId, users.id), isNull(users.deletedAt)))
      .innerJoin(membershipPlans, eq(userMemberships.planId, membershipPlans.id))
      .where(eq(userMemberships.studioId, studioId))
      .orderBy(desc(userMemberships.createdAt));

    return { success: true as const, data: rows };
  } catch {
    return { success: false as const, error: 'Failed to fetch memberships', data: [] as never[] };
  }
}

export async function getStudentsListAction() {
  const admin = await requireAdmin();
  if (!admin) return { success: false as const, error: 'Unauthorized', data: [] as never[] };

  try {
    const studioId = await requireStudioId();
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.studioId, studioId), eq(users.role, 'student'), isNull(users.deletedAt)))
      .orderBy(asc(users.name));
    return { success: true as const, data: rows };
  } catch {
    return { success: false as const, error: 'Failed to fetch students', data: [] as never[] };
  }
}

export async function assignMembershipAction(input: z.infer<typeof assignSchema>) {
  const admin = await requireAdmin();
  if (!admin) return { success: false as const, error: 'Unauthorized' };

  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { userId, planId, startedAt } = parsed.data;

  try {
    const studioId = await requireStudioId();

    const [plan] = await db.select().from(membershipPlans).where(and(eq(membershipPlans.id, planId), eq(membershipPlans.studioId, studioId))).limit(1);
    if (!plan) return { success: false as const, error: 'Plan not found' };
    if (!plan.isActive) return { success: false as const, error: 'Plan is inactive' };

    const [existing] = await db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(and(eq(userMemberships.studioId, studioId), eq(userMemberships.userId, userId), eq(userMemberships.status, 'active')))
      .limit(1);

    if (existing) return { success: false as const, error: 'Student already has an active membership' };

    const [userRow] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.studioId, studioId), isNull(users.deletedAt)))
      .limit(1);

    if (!userRow) return { success: false as const, error: 'User not found' };

    const userBelongs = await verifyUserStudio(userId, studioId);
    if (!userBelongs) return { success: false as const, error: 'User not found' };

    const endsAt  = addDays(startedAt, plan.durationWeeks * 7);
    const dueDate = addDays(startedAt, FINANCIAL_CONFIG.membershipDueDateDays);
    const now     = startedAt;

    const { membership, invoiceNumber } = await db.transaction(async (tx) => {
      const invNumber = await nextInvoiceNumber(tx, studioId);

      const [membership] = await tx.insert(userMemberships).values({
        studioId,
        userId,
        planId,
        creditType:        plan.creditType as CreditType,
        sessionSubtype:    plan.sessionSubtype as 'private' | 'duo' | null | undefined,
        weeklyCredits:     plan.weeklyCredits,
        startedAt,
        endsAt,
        status:            'active',
        lastCreditGrantAt: now,
        nextCreditGrantAt: addDays(now, FINANCIAL_CONFIG.membershipGrantIntervalDays),
      }).returning();

      // Create bill record for the dashboard / admin payments view
      await tx.insert(creditPurchases).values({
        studioId,
        userId,
        packageId:      null,
        creditsAmount:  plan.weeklyCredits * plan.durationWeeks,
        creditType:     plan.creditType as CreditType,
        priceCents:     plan.priceCents,
        currency:       plan.currency,
        paymentMethod:  'pay_at_studio',
        paymentStatus:  'pending',
        paymentDueDate: dueDate,
        invoiceNumber:  invNumber,
        invoiceIssuedAt: now,
        adminNotes:     plan.name,
      });

      // Grant first week's credits immediately. Credits expire with the membership.
      await creditService.addMembershipGrant(tx, {
        studioId,
        userId,
        creditType: plan.creditType as CreditType,
        amount: plan.weeklyCredits,
        membershipId: membership.id,
        expiresAt: endsAt,
        description: `Membership first week grant: ${plan.weeklyCredits} ${plan.creditType} credits (${invNumber})`,
      });

      return { membership, invoiceNumber: invNumber };
    });

    // Fire-and-forget: generate PDF + send membership confirmation email
    Promise.resolve().then(async () => {
      try {
        const studioConfig = await getStudioConfig();
        const pdfBuffer = await generateInvoicePDF({
          invoiceNumber,
          invoiceDate:     now,
          dueDate,
          customerId:      userId,
          customerName:    userRow.name ?? 'Customer',
          customerEmail:   userRow.email ?? '',
          customerAddress: null,
          packageName:     plan.name,
          creditsAmount:   plan.weeklyCredits * plan.durationWeeks,
          creditType:      plan.creditType,
          priceCents:      plan.priceCents,
          currency:        plan.currency,
          paymentMethod:   'pay_at_studio',
          paymentStatus:   'pending',
        }, studioConfig);

        if (userRow.email) {
          await sendMembershipPurchaseEmail(
            userRow.email,
            userRow.name ?? 'there',
            plan.name,
            plan.weeklyCredits,
            plan.creditType,
            plan.durationWeeks,
            plan.priceCents,
            plan.currency,
            now,
            endsAt,
            invoiceNumber,
            dueDate,
            pdfBuffer,
          );
        }
      } catch (err) {
        if (err instanceof InvoiceIdentityIncompleteError) {
          getLogger('membership').warn({ err }, 'Invoice not sent: studio identity incomplete');
        } else {
          getLogger('membership').warn({ err }, 'Failed to generate/send membership invoice');
        }
      }
    }).catch(() => {});

    revalidatePath('/admin/memberships');
    revalidatePath('/'); // Dashboard
    revalidatePath('/(dashboard)'); // Dashboard routes
    return { success: true as const, data: membership };
  } catch {
    return { success: false as const, error: 'Failed to assign membership' };
  }
}

const manualAssignSchema = z.object({
  userId:    z.string().uuid(),
  planId:    z.string().uuid(),
  startedAt: z.coerce.date(),
  reason:    z.string().min(3).max(500).optional(),
});

export async function assignManualMembershipAction(input: z.infer<typeof manualAssignSchema>) {
  const admin = await requireAdmin();
  if (!admin) return { success: false as const, error: 'Unauthorized' };

  const parsed = manualAssignSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { userId, planId, startedAt, reason } = parsed.data;

  try {
    const studioId = await requireStudioId();

    const [plan] = await db.select().from(membershipPlans).where(and(eq(membershipPlans.id, planId), eq(membershipPlans.studioId, studioId))).limit(1);
    if (!plan) return { success: false as const, error: 'Plan not found' };
    if (!plan.isActive) return { success: false as const, error: 'Plan is inactive' };

    const [existing] = await db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(and(eq(userMemberships.studioId, studioId), eq(userMemberships.userId, userId), eq(userMemberships.status, 'active')))
      .limit(1);

    if (existing) return { success: false as const, error: 'Student already has an active membership' };

    const endsAt = addDays(startedAt, plan.durationWeeks * 7);
    const now    = startedAt;

    const userBelongs = await verifyUserStudio(userId, studioId);
    if (!userBelongs) return { success: false as const, error: 'User not found' };

    const membership = await db.transaction(async (tx) => {
      const [membership] = await tx.insert(userMemberships).values({
        studioId,
        userId,
        planId,
        creditType:        plan.creditType as CreditType,
        sessionSubtype:    plan.sessionSubtype as 'private' | 'duo' | null | undefined,
        weeklyCredits:     plan.weeklyCredits,
        startedAt,
        endsAt,
        status:            'active',
        lastCreditGrantAt: now,
        nextCreditGrantAt: addDays(now, FINANCIAL_CONFIG.membershipGrantIntervalDays),
      }).returning();

      // Grant first week's credits immediately — no payment record, no invoice.
      // Credits expire with the membership.
      await creditService.addMembershipGrant(tx, {
        studioId,
        userId,
        creditType: plan.creditType as CreditType,
        amount: plan.weeklyCredits,
        membershipId: membership.id,
        expiresAt: endsAt,
        description: `Manual membership grant: ${plan.weeklyCredits} ${plan.creditType} credits (${reason ?? 'admin assignment'})`,
      });

      return membership;
    });

    revalidatePath('/admin/memberships');
    revalidatePath('/');
    revalidatePath('/(dashboard)');

    // Notify user via email (fire-and-forget)
    Promise.resolve().then(async () => {
      try {
        const [[userRow], [adminRow]] = await Promise.all([
          db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1),
          db.select({ name: users.name }).from(users).where(eq(users.id, admin.userId)).limit(1),
        ]);
        if (userRow?.email) {
          await sendManualMembershipAssignmentEmail(
            userRow.email,
            userRow.name ?? 'there',
            adminRow?.name ?? 'An admin',
            plan.name,
            plan.weeklyCredits,
            plan.creditType,
            plan.durationWeeks,
            startedAt,
            endsAt,
          );
        }
      } catch (err) {
        getLogger('membership').warn({ err }, 'Failed to send manual membership assignment email');
      }
    }).catch(() => {});

    return { success: true as const, data: membership };
  } catch {
    return { success: false as const, error: 'Failed to assign membership' };
  }
}

export async function cancelUserMembershipAction(input: { membershipId: string }) {
  const admin = await requireAdmin();
  if (!admin) return { success: false as const, error: 'Unauthorized' };

  try {
    const studioId = await requireStudioId();
    const [membership] = await db
      .update(userMemberships)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(userMemberships.id, input.membershipId), eq(userMemberships.studioId, studioId)))
      .returning();

    if (!membership) return { success: false as const, error: 'Membership not found' };

    revalidatePath('/admin/memberships');
    revalidatePath('/'); // Dashboard
    revalidatePath('/(dashboard)'); // Dashboard routes
    return { success: true as const, data: membership };
  } catch {
    return { success: false as const, error: 'Failed to cancel membership' };
  }
}

// ─── Public plan listing (student-facing) ────────────────────────────────────

export async function getActiveMembershipPlansAction() {
  try {
    const studioId = await requireStudioId();
    const plans = await db
      .select()
      .from(membershipPlans)
      .where(and(eq(membershipPlans.studioId, studioId), eq(membershipPlans.isActive, true)))
      .orderBy(asc(membershipPlans.sortOrder), asc(membershipPlans.name));
    return { success: true as const, data: plans };
  } catch {
    return { success: false as const, error: 'Failed to fetch plans', data: [] as never[] };
  }
}

// ─── Student self-subscribe ───────────────────────────────────────────────────

const selfSubscribeSchema = z.object({
  planId:                     z.string().uuid(),
  acceptedTerms:              z.boolean().refine((v) => v, 'You must accept the Terms & Conditions'),
  acceptedWithdrawalWaiver:   z.boolean().refine((v) => v, 'You must accept the withdrawal waiver'),
  purchaseIpAddress:          z.string().max(45).optional(),
});

export async function subscribeMembershipAction(input: z.infer<typeof selfSubscribeSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: 'Unauthorized' };

  const userId = session.user.id;

  const rateLimit = await checkRateLimit(membershipSubscribeRateLimitConfig, userId);
  if (!rateLimit.success) {
    return { success: false as const, error: 'Rate limit exceeded. Please try again later.', code: 'RATE_LIMITED' };
  }

  const parsed = selfSubscribeSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { planId, acceptedTerms, acceptedWithdrawalWaiver, purchaseIpAddress } = parsed.data;
  const now    = new Date();

  try {
    const studioId = await requireStudioId();

    const [plan] = await db.select().from(membershipPlans).where(and(eq(membershipPlans.id, planId), eq(membershipPlans.studioId, studioId))).limit(1);
    if (!plan) return { success: false as const, error: 'Plan not found' };
    if (!plan.isActive) return { success: false as const, error: 'This plan is no longer available' };

    const [existing] = await db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(and(eq(userMemberships.studioId, studioId), eq(userMemberships.userId, userId), eq(userMemberships.status, 'active')))
      .limit(1);

    if (existing) return { success: false as const, error: 'You already have an active membership' };

    const endsAt  = addDays(now, plan.durationWeeks * 7);
    const dueDate = addDays(now, FINANCIAL_CONFIG.membershipDueDateDays);

    const { membership, invoiceNumber } = await db.transaction(async (tx) => {
      const invNumber = await nextInvoiceNumber(tx, studioId);

      const [membership] = await tx.insert(userMemberships).values({
        studioId,
        userId,
        planId,
        creditType:                 plan.creditType as CreditType,
        sessionSubtype:             plan.sessionSubtype as 'private' | 'duo' | null | undefined,
        weeklyCredits:              plan.weeklyCredits,
        startedAt:                  now,
        endsAt,
        status:                     'active',
        lastCreditGrantAt:          now,
        nextCreditGrantAt:          addDays(now, FINANCIAL_CONFIG.membershipGrantIntervalDays),
        selfPurchased:              true,
        acceptedTermsAt:            acceptedTerms ? now : undefined,
        acceptedWithdrawalWaiverAt: acceptedWithdrawalWaiver ? now : undefined,
        purchaseIpAddress:          purchaseIpAddress ?? null,
      }).returning();

      // Create bill record
      await tx.insert(creditPurchases).values({
        studioId,
        userId,
        packageId:       null,
        creditsAmount:   plan.weeklyCredits * plan.durationWeeks,
        creditType:      plan.creditType as CreditType,
        priceCents:      plan.priceCents,
        currency:        plan.currency,
        paymentMethod:   'pay_at_studio',
        paymentStatus:   'pending',
        paymentDueDate:  dueDate,
        invoiceNumber:   invNumber,
        invoiceIssuedAt: now,
        adminNotes:      plan.name,
      });

      // Grant first week's credits immediately. Credits expire with the membership.
      await creditService.addMembershipGrant(tx, {
        studioId,
        userId,
        creditType: plan.creditType as CreditType,
        amount: plan.weeklyCredits,
        membershipId: membership.id,
        expiresAt: endsAt,
        description: `Membership first week grant: ${plan.weeklyCredits} ${plan.creditType} credits (${invNumber})`,
      });

      return { membership, invoiceNumber: invNumber };
    });

    // Fire-and-forget: generate PDF + send membership confirmation email
    Promise.resolve().then(async () => {
      try {
        const [userRow] = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(and(eq(users.id, userId), isNull(users.deletedAt)))
          .limit(1);

        if (!userRow?.email) return;

        const studioConfig = await getStudioConfig();
        const pdfBuffer = await generateInvoicePDF({
          invoiceNumber,
          invoiceDate:     now,
          dueDate,
          customerId:      userId,
          customerName:    userRow.name ?? 'Customer',
          customerEmail:   userRow.email,
          customerAddress: null,
          packageName:     plan.name,
          creditsAmount:   plan.weeklyCredits * plan.durationWeeks,
          creditType:      plan.creditType,
          priceCents:      plan.priceCents,
          currency:        plan.currency,
          paymentMethod:   'pay_at_studio',
          paymentStatus:   'pending',
        }, studioConfig);

        await sendMembershipPurchaseEmail(
          userRow.email,
          userRow.name ?? 'there',
          plan.name,
          plan.weeklyCredits,
          plan.creditType,
          plan.durationWeeks,
          plan.priceCents,
          plan.currency,
          now,
          endsAt,
          invoiceNumber,
          dueDate,
          pdfBuffer,
        );
      } catch (err) {
        if (err instanceof InvoiceIdentityIncompleteError) {
          getLogger('membership').warn({ err }, 'Invoice not sent: studio identity incomplete');
        } else {
          getLogger('membership').warn({ err }, 'Failed to generate/send membership invoice');
        }
      }
    }).catch(() => {});

    revalidatePath('/credits');
    revalidatePath('/');
    return { success: true as const, data: membership };
  } catch {
    return { success: false as const, error: 'Failed to subscribe. Please try again.' };
  }
}

export async function cancelMyMembershipAction() {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: 'Unauthorized' };

  const userId = session.user.id;

  try {
    const studioId = await requireStudioId();
    const [membership] = await db
      .update(userMemberships)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(
        eq(userMemberships.studioId, studioId),
        eq(userMemberships.userId, userId),
        eq(userMemberships.status, 'active')
      ))
      .returning();

    if (!membership) return { success: false as const, error: 'No active membership found' };

    revalidatePath('/credits');
    revalidatePath('/admin/memberships');
    revalidatePath('/'); // Dashboard
    revalidatePath('/(dashboard)'); // Dashboard routes
    return { success: true as const, data: membership };
  } catch {
    return { success: false as const, error: 'Failed to cancel membership. Please try again.' };
  }
}

// ─── Student-facing ───────────────────────────────────────────────────────────

export type MyMembership = NonNullable<Awaited<ReturnType<typeof getMyMembershipAction>>>;

export async function getMyMembershipAction() {
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    const studioId = session.user.studioId ?? await requireStudioId();
    const [row] = await db
      .select({
        id:                userMemberships.id,
        planName:          membershipPlans.name,
        planDescription:   membershipPlans.description,
        creditType:        userMemberships.creditType,
        sessionSubtype:    userMemberships.sessionSubtype,
        weeklyCredits:     userMemberships.weeklyCredits,
        status:            userMemberships.status,
        startedAt:         userMemberships.startedAt,
        endsAt:            userMemberships.endsAt,
        lastCreditGrantAt: userMemberships.lastCreditGrantAt,
        nextCreditGrantAt: userMemberships.nextCreditGrantAt,
      })
      .from(userMemberships)
      .innerJoin(membershipPlans, eq(userMemberships.planId, membershipPlans.id))
      .where(and(
        eq(userMemberships.studioId, studioId),
        eq(userMemberships.userId, session.user.id),
        eq(userMemberships.status, 'active'),
      ))
      .orderBy(desc(userMemberships.startedAt))
      .limit(1);

    return row ?? null;
  } catch {
    return null;
  }
}


// ─── Manual credit package grant (admin) ──────────────────────────────────────

const manualPackageGrantSchema = z.object({
  userId:        z.string().uuid(),
  packageId:     z.string().uuid().optional(),
  creditsAmount: z.number().int().positive().optional(),
  creditType:    z.enum(getCreditTypeValues()).optional(),
  validityWeeks: z.number().int().min(1).max(156).optional(),
  reason:        z.string().min(3).max(500),
});

export async function getActiveCreditPackagesAction() {
  const admin = await requireAdmin();
  if (!admin) return { success: false as const, error: 'Unauthorized', data: [] as never[] };

  try {
    const studioId = await requireStudioId();
    const packages = await db
      .select()
      .from(creditPackages)
      .where(and(eq(creditPackages.studioId, studioId), eq(creditPackages.isActive, true)))
      .orderBy(asc(creditPackages.sortOrder), asc(creditPackages.name));
    return { success: true as const, data: packages };
  } catch {
    return { success: false as const, error: 'Failed to fetch packages', data: [] as never[] };
  }
}

export type CreditPackageRow = Awaited<ReturnType<typeof getActiveCreditPackagesAction>>['data'][number];

export async function grantManualPackageAction(input: z.infer<typeof manualPackageGrantSchema>) {
  const admin = await requireAdmin();
  if (!admin) return { success: false as const, error: 'Unauthorized' };

  const parsed = manualPackageGrantSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { userId, packageId, creditsAmount, creditType, validityWeeks, reason } = parsed.data;

  try {
    const studioId = await requireStudioId();

    let amount = creditsAmount;
    let type = creditType;
    let validityDays: number | undefined;

    // If packageId provided, resolve values from the package
    if (packageId) {
      const [pkg] = await db.select().from(creditPackages).where(and(eq(creditPackages.id, packageId), eq(creditPackages.studioId, studioId))).limit(1);
      if (!pkg) return { success: false as const, error: 'Package not found' };
      if (!pkg.isActive) return { success: false as const, error: 'Package is inactive' };
      amount = pkg.creditsAmount;
      type = pkg.creditType as CreditType;
      validityDays = pkg.validityDays;
    }

    if (!amount || amount <= 0) return { success: false as const, error: 'Credits amount is required' };
    if (!type) return { success: false as const, error: 'Credit type is required' };

    // Explicit validityWeeks overrides package/default validity.
    const effectiveValidityDays = validityWeeks
      ? validityWeeks * 7
      : validityDays ?? CREDIT_PACK_CATEGORIES[type === 'session' ? 'session' : 'credit'].defaultValidityDays;
    const expiresAt = addDays(new Date(), effectiveValidityDays);

    const userBelongs = await verifyUserStudio(userId, studioId);
    if (!userBelongs) return { success: false as const, error: 'User not found' };
    const transaction = await db.transaction(async (tx) => {
      return creditService.addAdjustment(tx, {
        studioId,
        userId,
        creditType: type as CreditType,
        amount,
        adminId: admin.userId,
        expiresAt,
        description: `Manual package grant: ${amount} ${type} credits (${reason})`,
      });
    });

    const newBalance = await creditService.getBalance(studioId, userId, type as CreditType);

    revalidatePath('/admin/credits');
    revalidatePath('/');
    return { success: true as const, data: { newBalance } };
  } catch {
    return { success: false as const, error: 'Failed to grant package' };
  }
}
