/**
 * StudioConfig Schema
 *
 * Single source of truth for every studio-specific setting.
 * This file is intentionally the ONE place where the shape of studio
 * configuration is defined. Every UI form, admin page, and service must
 * consume values through this schema.
 *
 * Design rules:
 * - All business rules live here (or in registered plugins).
 * - No hardcoded studio names, currencies, timezones, or rules outside this config.
 * - Zod validates runtime data coming from DB, file, or environment.
 */

import { z } from 'zod';
import { CLASS_TYPES, CREDIT_TYPES } from '@/lib/config/class-types';
import { FINANCIAL_CONFIG, PAYMENT_METHODS } from '@/lib/config/financial-config';
import {
  CANCELLATION_WINDOW_HOURS,
  CANCELLATION_CUTOFF_HOURS,
  MERCY_USES_PER_MONTH,
  STUDIO_TIMEZONE,
  STUDIO_MAX_CONCURRENT_CLASSES,
  STUDIO_SINGLE_CLASS_MODE,
} from '@/constants/BOOKING_RULES';
import { STUDIO } from '@/lib/config/studio';

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

const hexColorRegex = /^#([0-9A-Fa-f]{3}){1,2}$/;

export const studioStatusEnum = z.enum(['onboarding', 'active', 'suspended', 'paused']);
export type StudioStatus = z.infer<typeof studioStatusEnum>;

export const businessModelEnum = z.enum([
  'credits',
  'session_packages',
  'memberships',
  'class_passes',
  'drop_in',
  'free',
]);
export type BusinessModel = z.infer<typeof businessModelEnum>;

export const paymentProviderEnum = z.enum([
  'stripe',
  'paypal',
  'sepa',
  'pay_at_studio',
  'bank_transfer',
  'cash',
]);
export type PaymentProvider = z.infer<typeof paymentProviderEnum>;

export const accessProviderEnum = z.enum([
  'credit_system',
  'session_package_system',
  'membership_system',
  'manual_class_pass',
  'egym_wellpass',
  'urban_sports_club',
  'classpass',
  'gympass',
  'drop_in',
  'free',
]);
export type AccessProvider = z.infer<typeof accessProviderEnum>;

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

export const studioIdentitySchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(63),
  legalName: z.string().max(120).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(120).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().length(2).default('DE'),
  phone: z.string().max(40).optional(),
  email: z.string().email(),
  website: z.string().url().optional(),
  taxNumber: z.string().max(60).optional(),
  taxAuthority: z.string().max(120).optional(),
});
export type StudioIdentityConfig = z.infer<typeof studioIdentitySchema>;

export const studioBrandingSchema = z.object({
  primaryColor: z.string().regex(hexColorRegex).default('#4e2b22'),
  logoUrl: z.string().url().optional(),
  faviconUrl: z.string().url().optional(),
  appName: z.string().max(60).default('PilatesOS'),
});
export type StudioBrandingConfig = z.infer<typeof studioBrandingSchema>;

export const studioFeaturesSchema = z.object({
  waitlist: z.boolean().default(true),
  duoBooking: z.boolean().default(true),
  welcomeJourney: z.boolean().default(true),
  memberships: z.boolean().default(true),
  embedSchedule: z.boolean().default(true),
  invoices: z.boolean().default(true),
  googleCalendarSync: z.boolean().default(false),
  manualCreditAdjustments: z.boolean().default(true),
  promoCodes: z.boolean().default(false),
});
export type StudioFeaturesConfig = z.infer<typeof studioFeaturesSchema>;

export const studioClassTypeOverrideSchema = z.object({
  enabled: z.boolean().default(true),
  label: z.string().min(1).optional(),
  defaultDurationMinutes: z.number().int().min(5).max(480).optional(),
  defaultCapacity: z.number().int().min(1).max(999).optional(),
  creditCost: z.number().int().min(0).optional(),
  sessionCost: z.number().int().min(0).optional(),
  acceptedAccessProviders: z.array(accessProviderEnum).optional(),
});
export type StudioClassTypeOverrideConfig = z.infer<typeof studioClassTypeOverrideSchema>;

export const studioCreditTypeOverrideSchema = z.object({
  enabled: z.boolean().default(true),
  label: z.string().min(1).optional(),
  defaultValidityDays: z.number().int().min(1).optional(),
});
export type StudioCreditTypeOverrideConfig = z.infer<typeof studioCreditTypeOverrideSchema>;

export const studioBookingRulesSchema = z.object({
  timezone: z.string().default(STUDIO_TIMEZONE),
  cancellationWindowHours: z.number().int().min(0).default(CANCELLATION_WINDOW_HOURS),
  lateCancellationMercyUsesPerMonth: z.number().int().min(0).default(MERCY_USES_PER_MONTH),
  lateCancellationBlockHours: z.number().int().min(0).default(CANCELLATION_CUTOFF_HOURS),
  rescheduleGraceHours: z.number().int().min(0).default(CANCELLATION_WINDOW_HOURS),
  maxConcurrentClasses: z.number().int().min(1).default(STUDIO_MAX_CONCURRENT_CLASSES),
  singleClassMode: z.boolean().default(STUDIO_SINGLE_CLASS_MODE),
  bookingOpensDaysBefore: z.number().int().min(0).default(14),
});
export type StudioBookingRulesConfig = z.infer<typeof studioBookingRulesSchema>;

export const studioFinancialSchema = z.object({
  currency: z.string().length(3).default('EUR'),
  supportedCurrencies: z.array(z.string().length(3)).default(['EUR']),
  taxRatePercent: z.number().min(0).max(100).default(19),
  refundPolicyDays: z.number().int().min(0).default(14),
  autoRefundEnabled: z.boolean().default(true),
  partialPaymentEnabled: z.boolean().default(false),
  membershipGrantIntervalDays: z.number().int().min(1).default(7),
  paymentDueDateDays: z.number().int().min(0).default(14),
  invoiceNumberPrefix: z.string().max(20).default('POS'),
  // Bank / legal details for invoices — must be configured per studio.
  bankName: z.string().max(120).optional(),
  bankIban: z.string().max(40).optional(),
  bankBic: z.string().max(20).optional(),
  vatId: z.string().max(60).optional(),
  owners: z.string().max(255).optional(),
});
export type StudioFinancialConfig = z.infer<typeof studioFinancialSchema>;

export const paymentProviderConfigSchema = z.object({
  provider: paymentProviderEnum,
  enabled: z.boolean().default(false),
  displayName: z.string().optional(),
  // Client-visible metadata (no secrets).
  iconName: z.string().max(60).optional(),
  description: z.string().max(255).optional(),
  isPrimary: z.boolean().optional(),
  // Credentials are stored encrypted in DB; this schema accepts the decrypted shape.
  credentials: z.record(z.string(), z.string()).default({}),
  supportedCurrencies: z.array(z.string().length(3)).optional(),
  processingFeePercent: z.number().min(0).max(100).optional(),
  manualConfirmation: z.boolean().default(false),
});
export type PaymentProviderConfig = z.infer<typeof paymentProviderConfigSchema>;

export const accessProviderConfigSchema = z.object({
  provider: accessProviderEnum,
  enabled: z.boolean().default(false),
  displayName: z.string().optional(),
  // Provider-specific settings (e.g. max class-pass spots, API credentials).
  config: z.record(z.string(), z.unknown()).default({}),
  // Lower number = higher priority in entitlement resolution.
  priority: z.number().int().min(0).default(10),
});
export type AccessProviderConfig = z.infer<typeof accessProviderConfigSchema>;

export const studioNotificationsSchema = z.object({
  emailSenderName: z.string().max(120).optional(),
  emailSenderAddress: z.string().email().optional(),
  replyToAddress: z.string().email().optional(),
  bookingConfirmation: z.boolean().default(true),
  bookingReminder: z.boolean().default(true),
  cancellationNotice: z.boolean().default(true),
  creditLowWarning: z.boolean().default(true),
});
export type StudioNotificationsConfig = z.infer<typeof studioNotificationsSchema>;

// ---------------------------------------------------------------------------
// Onboarding & UI steering schemas
// ---------------------------------------------------------------------------

export const onboardingStateSchema = z.object({
  currentStep: z.string().max(50).default('welcome'),
  completedAt: z.string().datetime().optional(),
  skipped: z.boolean().default(false),
});
export type OnboardingStateConfig = z.infer<typeof onboardingStateSchema>;

export const featureVisibilitySchema = z.object({
  showCreditBalance: z.boolean().default(true),
  showMemberships: z.boolean().default(true),
  showClassPasses: z.boolean().default(false),
  showWelcomeJourney: z.boolean().default(true),
  showInvoices: z.boolean().default(true),
  showEmbedSchedule: z.boolean().default(true),
  showAdminBilling: z.boolean().default(true),
});
export type FeatureVisibilityConfig = z.infer<typeof featureVisibilitySchema>;

export const classCatalogStyleSchema = z.object({
  cardLayout: z.enum(['compact', 'visual', 'list']).default('visual'),
  defaultSort: z.enum(['time', 'popularity', 'price']).default('time'),
});
export type ClassCatalogStyleConfig = z.infer<typeof classCatalogStyleSchema>;

export const paymentOptionsSchema = z.object({
  allowPartialPayment: z.boolean().default(false),
  defaultPaymentProvider: paymentProviderEnum.default('pay_at_studio'),
  showProcessingFees: z.boolean().default(false),
  requireManualConfirmationForBankTransfer: z.boolean().default(true),
});
export type PaymentOptionsConfig = z.infer<typeof paymentOptionsSchema>;

// ---------------------------------------------------------------------------
// Main StudioConfig schema
// ---------------------------------------------------------------------------

export const studioConfigSchema = z.object({
  // System
  id: z.string().uuid().optional(),
  status: studioStatusEnum.default('onboarding'),
  version: z.number().int().min(1).default(1),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),

  // Identity & branding
  identity: studioIdentitySchema,
  branding: studioBrandingSchema,

  // Region & locale
  defaultLocale: z.string().length(2).default('en'),
  supportedLocales: z.array(z.string().length(2)).default(['en']),
  timezone: z.string().default('Europe/Berlin'),

  // Business model selection
  enabledBusinessModels: z.array(businessModelEnum).default(['credits']),

  // Plugins
  paymentProviders: z.array(paymentProviderConfigSchema).default([]),
  accessProviders: z.array(accessProviderConfigSchema).default([]),

  // Catalog overrides
  classTypes: z.record(z.string(), studioClassTypeOverrideSchema).default({}),
  creditTypes: z.record(z.string(), studioCreditTypeOverrideSchema).default({}),

  // Rules
  bookingRules: studioBookingRulesSchema,

  financial: studioFinancialSchema,

  features: studioFeaturesSchema,

  notifications: studioNotificationsSchema,

  // Onboarding & dynamic UI steering
  onboardingState: onboardingStateSchema,
  featureVisibility: featureVisibilitySchema,
  classCatalogStyle: classCatalogStyleSchema,
  paymentOptions: paymentOptionsSchema,

});

export type StudioConfig = z.infer<typeof studioConfigSchema>;

// ---------------------------------------------------------------------------
// Safe parser / validator
// ---------------------------------------------------------------------------

export function parseStudioConfig(input: unknown): StudioConfig {
  return studioConfigSchema.parse(input);
}

export function safeParseStudioConfig(input: unknown): { success: true; data: StudioConfig } | { success: false; error: z.ZodError } {
  const result = studioConfigSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// ---------------------------------------------------------------------------
// Migration helpers from legacy env-driven config
// ---------------------------------------------------------------------------

export function studioConfigFromLegacyEnv(): Partial<StudioConfig> {
  return {
    identity: {
      name: STUDIO.name,
      slug: 'default',
      legalName: STUDIO.name,
      address: STUDIO.address,
      city: STUDIO.city,
      postalCode: STUDIO.city?.match(/\d+/)?.[0],
      country: STUDIO.country?.length === 2 ? STUDIO.country : 'DE',
      phone: STUDIO.phone,
      email: STUDIO.email,
      website: STUDIO.website,
      taxNumber: STUDIO.steuernummer,
      taxAuthority: STUDIO.finanzamt,
    },
    branding: {
      appName: process.env.NEXT_PUBLIC_APP_NAME || 'PilatesOS',
      primaryColor: '#4e2b22',
    },
    timezone: STUDIO_TIMEZONE,
    defaultLocale: 'en',
    supportedLocales: ['en'],
    financial: {
      currency: (FINANCIAL_CONFIG.defaultCurrency || 'eur').toUpperCase(),
      supportedCurrencies: FINANCIAL_CONFIG.supportedCurrencies.map((c) => c.toUpperCase()),
      taxRatePercent: FINANCIAL_CONFIG.taxRatePercent,
      refundPolicyDays: FINANCIAL_CONFIG.refundPolicyDays,
      autoRefundEnabled: FINANCIAL_CONFIG.autoRefundEnabled,
      partialPaymentEnabled: FINANCIAL_CONFIG.partialPaymentEnabled,
      membershipGrantIntervalDays: FINANCIAL_CONFIG.membershipGrantIntervalDays,
      paymentDueDateDays: FINANCIAL_CONFIG.membershipDueDateDays,
      invoiceNumberPrefix: 'POS',
    },
    bookingRules: {
      timezone: STUDIO_TIMEZONE,
      cancellationWindowHours: CANCELLATION_WINDOW_HOURS,
      lateCancellationMercyUsesPerMonth: MERCY_USES_PER_MONTH,
      lateCancellationBlockHours: CANCELLATION_CUTOFF_HOURS,
      maxConcurrentClasses: STUDIO_MAX_CONCURRENT_CLASSES,
      singleClassMode: STUDIO_SINGLE_CLASS_MODE,
      rescheduleGraceHours: CANCELLATION_WINDOW_HOURS,
      bookingOpensDaysBefore: 14,
    },
    enabledBusinessModels: ['credits', 'memberships'],
    paymentProviders: [
      {
        provider: 'pay_at_studio',
        enabled: true,
        displayName: PAYMENT_METHODS.pay_at_studio.label,
        manualConfirmation: true,
        supportedCurrencies: ['EUR'],
        credentials: {},
      },
      {
        provider: 'bank_transfer',
        enabled: true,
        displayName: PAYMENT_METHODS.bank_transfer.label,
        manualConfirmation: true,
        supportedCurrencies: ['EUR'],
        credentials: {},
      },
      {
        provider: 'cash',
        enabled: true,
        displayName: PAYMENT_METHODS.cash.label,
        manualConfirmation: true,
        supportedCurrencies: ['EUR'],
        credentials: {},
      },
      {
        provider: 'stripe',
        enabled: !!process.env.STRIPE_SECRET_KEY,
        displayName: PAYMENT_METHODS.stripe.label,
        manualConfirmation: false,
        supportedCurrencies: PAYMENT_METHODS.stripe.supportedCurrencies.map((c) => c.toUpperCase()),
        processingFeePercent: PAYMENT_METHODS.stripe.processingFeePercent,
        credentials: {},
      },
    ],
    accessProviders: [
      { provider: 'credit_system', enabled: true, priority: 10, config: {} },
      { provider: 'membership_system', enabled: true, priority: 20, config: {} },
      { provider: 'manual_class_pass', enabled: false, priority: 30, config: {} },
    ],
    features: {
      waitlist: true,
      duoBooking: true,
      welcomeJourney: true,
      memberships: true,
      embedSchedule: true,
      invoices: true,
      googleCalendarSync: true,
      manualCreditAdjustments: true,
      promoCodes: false,
    },
    classTypes: Object.fromEntries(
      Object.keys(CLASS_TYPES).map((key) => [
        key,
        {
          enabled: true,
          defaultDurationMinutes: CLASS_TYPES[key as keyof typeof CLASS_TYPES].defaultDuration,
          defaultCapacity: CLASS_TYPES[key as keyof typeof CLASS_TYPES].defaultCapacity,
        },
      ])
    ),
    creditTypes: Object.fromEntries(
      Object.keys(CREDIT_TYPES).map((key) => [
        key,
        {
          enabled: true,
          label: CREDIT_TYPES[key as keyof typeof CREDIT_TYPES].label,
        },
      ])
    ),
  };
}
