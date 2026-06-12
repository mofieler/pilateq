/**
 * ClassPass integration plugin.
 *
 * Phase 3 implementation: API booking where available, manual fallback.
 */

import type { ClassPassProviderPlugin } from '../types';

export const classpassPlugin: ClassPassProviderPlugin = {
  key: 'classpass',
  type: 'classpass',
  displayName: 'ClassPass',
  description: 'Accept ClassPass members in your studio.',
  availableGlobally: true,
  supportsRealtimeBooking: false,
  supportsReconciliation: true,
  supportsManualCheckin: true,
};
