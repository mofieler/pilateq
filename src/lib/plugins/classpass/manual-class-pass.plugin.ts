/**
 * Manual class pass check-in bridge.
 *
 * Studios that accept class pass users but do not have an API integration can
 * manually mark a booking as "class pass check-in" and reconcile later.
 */

import type { ClassPassProviderPlugin } from '../types';

export const manualClassPassPlugin: ClassPassProviderPlugin = {
  key: 'manual_class_pass',
  type: 'classpass',
  displayName: 'Manual Check-In',
  description: 'Mark class pass users manually and reconcile attendance reports.',
  availableGlobally: true,
  supportsRealtimeBooking: false,
  supportsReconciliation: true,
  supportsManualCheckin: true,
};
