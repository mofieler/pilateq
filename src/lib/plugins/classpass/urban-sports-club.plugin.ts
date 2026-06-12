/**
 * Urban Sports Club integration plugin.
 *
 * Phase 3 implementation: API booking where available, manual fallback.
 */

import type { ClassPassProviderPlugin } from '../types';

export const urbanSportsClubPlugin: ClassPassProviderPlugin = {
  key: 'urban_sports_club',
  type: 'classpass',
  displayName: 'Urban Sports Club',
  description: 'Accept Urban Sports Club members in your studio.',
  availableGlobally: false,
  supportedCountries: ['DE', 'NL', 'ES'],
  supportsRealtimeBooking: false,
  supportsReconciliation: true,
  supportsManualCheckin: true,
};
