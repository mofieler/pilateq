/**
 * Client-safe class pass partner metadata.
 *
 * This file exports ONLY the static metadata that client components need to
 * render class pass provider lists. It deliberately does not import any plugin
 * implementations (or the full registry) so it can be bundled for the browser.
 */

export interface ClassPassProviderMeta {
  key: string;
  displayName: string;
  description: string;
  type: 'classpass';
}

export const CLASSPASS_PROVIDERS: readonly ClassPassProviderMeta[] = [
  {
    key: 'manual_class_pass',
    displayName: 'Manual Check-In',
    description: 'Mark class pass users manually and reconcile attendance reports.',
    type: 'classpass',
  },
  {
    key: 'egym_wellpass',
    displayName: 'EGYM Wellpass',
    description: 'Accept EGYM Wellpass members in your studio.',
    type: 'classpass',
  },
  {
    key: 'urban_sports_club',
    displayName: 'Urban Sports Club',
    description: 'Accept Urban Sports Club members in your studio.',
    type: 'classpass',
  },
  {
    key: 'classpass',
    displayName: 'ClassPass',
    description: 'Accept ClassPass members in your studio.',
    type: 'classpass',
  },
] as const;
