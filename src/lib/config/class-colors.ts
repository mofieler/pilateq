/**
 * SINGLE SOURCE OF TRUTH — Class Type Calendar Colors
 *
 * Used by: AdminWeekView, Booking WeekView, EmbedScheduleClient
 * Replaces the three separate BLOCK_BG / BLOCK_DOT copies that had drifted.
 *
 * Design principle: each class type family shares a color DNA,
 * with opacity variations for visual hierarchy (group = solid, private = slightly richer).
 */

import type { ClassType } from './class-types';

export interface ClassTypeColorSet {
  /** Background class for calendar cards (e.g. 'bg-[#8b5a3c]/10') */
  bg: string;
  /** Border class for calendar cards */
  border: string;
  /** Text color class */
  text: string;
  /** Hover background class */
  hoverBg: string;
  /** Dot / indicator color class */
  dot: string;
  /** The raw hex color (for non-Tailwind uses: SVG, inline styles, etc.) */
  hex: string;
}

export const CLASS_TYPE_COLORS: Record<ClassType, ClassTypeColorSet> = {
  reformer_group: {
    bg: 'bg-[#8b5a3c]/10',
    border: 'border-[#c4a88a]/40',
    text: 'text-[#4e2b22]',
    hoverBg: 'hover:bg-[#8b5a3c]/20',
    dot: 'bg-[#8b5a3c]',
    hex: '#8b5a3c',
  },
  reformer_private: {
    bg: 'bg-[#8b5a3c]/15',
    border: 'border-[#c4a88a]/50',
    text: 'text-[#4e2b22]',
    hoverBg: 'hover:bg-[#8b5a3c]/25',
    dot: 'bg-[#8b5a3c]',
    hex: '#8b5a3c',
  },
  reformer_duo: {
    bg: 'bg-[#8b5a3c]/10',
    border: 'border-[#c4a88a]/35',
    text: 'text-[#4e2b22]',
    hoverBg: 'hover:bg-[#8b5a3c]/20',
    dot: 'bg-[#8b5a3c]',
    hex: '#8b5a3c',
  },
  mat_group: {
    bg: 'bg-[#6b8e6b]/10',
    border: 'border-[#6b8e6b]/30',
    text: 'text-[#4a7c4a]',
    hoverBg: 'hover:bg-[#6b8e6b]/20',
    dot: 'bg-[#6b8e6b]',
    hex: '#6b8e6b',
  },
  mat_private: {
    bg: 'bg-[#6b8e6b]/15',
    border: 'border-[#6b8e6b]/40',
    text: 'text-[#4a7c4a]',
    hoverBg: 'hover:bg-[#6b8e6b]/25',
    dot: 'bg-[#6b8e6b]',
    hex: '#6b8e6b',
  },
  mat_duo: {
    bg: 'bg-[#6b8e6b]/10',
    border: 'border-[#6b8e6b]/25',
    text: 'text-[#4a7c4a]',
    hoverBg: 'hover:bg-[#6b8e6b]/20',
    dot: 'bg-[#6b8e6b]',
    hex: '#6b8e6b',
  },
  chair: {
    bg: 'bg-[#d4a574]/10',
    border: 'border-[#d4a574]/30',
    text: 'text-[#7a4e25]',
    hoverBg: 'hover:bg-[#d4a574]/20',
    dot: 'bg-[#d4a574]',
    hex: '#d4a574',
  },
  online: {
    bg: 'bg-[#64748b]/10',
    border: 'border-[#64748b]/30',
    text: 'text-[#475569]',
    hoverBg: 'hover:bg-[#64748b]/20',
    dot: 'bg-[#64748b]',
    hex: '#64748b',
  },
  sound_healing: {
    bg: 'bg-[#9333ea]/10',
    border: 'border-[#9333ea]/30',
    text: 'text-[#7e22ce]',
    hoverBg: 'hover:bg-[#9333ea]/20',
    dot: 'bg-[#9333ea]',
    hex: '#9333ea',
  },
  yoga: {
    bg: 'bg-[#6366f1]/10',
    border: 'border-[#6366f1]/30',
    text: 'text-[#4f46e5]',
    hoverBg: 'hover:bg-[#6366f1]/20',
    dot: 'bg-[#6366f1]',
    hex: '#6366f1',
  },
} as const;

// ─── Grouped legend data — intuitive color families ────────────────────────────

export interface LegendGroup {
  id: string;
  label: string;
  hex: string;
  dotClass: string;
  bgClass: string;
  types: { value: ClassType; label: string }[];
}

/** Groups class types by their shared color DNA for a cleaner legend. */
export function getClassTypeLegendGroups(): LegendGroup[] {
  return [
    {
      id: 'reformer',
      label: 'Reformer',
      hex: CLASS_TYPE_COLORS.reformer_group.hex,
      dotClass: CLASS_TYPE_COLORS.reformer_group.dot,
      bgClass: CLASS_TYPE_COLORS.reformer_group.bg,
      types: [
        { value: 'reformer_group', label: 'Group' },
        { value: 'reformer_private', label: 'Private' },
        { value: 'reformer_duo', label: 'Duo' },
      ],
    },
    {
      id: 'mat',
      label: 'Mat',
      hex: CLASS_TYPE_COLORS.mat_group.hex,
      dotClass: CLASS_TYPE_COLORS.mat_group.dot,
      bgClass: CLASS_TYPE_COLORS.mat_group.bg,
      types: [
        { value: 'mat_group', label: 'Group' },
        { value: 'mat_private', label: 'Private' },
        { value: 'mat_duo', label: 'Duo' },
      ],
    },
    {
      id: 'chair',
      label: 'Chair',
      hex: CLASS_TYPE_COLORS.chair.hex,
      dotClass: CLASS_TYPE_COLORS.chair.dot,
      bgClass: CLASS_TYPE_COLORS.chair.bg,
      types: [{ value: 'chair', label: 'Chair Pilates' }],
    },
    {
      id: 'online',
      label: 'Online',
      hex: CLASS_TYPE_COLORS.online.hex,
      dotClass: CLASS_TYPE_COLORS.online.dot,
      bgClass: CLASS_TYPE_COLORS.online.bg,
      types: [{ value: 'online', label: 'Online' }],
    },
    {
      id: 'sound_healing',
      label: 'Sound Healing',
      hex: CLASS_TYPE_COLORS.sound_healing.hex,
      dotClass: CLASS_TYPE_COLORS.sound_healing.dot,
      bgClass: CLASS_TYPE_COLORS.sound_healing.bg,
      types: [{ value: 'sound_healing', label: 'Sound Healing' }],
    },
    {
      id: 'yoga',
      label: 'Yoga',
      hex: CLASS_TYPE_COLORS.yoga.hex,
      dotClass: CLASS_TYPE_COLORS.yoga.dot,
      bgClass: CLASS_TYPE_COLORS.yoga.bg,
      types: [{ value: 'yoga', label: 'Yoga' }],
    },
  ];
}

/** Combines bg + border + text + hover into a single class string for calendar blocks. */
export function getCalendarBlockClasses(classType: ClassType): string {
  const c = CLASS_TYPE_COLORS[classType];
  return `${c.bg} ${c.border} ${c.text} ${c.hoverBg}`;
}

/** Returns just the dot color class. */
export function getCalendarDotClass(classType: ClassType): string {
  return CLASS_TYPE_COLORS[classType].dot;
}
