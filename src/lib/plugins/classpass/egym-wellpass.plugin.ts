/**
 * EGYM Wellpass integration plugin.
 *
 * Phase 3 implementation: API booking where available, manual fallback.
 */

import type { ClassPassProviderPlugin } from '../types';

export const egymWellpassPlugin: ClassPassProviderPlugin = {
  key: 'egym_wellpass',
  type: 'classpass',
  displayName: 'EGYM Wellpass',
  description: 'Accept EGYM Wellpass members in your studio.',
  availableGlobally: false,
  supportedCountries: ['DE', 'AT', 'CH'],
  supportsRealtimeBooking: false,
  supportsReconciliation: true,
  supportsManualCheckin: true,
};
