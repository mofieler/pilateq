/**
 * Studio module public API (client-safe).
 *
 * This barrel file intentionally contains ONLY exports that are safe to pull
 * into client bundles. Server-only helpers (getStudioConfig, resolveStudio,
 * etc.) live in `@/lib/studio/server`.
 */

export {
  studioConfigSchema,
  parseStudioConfig,
  safeParseStudioConfig,
  studioConfigFromLegacyEnv,
} from './studio.config.schema';
export type { StudioConfig, StudioStatus, BusinessModel } from './studio.config.schema';
export type { PaymentProvider, AccessProvider } from './studio.config.schema';
export type {
  StudioIdentityConfig,
  StudioBrandingConfig,
  StudioFeaturesConfig,
  StudioClassTypeOverrideConfig,
  StudioCreditTypeOverrideConfig,
  StudioBookingRulesConfig,
  StudioFinancialConfig,
  PaymentProviderConfig,
  AccessProviderConfig,
  StudioNotificationsConfig,
} from './studio.config.schema';

export { DEFAULT_STUDIO_CONFIG } from './studio.config.default';

export {
  resolveTenantFromHostname,
  getHostnameFromHeaders,
} from './studio.config.tenant';

export {
  StudioConfigProvider,
  useStudioConfig,
} from './studio.config.provider';

export { useStudioFeature } from './hooks/useStudioFeature';
export {
  useStudioFeatureFlag,
  useStudioFeatures,
} from './hooks/useStudioFeatures';
export {
  useBusinessModel,
  useEnabledBusinessModels,
} from './hooks/useBusinessModel';
export {
  usePaymentProvider,
  useEnabledPaymentProviders,
  useDefaultPaymentProvider,
} from './hooks/usePaymentProvider';
export {
  useAccessProvider,
  useEnabledAccessProviders,
  useHasExternalAccessProviders,
} from './hooks/useAccessProvider';
export {
  useClassTypeConfig,
  useEnabledClassTypes,
  useIsClassTypeEnabled,
} from './hooks/useClassTypeConfig';
export {
  useCreditTypeConfig,
  useEnabledCreditTypes,
  useIsCreditTypeEnabled,
} from './hooks/useCreditTypeConfig';
export {
  useBookingRules,
  useBookingRule,
} from './hooks/useBookingRules';
export {
  useFinancialConfig,
  useFinancialValue,
  useFormatPrice,
} from './hooks/useFinancialConfig';
export { useStudioIdentity } from './hooks/useStudioIdentity';
export {
  useStudioBranding,
  useAppName,
  usePrimaryColor,
} from './hooks/useStudioBranding';

// ─── Server-only membership helpers ───────────────────────────────────────────
// These functions depend on the database and must only be imported in server
// contexts (API routes, Server Components, Server Actions). Importing them into
// client components will fail at runtime. Prefer `@/lib/studio/server` or
// `@/lib/studio/membership` for server-only code to keep the client bundle clean.
export type { StudioMembershipRole } from '@/db/schema';
