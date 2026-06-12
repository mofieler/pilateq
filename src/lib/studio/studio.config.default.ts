/**
 * Default StudioConfig values.
 *
 * This file is the ONE place where global defaults for new studios are defined.
 * When a studio starts onboarding, these defaults populate the form.
 * When adding a new field to StudioConfig, add its default here.
 */

import {
  studioConfigSchema,
  type StudioConfig,
} from './studio.config.schema';

export const DEFAULT_STUDIO_CONFIG = studioConfigSchema.parse({
  status: 'onboarding',
  version: 1,

  identity: {
    name: 'My Pilates Studio',
    slug: 'my-studio',
    legalName: 'My Pilates Studio',
    address: '',
    city: '',
    postalCode: '',
    country: 'DE',
    phone: '',
    email: 'hello@example.com',
    website: 'https://example.com',
    taxNumber: '',
    taxAuthority: '',
  },

  branding: {
    primaryColor: '#4e2b22',
    appName: 'PilatesOS',
  },

  defaultLocale: 'en',
  supportedLocales: ['en'],
  timezone: 'Europe/Berlin',

  enabledBusinessModels: ['credits'],

  paymentProviders: [],
  accessProviders: [
    { provider: 'credit_system', enabled: true, priority: 10, config: {} },
    { provider: 'membership_system', enabled: true, priority: 20, config: {} },
  ],

  classTypes: {},
  creditTypes: {},

  bookingRules: {
    timezone: 'Europe/Berlin',
    cancellationWindowHours: 24,
    lateCancellationMercyUsesPerMonth: 3,
    lateCancellationBlockHours: 3,
    rescheduleGraceHours: 24,
    maxConcurrentClasses: 1,
    singleClassMode: true,
    bookingOpensDaysBefore: 14,
  },

  financial: {
    currency: 'EUR',
    supportedCurrencies: ['EUR'],
    taxRatePercent: 19,
    refundPolicyDays: 14,
    autoRefundEnabled: true,
    partialPaymentEnabled: false,
    membershipGrantIntervalDays: 7,
    paymentDueDateDays: 14,
    invoiceNumberPrefix: 'POS',
    bankName: '',
    bankIban: '',
    bankBic: '',
    vatId: '',
    owners: '',
  },

  features: {
    waitlist: true,
    duoBooking: true,
    welcomeJourney: true,
    memberships: true,
    embedSchedule: true,
    invoices: true,
    googleCalendarSync: false,
    manualCreditAdjustments: true,
    promoCodes: false,
  },

  notifications: {
    bookingConfirmation: true,
    bookingReminder: true,
    cancellationNotice: true,
    creditLowWarning: true,
  },
} satisfies Partial<StudioConfig>);

export type DefaultStudioConfig = typeof DEFAULT_STUDIO_CONFIG;
