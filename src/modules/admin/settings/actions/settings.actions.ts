'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { studios, studioSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { parseStudioConfig, type StudioConfig } from '@/lib/studio';
import { getStudioConfigForHostname } from '@/lib/studio/server';
import { encryptCredentials, decryptCredentials } from '@/lib/security/encryption';

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

async function requireAdminStudio(): Promise<{ userId: string; studioId: string }> {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  if (session.user.role !== 'admin') {
    throw new Error('Forbidden: admin role required');
  }
  if (!session.user.studioId) {
    throw new Error('Studio not assigned');
  }
  return { userId: session.user.id, studioId: session.user.studioId };
}

// ---------------------------------------------------------------------------
// Load settings
// ---------------------------------------------------------------------------

export interface StudioSettingsPayload {
  studio: {
    id: string;
    slug: string;
    name: string;
    status: string;
    timezone: string;
    defaultLocale: string;
  };
  config: StudioConfig;
}

/**
 * Load the current studio settings for the admin's studio.
 * Decrypts credentials so the UI can show masked or editable values.
 */
export async function loadStudioSettingsAction(): Promise<StudioSettingsPayload> {
  const { studioId } = await requireAdminStudio();

  const [studio] = await db.select().from(studios).where(eq(studios.id, studioId)).limit(1);
  if (!studio) {
    throw new Error('Studio not found');
  }

  const [settingsRow] = await db
    .select()
    .from(studioSettings)
    .where(eq(studioSettings.studioId, studioId))
    .limit(1);

  const configJson = (settingsRow?.configJson as Record<string, unknown> | undefined) ?? {};

  // Decrypt credentials for payment providers before returning to UI.
  const paymentProviders = Array.isArray(configJson.paymentProviders)
    ? configJson.paymentProviders.map((provider: Record<string, unknown>) => {
        const credentials = provider.credentials as Record<string, string> | undefined;
        if (credentials && Object.keys(credentials).length > 0) {
          try {
            return { ...provider, credentials: decryptCredentials(credentials) };
          } catch {
            // If decryption fails (e.g. key rotation), return masked values.
            return {
              ...provider,
              credentials: Object.fromEntries(Object.keys(credentials).map((k) => [k, ''])),
            };
          }
        }
        return provider;
      })
    : configJson.paymentProviders;

  const config = parseStudioConfig({
    ...configJson,
    id: studio.id,
    status: studio.status as StudioConfig['status'],
    identity: {
      ...(configJson.identity as Record<string, unknown> | undefined),
      name: studio.name,
      slug: studio.slug,
    },
    timezone: studio.timezone,
    defaultLocale: studio.defaultLocale,
    paymentProviders,
  });

  return {
    studio: {
      id: studio.id,
      slug: studio.slug,
      name: studio.name,
      status: studio.status,
      timezone: studio.timezone,
      defaultLocale: studio.defaultLocale,
    },
    config,
  };
}

// ---------------------------------------------------------------------------
// Save settings
// ---------------------------------------------------------------------------

export interface SaveSettingsInput {
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

/**
 * Save studio settings. Only admins can update.
 * Credentials are encrypted before storage.
 */
export async function saveStudioSettingsAction(input: SaveSettingsInput): Promise<{ success: true }> {
  const { studioId } = await requireAdminStudio();

  const [studio] = await db.select().from(studios).where(eq(studios.id, studioId)).limit(1);
  if (!studio) {
    throw new Error('Studio not found');
  }

  const [settingsRow] = await db
    .select()
    .from(studioSettings)
    .where(eq(studioSettings.studioId, studioId))
    .limit(1);

  const currentConfig = (settingsRow?.configJson as Record<string, unknown> | undefined) ?? {};

  // Merge incoming changes.
  const merged: Record<string, unknown> = { ...currentConfig, ...input };

  // Update top-level studio fields if provided.
  const studioUpdates: Partial<typeof studios.$inferInsert> = {};
  if (input.identity?.name) studioUpdates.name = input.identity.name;
  if (input.timezone) studioUpdates.timezone = input.timezone;
  if (input.defaultLocale) studioUpdates.defaultLocale = input.defaultLocale;

  if (Object.keys(studioUpdates).length > 0) {
    await db.update(studios).set(studioUpdates).where(eq(studios.id, studioId));
  }

  // Encrypt payment provider credentials before saving.
  // UI always sends plaintext credentials; empty values are preserved as-is.
  if (input.paymentProviders) {
    merged.paymentProviders = input.paymentProviders.map((provider) => {
      const credentials = provider.credentials ?? {};
      const encrypted = encryptCredentials(
        Object.fromEntries(
          Object.entries(credentials as Record<string, string>).filter(([, v]) => v.length > 0)
        )
      );
      return { ...provider, credentials: encrypted };
    });
  }

  // Validate the merged config against the schema.
  const validated = parseStudioConfig({
    ...merged,
    id: studio.id,
    status: studio.status as StudioConfig['status'],
    identity: {
      ...(merged.identity as Record<string, unknown> | undefined),
      name: studioUpdates.name ?? studio.name,
      slug: studio.slug,
    },
    timezone: studioUpdates.timezone ?? studio.timezone,
    defaultLocale: studioUpdates.defaultLocale ?? studio.defaultLocale,
  });

  await db
    .insert(studioSettings)
    .values({
      studioId,
      configJson: validated as unknown as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: studioSettings.studioId,
      set: { configJson: validated as unknown as Record<string, unknown> },
    });

  revalidatePath('/admin/settings');
  revalidatePath('/');
  return { success: true };
}

// ---------------------------------------------------------------------------
// Helper: resolve studio by hostname (used by onboarding / public flows)
// ---------------------------------------------------------------------------

export async function loadStudioSettingsByHostnameAction(
  hostname: string
): Promise<StudioSettingsPayload | null> {
  try {
    const ctx = await getStudioConfigForHostname(hostname);
    const studio = ctx.config;
    return {
      studio: {
        id: studio.id ?? '',
        slug: studio.identity.slug,
        name: studio.identity.name,
        status: studio.status,
        timezone: studio.timezone,
        defaultLocale: studio.defaultLocale,
      },
      config: studio,
    };
  } catch {
    return null;
  }
}
