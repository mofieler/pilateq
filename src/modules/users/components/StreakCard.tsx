import { FlameIcon, Sparkles, Clock } from 'lucide-react';

interface WeeklyBar {
  weekLabel: string;
  attended: boolean;
}

interface Props {
  streak?: number;
  longestStreak?: number;
  weeklyBreakdown?: WeeklyBar[];
  personalRhythmDays?: number;
  graceDays?: number;
  daysSinceLastClass?: number | null;
  graceRemaining?: number | null;
}

export function StreakCard({
  streak = 0,
  longestStreak = 0,
  weeklyBreakdown = [],
  personalRhythmDays = 7,
  graceDays = 10,
  daysSinceLastClass = null,
  graceRemaining = null,
}: Props) {
  const hasHistory = daysSinceLastClass !== null;
  const isActive = streak > 0 && (graceRemaining === null || graceRemaining > 0);
  const isAtRisk = isActive && graceRemaining !== null && graceRemaining <= 3 && graceRemaining > 0;
  const justEnded = !isActive && hasHistory && daysSinceLastClass !== null && daysSinceLastClass <= graceDays + 3;

  // Build the smart subtitle
  let subtitle: string;
  if (!hasHistory) {
    subtitle = 'Book your first class to start your streak!';
  } else if (isActive && isAtRisk) {
    subtitle = `Come within ${graceRemaining} day${graceRemaining === 1 ? '' : 's'} to keep your ${streak}-week streak alive!`;
  } else if (isActive) {
    const rhythmText = personalRhythmDays <= 3
      ? 'You\'re a regular!'
      : `Your rhythm: every ${personalRhythmDays} days`;
    const graceText = graceRemaining !== null && graceRemaining > 0
      ? ` · ${graceRemaining} day${graceRemaining === 1 ? '' : 's'} left`
      : '';
    subtitle = `${rhythmText}${graceText}`;
  } else if (justEnded) {
    subtitle = 'Your streak ended — book a class to start a new one!';
  } else {
    subtitle = 'Book a class to start a new streak!';
  }

  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-[#ede8e5]/60 bg-gradient-to-br from-[#faf9f7] to-[#f5ebe0] p-5 shadow-[0_4px_14px_rgba(78,43,34,0.04)] backdrop-blur-sm transition-all duration-300 hover:shadow-[0_8px_24px_rgba(78,43,34,0.08)] hover:-translate-y-0.5">
      {/* Flame icon */}
      <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl ring-1 transition-colors ${
        isAtRisk
          ? 'bg-[#c45c4a]/10 ring-[#c45c4a]/20'
          : isActive
            ? 'bg-gradient-to-br from-[#d4a574]/20 to-[#c4a88a]/30 ring-[#c4a88a]/20'
            : 'bg-[#ede8e5]/60 ring-[#d4c5b5]/30'
      }`}>
        {isAtRisk ? (
          <Clock className="size-6 text-[#c45c4a]" aria-hidden />
        ) : (
          <FlameIcon className={`size-6 ${isActive ? 'text-[#c45c4a]' : 'text-[#a6856f]'}`} aria-hidden />
        )}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#4e2b22] flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-[#c4a88a]" />
          {isActive ? 'Class Streak' : 'Streak'}
        </p>

        {streak > 0 ? (
          <div className="flex items-baseline gap-3 mt-1">
            <p className={`text-2xl font-bold tabular-nums ${isAtRisk ? 'text-[#c45c4a]' : 'text-[#c45c4a]'}`}>
              {streak}
              <span className="ml-1.5 text-sm font-medium text-[#8b6b5c]">
                {streak === 1 ? 'week' : 'weeks'}
              </span>
            </p>
            {longestStreak > streak && (
              <p className="text-[10px] text-[#8b6b5c] font-medium">
                Best: {longestStreak}
              </p>
            )}
          </div>
        ) : hasHistory ? (
          <p className="text-sm text-[#8b6b5c] mt-1">
            {justEnded ? 'Your streak just ended' : 'No active streak'}
          </p>
        ) : (
          <p className="text-sm text-[#8b6b5c] mt-1">Book your first class to start your streak!</p>
        )}

        {/* Smart subtitle */}
        {subtitle && (
          <p className={`mt-1 text-xs font-medium ${
            isAtRisk ? 'text-[#c45c4a]' : 'text-[#8b6b5c]'
          }`}>
            {subtitle}
          </p>
        )}

        {/* Weekly mini sparkline */}
        {weeklyBreakdown.length > 0 && (
          <div className="mt-2.5 flex items-end gap-1">
            {weeklyBreakdown.map((week, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div
                  className={`w-2.5 rounded-sm transition-all ${
                    week.attended
                      ? 'h-4 bg-[#c45c4a]'
                      : 'h-1.5 bg-[#ede8e5]'
                  }`}
                  title={week.weekLabel}
                />
                <span className="text-[8px] text-[#a6856f] leading-none">{week.weekLabel}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
