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
