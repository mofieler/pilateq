/**
 * CENTRALIZED CLASS & CREDIT TYPES CONFIGURATION
 *
 * Credit model — TWO credit currencies (post-Sprint-6 consolidation):
 *   'pass'     Universal group-class credit.
 *              Accepted for: reformer_group, mat_group, chair, online, yoga, sound_healing.
 *   'session'  Private / duo session credit.
 *              Accepted for: mat_private, mat_duo, reformer_private, reformer_duo.
 *              Also used for the Welcome Journey intro session.
 */

// ─── TYPE DEFINITIONS ──────────────────────────────────────────────────────────

export type ClassType =
  | 'reformer_group'
  | 'reformer_private'
  | 'reformer_duo'
  | 'mat_group'
  | 'mat_private'
  | 'mat_duo'
  | 'chair'
  | 'online'
  | 'sound_healing'
  | 'yoga';

export type CreditType = 'pass' | 'mat_pass' | 'reformer_pass' | 'session';

export interface ClassTypeConfig {
  value: ClassType;
  label: string;
  description: string;
  badgeStyle: string;
  defaultDuration: number;
  defaultCapacity: number;
  location?: string;
}

export interface CreditTypeConfig {
  value: CreditType;
  label: string;
  description: string;
  badgeStyle: string;
}

/** Ordered list of credit types that can be used for a given class type.
 *  The order determines debit priority (specific first, then universal fallback).
 *
 *  Business rules:
 *    - reformer_pass = premium group credit → works for ALL group classes (downgrading allowed)
 *    - mat_pass      = restricted group credit → only Mat Group + Yoga
 *    - pass          = universal group credit → works for all group classes
 *    - session       = separate private/duo system
 */
export const CLASS_TYPE_CREDIT_PRIORITY: Record<ClassType, CreditType[]> = {
  reformer_group:   ['reformer_pass', 'pass'],
  reformer_private: ['session'],
  reformer_duo:     ['session'],
  mat_group:        ['reformer_pass', 'mat_pass', 'pass'],
  mat_private:      ['session'],
  mat_duo:          ['session'],
  chair:            ['reformer_pass', 'pass'],
  online:           ['reformer_pass', 'pass'],
  sound_healing:    ['reformer_pass', 'pass'],
  yoga:             ['reformer_pass', 'mat_pass', 'pass'],
};

// ─── CLASS TYPES ───────────────────────────────────────────────────────────────

export const CLASS_TYPES: Record<ClassType, ClassTypeConfig> = {
  reformer_group: {
    value: 'reformer_group',
    label: 'Reformer Group',
    description: 'Group class on the reformer machine',
    badgeStyle: 'bg-[#e8ddd4] text-[#4e2b22]',
    defaultDuration: 60,
    defaultCapacity: 8,
  },
  reformer_private: {
    value: 'reformer_private',
    label: 'Reformer Private',
    description: 'One-on-one private reformer session',
    badgeStyle: 'bg-[#f5f0ec] text-[#4e2b22] border border-[#d4c5b5]',
    defaultDuration: 60,
    defaultCapacity: 1,
  },
  reformer_duo: {
    value: 'reformer_duo',
    label: 'Reformer Duo',
    description: 'Two-person reformer session',
    badgeStyle: 'bg-[#faf7f4] text-[#4e2b22] border border-[#e8ddd4]',
    defaultDuration: 60,
    defaultCapacity: 2,
  },
  mat_group: {
    value: 'mat_group',
    label: 'Mat Group',
    description: 'Group mat Pilates class',
    badgeStyle: 'bg-[#dce5de] text-[#4e2b22]',
    defaultDuration: 60,
    defaultCapacity: 12,
  },
  mat_private: {
    value: 'mat_private',
    label: 'Mat Private',
    description: 'One-on-one private mat session',
    badgeStyle: 'bg-[#f0f4f1] text-[#4e2b22] border border-[#c5d4c9]',
    defaultDuration: 60,
    defaultCapacity: 1,
  },
  mat_duo: {
    value: 'mat_duo',
    label: 'Mat Duo',
    description: 'Two-person mat session',
    badgeStyle: 'bg-[#f5f7f5] text-[#4e2b22] border border-[#dce5de]',
    defaultDuration: 60,
    defaultCapacity: 2,
  },
  chair: {
    value: 'chair',
    label: 'Chair Pilates',
    description: 'Pilates using a chair — accepts group credits',
    badgeStyle: 'bg-[#ebe3d1] text-[#4e2b22]',
    defaultDuration: 60,
    defaultCapacity: 8,
  },
  online: {
    value: 'online',
    label: 'Online Class',
    description: 'Virtual / online class — accepts group credits',
    badgeStyle: 'bg-[#ddd8cf] text-[#4e2b22]',
    defaultDuration: 60,
    defaultCapacity: 20,
  },
  sound_healing: {
    value: 'sound_healing',
    label: 'Sound Healing',
    description: 'Therapeutic sound healing session — uses group credits',
    badgeStyle: 'bg-[#ddd5dc] text-[#4e2b22]',
    defaultDuration: 60,
    defaultCapacity: 12,
  },
  yoga: {
    value: 'yoga',
    label: 'Yoga',
    description: 'Yoga class — accepts group credits',
    badgeStyle: 'bg-[#d5d9e0] text-[#4e2b22]',
    defaultDuration: 60,
    defaultCapacity: 15,
  },
};

// ─── CREDIT TYPES ──────────────────────────────────────────────────────────────

export const CREDIT_TYPES: Record<CreditType, CreditTypeConfig> = {
  pass: {
    value: 'pass',
    label: 'Credits',
    description: 'Universal credits — accepted for every group class (Mat, Reformer, Chair, Yoga, Sound Healing). Cost varies by class.',
    badgeStyle: 'bg-[#c4a88a]/20 text-[#4e2b22]',
  },
  mat_pass: {
    value: 'mat_pass',
    label: 'Mat Credits',
    description: 'Mat membership credits — accepted ONLY for Mat Group and Yoga classes. Not valid for Chair, Reformer, Sound Healing, Online or any private/duo sessions.',
    badgeStyle: 'bg-[#dce5de] text-[#4e2b22]',
  },
  reformer_pass: {
    value: 'reformer_pass',
    label: 'Reformer Credits',
    description: 'Premium group credits — accepted for ALL group classes (Reformer, Mat, Yoga, Chair, etc.). Downgrading is always possible. Not valid for private/duo sessions.',
    badgeStyle: 'bg-[#e8ddd4] text-[#4e2b22]',
  },
  session: {
    value: 'session',
    label: 'Session Credits',
    description: 'For private 1:1 and duo sessions — Mat costs 3, Reformer costs 5.',
    badgeStyle: 'bg-[#4e2b22]/10 text-[#4e2b22]',
  },
} as const;

// ─── DERIVED MAPPING ───────────────────────────────────────────────────────────

/** Returns the credit type a class template should default to. */
export function getCreditTypeForClassType(classType: ClassType): CreditType {
  if (
    classType === 'reformer_private' ||
    classType === 'reformer_duo' ||
    classType === 'mat_private' ||
    classType === 'mat_duo'
  ) {
    return 'session';
  }
  if (classType === 'reformer_group') {
    return 'reformer_pass';
  }
  return 'mat_pass';
}

/** Returns the ordered list of credit types accepted for a class type.
 *  Debit priority: specific → universal fallback. */
export function getAcceptedCreditTypes(classType: ClassType): CreditType[] {
  return CLASS_TYPE_CREDIT_PRIORITY[classType] ?? ['pass'];
}

/** Returns true if a given credit type is accepted for a class type. */
export function isCreditTypeCompatible(creditType: CreditType, classType: ClassType): boolean {
  return getAcceptedCreditTypes(classType).includes(creditType);
}

// ─── UTILITY FUNCTIONS ─────────────────────────────────────────────────────────

export function getClassTypeValues(): [ClassType, ...ClassType[]] {
  return Object.keys(CLASS_TYPES) as [ClassType, ...ClassType[]];
}

export function getCreditTypeValues(): [CreditType, ...CreditType[]] {
  return Object.keys(CREDIT_TYPES) as [CreditType, ...CreditType[]];
}

export function getClassTypeConfig(value: string): ClassTypeConfig | undefined {
  return CLASS_TYPES[value as ClassType];
}

export function getCreditTypeConfig(value: string): CreditTypeConfig | undefined {
  return CREDIT_TYPES[value as CreditType];
}

export function getClassTypeLabel(value: string): string {
  return getClassTypeConfig(value)?.label ?? value;
}

export function getCreditTypeLabel(value: string): string {
  return getCreditTypeConfig(value)?.label ?? value;
}

export function getClassTypeBadgeStyle(value: string): string {
  return getClassTypeConfig(value)?.badgeStyle ?? 'bg-slate-100 text-slate-700';
}

export function getCreditTypeBadgeStyle(value: string): string {
  return getCreditTypeConfig(value)?.badgeStyle ?? 'bg-slate-100 text-slate-700';
}

export function isValidClassType(value: string): value is ClassType {
  return value in CLASS_TYPES;
}

export function isValidCreditType(value: string): value is CreditType {
  return value in CREDIT_TYPES;
}

export function getClassTypeSelectOptions(): Array<{ value: ClassType; label: string }> {
  return Object.values(CLASS_TYPES).map((c) => ({ value: c.value, label: c.label }));
}

export function getCreditTypeSelectOptions(): Array<{ value: CreditType; label: string }> {
  return Object.values(CREDIT_TYPES).map((c) => ({ value: c.value, label: c.label }));
}

export function isClassType(value: unknown): value is ClassType {
  return typeof value === 'string' && isValidClassType(value);
}

export function isCreditType(value: unknown): value is CreditType {
  return typeof value === 'string' && isValidCreditType(value);
}

/** Returns true for duo class types (reformer_duo, mat_duo). */
export function isDuoClassType(classType: string): boolean {
  return classType === 'reformer_duo' || classType === 'mat_duo';
}

/** Returns true for private/duo session class types (all that use session credits). */
export function isSessionClassType(classType: string): boolean {
  return getCreditTypeForClassType(classType as ClassType) === 'session';
}

// ─── LEGACY COMPATIBILITY (used in booking pages / credit package cards) ────────

export const LEGACY_CREDIT_TYPE_LABELS: Record<string, string> = {
  pass:          'Credits',
  mat_pass:      'Mat Credits',
  reformer_pass: 'Reformer Credits',
  session:       'Session Credits',
};

export const SESSION_SUBTYPE_LABELS: Record<string, string> = {
  private: 'Private Sessions',
  duo:     'Duo Sessions',
};

export const LEGACY_CREDIT_TYPE_STYLES: Record<string, string> = {
  pass:          'bg-[#c4a88a]/20 text-[#4e2b22]',
  mat_pass:      'bg-[#dce5de] text-[#4e2b22]',
  reformer_pass: 'bg-[#e8ddd4] text-[#4e2b22]',
  session:       'bg-[#4e2b22]/10 text-[#4e2b22]',
};

export const LEGACY_CLASS_TYPE_OPTIONS = getClassTypeSelectOptions();
