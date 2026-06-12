/**
 * Plugin Registry
 *
 * This is the ONE FILE to change when adding or removing a business model,
 * payment provider, or class pass partner.
 *
 * How to add a plugin:
 *   1. Create a file under payment/, access/, or classpass/ that implements
 *      the matching interface from types.ts.
 *   2. Import it here and add it to ALL_PLUGINS.
 *   3. Add its key to the StudioConfig enum if it is not already there.
 */

import type { AnyPlugin } from './types';

// Payment providers
import { stripePlugin } from './payment/stripe.plugin';
import { payAtStudioPlugin } from './payment/pay-at-studio.plugin';
import { bankTransferPlugin } from './payment/bank-transfer.plugin';
import { cashPlugin } from './payment/cash.plugin';

// Access providers
import { creditSystemPlugin } from './access/credit-system.plugin';
import { sessionPackageSystemPlugin } from './access/session-package-system.plugin';
import { membershipSystemPlugin } from './access/membership-system.plugin';
import { classPassAccessPlugin } from './access/class-pass-access.plugin';
import { manualClassPassPlugin } from './classpass/manual-class-pass.plugin';

// Class pass partners
import { egymWellpassPlugin } from './classpass/egym-wellpass.plugin';
import { urbanSportsClubPlugin } from './classpass/urban-sports-club.plugin';
import { classpassPlugin } from './classpass/classpass.plugin';

// ---------------------------------------------------------------------------
// Master registry
// ---------------------------------------------------------------------------

export const ALL_PLUGINS: readonly AnyPlugin[] = [
  // Payment
  stripePlugin,
  payAtStudioPlugin,
  bankTransferPlugin,
  cashPlugin,

  // Access
  creditSystemPlugin,
  sessionPackageSystemPlugin,
  membershipSystemPlugin,
  classPassAccessPlugin,

  // Class pass partners (also act as access providers where applicable)
  manualClassPassPlugin,
  egymWellpassPlugin,
  urbanSportsClubPlugin,
  classpassPlugin,
] as const;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getPluginByKey(key: string): AnyPlugin | undefined {
  return ALL_PLUGINS.find((p) => p.key === key);
}

export function getPaymentProviderPlugins() {
  return ALL_PLUGINS.filter((p): p is Extract<AnyPlugin, { type: 'payment' }> => p.type === 'payment');
}

export function getAccessProviderPlugins() {
  return ALL_PLUGINS.filter((p): p is Extract<AnyPlugin, { type: 'access' }> => p.type === 'access');
}

export function getClassPassProviderPlugins() {
  return ALL_PLUGINS.filter((p): p is Extract<AnyPlugin, { type: 'classpass' }> => p.type === 'classpass');
}

interface AccessProviderRef {
  provider: string;
  enabled: boolean;
  priority?: number;
}

interface PaymentProviderRef {
  provider: string;
  enabled: boolean;
}

export function getEnabledAccessPlugins(studioConfig: { accessProviders: AccessProviderRef[] }) {
  const enabledKeys = new Set(
    studioConfig.accessProviders
      .filter((ap) => ap.enabled)
      .sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10))
      .map((ap) => ap.provider)
  );

  return getAccessProviderPlugins().filter((p) => enabledKeys.has(p.key));
}

export function getEnabledPaymentPlugins(studioConfig: { paymentProviders: PaymentProviderRef[] }) {
  const enabledKeys = new Set(studioConfig.paymentProviders.filter((pp) => pp.enabled).map((pp) => pp.provider));
  return getPaymentProviderPlugins().filter((p) => enabledKeys.has(p.key));
}
