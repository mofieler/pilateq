export interface ClassTypeMetadata {
  name: string;
  needsWaiver: boolean;
  requiresCredits: boolean;
  autoExpiryMinutes: number | null;
  maxCapacity: number;
  durationMinutes: number;
}

export const CLASS_TYPES_CONFIG: Record<string, ClassTypeMetadata> = {
  reformer_group: {
    name: 'Reformer Group',
    needsWaiver: true,
    requiresCredits: true,
    autoExpiryMinutes: null,
    maxCapacity: 6,
    durationMinutes: 60,
  },
  reformer_private: {
    name: 'Reformer Private',
    needsWaiver: true,
    requiresCredits: true,
    autoExpiryMinutes: null,
    maxCapacity: 1,
    durationMinutes: 60,
  },
  reformer_duo: {
    name: 'Reformer Duo',
    needsWaiver: true,
    requiresCredits: true,
    autoExpiryMinutes: null,
    maxCapacity: 2,
    durationMinutes: 60,
  },
  mat_group: {
    name: 'Mat Group',
    needsWaiver: true,
    requiresCredits: true,
    autoExpiryMinutes: null,
    maxCapacity: 12,
    durationMinutes: 60,
  },
  mat_private: {
    name: 'Mat Private',
    needsWaiver: true,
    requiresCredits: true,
    autoExpiryMinutes: null,
    maxCapacity: 1,
    durationMinutes: 60,
  },
  mat_duo: {
    name: 'Mat Duo',
    needsWaiver: true,
    requiresCredits: true,
    autoExpiryMinutes: null,
    maxCapacity: 2,
    durationMinutes: 60,
  },
  chair: {
    name: 'Chair Pilates',
    needsWaiver: true,
    requiresCredits: true,
    autoExpiryMinutes: null,
    maxCapacity: 6,
    durationMinutes: 60,
  },
  online: {
    name: 'Online Class',
    needsWaiver: false,
    requiresCredits: true,
    autoExpiryMinutes: null,
    maxCapacity: 100,
    durationMinutes: 60,
  },
  sound_healing: {
    name: 'Sound Healing',
    needsWaiver: false,
    requiresCredits: true,
    autoExpiryMinutes: null,
    maxCapacity: 15,
    durationMinutes: 60,
  },
  yoga: {
    name: 'Yoga Class',
    needsWaiver: true,
    requiresCredits: true,
    autoExpiryMinutes: null,
    maxCapacity: 12,
    durationMinutes: 60,
  },
};
