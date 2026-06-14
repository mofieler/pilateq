'use server';

import { db } from '@/db';
import { studios, studioSettings, users, instructors, classTemplates, classSessions, creditPackages } from '@/db/schema';
import { parseStudioConfig, type StudioConfig, DEFAULT_STUDIO_CONFIG } from '@/lib/studio';
import { auth, unstable_update } from '@/lib/auth/auth';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { getCreditTypeForClassType, CLASS_TYPES } from '@/lib/config/class-types';
import type { ClassType, CreditType } from '@/lib/config/class-types';

export interface OnboardingStepInput {
  identity?: StudioConfig['identity'];
  branding?: StudioConfig['branding'];
  timezone?: string;
  defaultLocale?: string;
  supportedLocales?: string[];
  enabledBusinessModels?: StudioConfig['enabledBusinessModels'];
  paymentProviders?: StudioConfig['paymentProviders'];
  accessProviders?: StudioConfig['accessProviders'];
  classTypes?: StudioConfig['classTypes'];
  creditTypes?: StudioConfig['creditTypes'];
  bookingRules?: StudioConfig['bookingRules'];
  financial?: StudioConfig['financial'];
  features?: StudioConfig['features'];
  notifications?: StudioConfig['notifications'];
}

export type OnboardingStep = keyof OnboardingStepInput;

async function requireOnboardingUser(): Promise<{ userId: string; email: string }> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    throw new Error('Unauthorized');
  }
  return { userId: session.user.id, email: session.user.email };
}

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function sampleSessionTime(timezone: string): Date {
  const tomorrow = addDays(new Date(), 1);
  const ymd = formatInTimeZone(tomorrow, timezone, 'yyyy-MM-dd');
  return fromZonedTime(`${ymd}T10:00:00`, timezone);
}

function pickDefaultGroupClassType(config: StudioConfig): ClassType {
  const enabled = Object.entries(config.classTypes)
    .filter(([, value]) => value?.enabled)
    .map(([key]) => key as ClassType);

  for (const type of ['reformer_group', 'mat_group', 'chair', 'online', 'yoga', 'sound_healing'] as ClassType[]) {
    if (enabled.includes(type)) return type;
  }
  return 'mat_group';
}

/**
 * Create or update the studio during onboarding.
 * In SaaS mode this is called by the first admin or by a self-service signup.
 *
 * The calling user must be authenticated. If no studio exists for the given slug,
 * a new studio row is created and the user is pre-assigned to it.
 */
export async function saveOnboardingStepAction(
  slug: string,
  step: OnboardingStep,
  data: OnboardingStepInput[OnboardingStep]
) {
  const { userId } = await requireOnboardingUser();

  const cleanSlug = sanitizeSlug(slug);
  if (!cleanSlug) {
    throw new Error('Invalid studio slug');
  }

  const existing = await db.select().from(studios).where(eq(studios.slug, cleanSlug)).limit(1);
  let studioId: string;

  if (existing.length === 0) {
    const [created] = await db
      .insert(studios)
      .values({
        slug: cleanSlug,
        name: typeof data === 'object' && data && 'name' in data ? (data as { name: string }).name : cleanSlug,
        status: 'onboarding',
        timezone: DEFAULT_STUDIO_CONFIG.timezone,
        defaultLocale: DEFAULT_STUDIO_CONFIG.defaultLocale,
        createdByUserId: userId,
      })
      .returning();
    studioId = created.id;

    await db.insert(studioSettings).values({
      studioId,
      configJson: DEFAULT_STUDIO_CONFIG as unknown as Record<string, unknown>,
    });

    // Pre-assign the onboarding user to this studio so subsequent calls have a tenant.
    await db.update(users).set({ studioId }).where(eq(users.id, userId));
  } else {
    studioId = existing[0].id;
  }

  const [settingsRow] = await db
    .select()
    .from(studioSettings)
    .where(eq(studioSettings.studioId, studioId))
    .limit(1);

  const currentConfig = (settingsRow?.configJson as Record<string, unknown>) ?? {};

  // Merge incoming changes.
  const mergedConfig: Record<string, unknown> = { ...currentConfig, [step]: data };

  // Sync top-level studio fields when identity changes.
  if (step === 'identity' && data && typeof data === 'object') {
    const identity = data as StudioConfig['identity'];
    await db
      .update(studios)
      .set({
        name: identity.name,
        slug: sanitizeSlug(identity.slug),
      })
      .where(eq(studios.id, studioId));
  }

  // Validate before saving.
  const validated = parseStudioConfig(mergedConfig);

  await db.transaction(async (tx) => {
    await tx
      .update(studioSettings)
      .set({ configJson: validated as unknown as Record<string, unknown> })
      .where(eq(studioSettings.studioId, studioId));

    // Persist the user's progress so they can resume onboarding after a logout.
    await tx
      .update(users)
      .set({ onboardingStep: step })
      .where(eq(users.id, userId));
  });

  revalidatePath('/onboarding');
  revalidatePath('/');
  return { success: true, studioId };
}

/**
 * Load the current onboarding state for the authenticated user.
 * Returns the studio config if the user is already attached to a studio,
 * otherwise falls back to the default config.
 */
export async function loadOnboardingStateAction(): Promise<
  | { success: true; config: StudioConfig; studioId?: string; onboardingStep?: string }
  | { success: false; error: string }
> {
  try {
    const { userId } = await requireOnboardingUser();

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user?.studioId) {
      const [settingsRow] = await db
        .select()
        .from(studioSettings)
        .where(eq(studioSettings.studioId, user.studioId))
        .limit(1);

      const configJson = (settingsRow?.configJson as Record<string, unknown>) ?? {};
      const config = parseStudioConfig(configJson);
      return {
        success: true,
        config,
        studioId: user.studioId,
        onboardingStep: user.onboardingStep ?? config.onboardingState.currentStep ?? 'welcome',
      };
    }

    return { success: true, config: DEFAULT_STUDIO_CONFIG, onboardingStep: 'welcome' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load onboarding state' };
  }
}

/**
 * Mark onboarding as complete and activate the studio.
 * The authenticated user becomes the studio admin.
 */
export async function completeOnboardingAction(slug: string, seedDefaults = false) {
  const { userId } = await requireOnboardingUser();
  const cleanSlug = sanitizeSlug(slug);

  const [studio] = await db.select().from(studios).where(eq(studios.slug, cleanSlug)).limit(1);
  if (!studio) {
    throw new Error('Studio not found');
  }

  // Only the user who created the studio row may complete onboarding and
  // become its admin. This blocks an arbitrary authenticated user from
  // escalating to admin by guessing/completing another studio's onboarding.
  if (studio.createdByUserId !== userId) {
    throw new Error('Unauthorized');
  }

  const [settingsRow] = await db
    .select()
    .from(studioSettings)
    .where(eq(studioSettings.studioId, studio.id))
    .limit(1);

  const config = parseStudioConfig((settingsRow?.configJson as Record<string, unknown>) ?? {});

  await db.transaction(async (tx) => {
    await tx.update(studios).set({ status: 'active' }).where(eq(studios.id, studio.id));

    await tx
      .update(users)
      .set({
        studioId: studio.id,
        role: 'admin',
        onboardingStep: 'review',
        onboardingCompletedAt: new Date(),
      })
      .where(eq(users.id, userId));

    if (seedDefaults) {
      // 1. Default instructor linked to the admin user
      const [adminUser] = await tx
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const [instructor] = await tx
        .insert(instructors)
        .values({
          studioId: studio.id,
          userId,
          bio: `${adminUser?.name ?? 'Studio'} instructor`,
          isActive: true,
        })
        .returning();

      const classType = pickDefaultGroupClassType(config);
      const classTypeConfig = CLASS_TYPES[classType];

      // 2. Default group class template
      const [groupTemplate] = await tx
        .insert(classTemplates)
        .values({
          studioId: studio.id,
          name: `${classTypeConfig.label} Class`,
          classType,
          durationMinutes: classTypeConfig.defaultDuration,
          maxCapacity: classTypeConfig.defaultCapacity,
          creditCost: 1,
          creditType: getCreditTypeForClassType(classType) as CreditType,
          instructorId: instructor.id,
          isActive: true,
        })
        .returning();

      // 3. Welcome Journey template if feature is enabled
      if (config.features.welcomeJourney) {
        await tx.insert(classTemplates).values({
          studioId: studio.id,
          name: 'Welcome Journey',
          classType: 'reformer_private',
          durationMinutes: 60,
          maxCapacity: 1,
          creditCost: 5,
          creditType: 'session',
          instructorId: instructor.id,
          isWelcomeJourney: true,
          isActive: true,
        });
      }

      // 4. Starter credit packages
      await tx.insert(creditPackages).values([
        {
          studioId: studio.id,
          name: 'Single Class',
          description: 'One drop-in group class credit.',
          creditsAmount: 1,
          creditType: 'pass',
          category: 'credit',
          priceCents: 2500,
          currency: 'eur',
          validityDays: 365,
          isActive: true,
          sortOrder: 1,
        },
        {
          studioId: studio.id,
          name: '5-Class Pack',
          description: 'Five group class credits at a discounted rate.',
          creditsAmount: 5,
          creditType: 'pass',
          category: 'credit',
          priceCents: 11000,
          currency: 'eur',
          validityDays: 365,
          isActive: true,
          sortOrder: 2,
        },
      ]);

      // 5. Sample session within the next 7 days from the default template
      const startsAt = sampleSessionTime(config.timezone);
      const endsAt = new Date(startsAt.getTime() + groupTemplate.durationMinutes * 60_000);

      await tx.insert(classSessions).values({
        studioId: studio.id,
        templateId: groupTemplate.id,
        instructorId: instructor.id,
        startsAt,
        endsAt,
        maxCapacity: groupTemplate.maxCapacity,
        bookedCount: 0,
        waitlistCount: 0,
        status: 'scheduled',
      });
    }
  });

  // Try to refresh the session so the client sees the latest role/studio state
  // without requiring a fresh sign-in.
  try {
    if (typeof unstable_update === 'function') {
      await unstable_update({
        user: {
          role: 'admin',
          onboardingCompletedAt: new Date().toISOString(),
          studioStatus: 'active',
        },
      } as any);
    } else {
      return { success: true, reauthRequired: true };
    }
  } catch (error) {
    console.warn('[COMPLETE_ONBOARDING] unstable_update failed, requesting reauth:', error);
    return { success: true, reauthRequired: true };
  }

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true };
}
