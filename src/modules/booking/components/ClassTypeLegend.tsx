'use client';

import { getClassTypeLegendGroups } from '@/lib/config/class-colors';
import { useEmbedTranslation } from '@/modules/embed/components/EmbedTranslationContext';

interface Props {
  /** When true, renders inside the embed widget and uses embed translations. */
  locale?: string;
  /** When true, adds a Google Calendar sync indicator (admin view only). */
  showGoogleCalendar?: boolean;
}

export function ClassTypeLegend({ locale, showGoogleCalendar = false }: Props) {
  const embedCtx = useEmbedTranslation();
  const groups = getClassTypeLegendGroups();

  // Translation helper: use embed context if available, otherwise fallback
  const t = (key: string): string => {
    if (embedCtx?.t) {
      return embedCtx.t(key);
    }
    // Fallback labels for non-embed usage (admin dashboard, etc.)
    const fallbacks: Record<string, string> = {
      'classTypes.reformer_group': 'Reformer Group',
      'classTypes.reformer_private': 'Reformer Private',
      'classTypes.reformer_duo': 'Reformer Duo',
      'classTypes.mat_group': 'Mat Group',
      'classTypes.mat_private': 'Mat Private',
      'classTypes.mat_duo': 'Mat Duo',
      'classTypes.chair': 'Chair Pilates',
      'classTypes.online': 'Online',
      'classTypes.sound_healing': 'Sound Healing',
      'classTypes.yoga': 'Yoga',
    };
    return fallbacks[key] ?? key;
  };

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2.5 px-0.5">
      {groups.map((group) => (
        <span key={group.id} className="flex items-center gap-2">
          {/* Color swatch — shows the actual card background color */}
          <span
            className="inline-block rounded-md border"
            style={{
              width: 18,
              height: 12,
              backgroundColor: group.hex + '18', // ~10% opacity hex
              borderColor: group.hex + '4D',      // ~30% opacity hex
            }}
          />
          {/* Category label */}
          <span className="text-[11px] font-semibold text-[#4e2b22]">{group.label}</span>
          {/* Sub-types as subtle badges */}
          <span className="flex items-center gap-1">
            {group.types.map((type, i) => (
              <span key={type.value} className="text-[10px] text-[#8b6b5c]">
                {t('classTypes.' + type.value)}
                {i < group.types.length - 1 && (
                  <span className="text-[#c4a88a]/60 mx-0.5">·</span>
                )}
              </span>
            ))}
          </span>
        </span>
      ))}

      {showGoogleCalendar && (
        <span className="flex items-center gap-2">
          <span
            className="inline-block rounded-md border"
            style={{
              width: 18,
              height: 12,
              backgroundColor: '#c4a88a' + '18',
              borderColor: '#c4a88a' + '4D',
            }}
          />
          <span className="text-[11px] font-semibold text-[#4e2b22]">Google Calendar</span>
        </span>
      )}
    </div>
  );
}
