'use client';

// ─── Strength logic (also used by pages to gate submit) ───────────────────────

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3;
  label: string;
  tip: string | null;
  isValid: boolean; // meets the hard minimum (letter + number + 8 chars)
};

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '', tip: null, isValid: false };

  const isMinLength  = password.length >= 8;
  const hasLetter    = /[a-zA-Z]/.test(password);
  const hasNumber    = /[0-9]/.test(password);
  const hasUpper     = /[A-Z]/.test(password);
  const hasLower     = /[a-z]/.test(password);
  const isLong       = password.length >= 12;

  if (!isMinLength) {
    return {
      score: 0,
      label: 'Too short',
      tip: `${8 - password.length} more character${8 - password.length === 1 ? '' : 's'} needed`,
      isValid: false,
    };
  }

  if (!hasLetter || !hasNumber) {
    return {
      score: 0,
      label: 'Weak',
      tip: !hasNumber ? 'Add at least one number (e.g. 3, 7)' : 'Add at least one letter',
      isValid: false,
    };
  }

  // From here: minimum is met (isValid = true)

  if (!hasUpper || !hasLower) {
    return {
      score: 1,
      label: 'Fair',
      tip: 'Mix uppercase and lowercase for better security',
      isValid: true,
    };
  }

  if (!isLong) {
    return {
      score: 2,
      label: 'Good',
      tip: '12+ characters makes it even stronger',
      isValid: true,
    };
  }

  return { score: 3, label: 'Strong', tip: null, isValid: true };
}

// ─── Bar colours per score ────────────────────────────────────────────────────

const BAR_FILL: Record<0 | 1 | 2 | 3, [string, string, string]> = {
  0: ['bg-red-400',    'bg-[#ede8e5]',  'bg-[#ede8e5]'],
  1: ['bg-amber-400',  'bg-[#ede8e5]',  'bg-[#ede8e5]'],
  2: ['bg-[#6b8e6b]',  'bg-[#6b8e6b]', 'bg-[#ede8e5]'],
  3: ['bg-[#4a7c4a]',  'bg-[#4a7c4a]', 'bg-[#4a7c4a]'],
};

const LABEL_COLOR: Record<0 | 1 | 2 | 3, string> = {
  0: 'text-red-500',
  1: 'text-amber-600',
  2: 'text-[#6b8e6b]',
  3: 'text-[#4a7c4a]',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label, tip } = getPasswordStrength(password);

  if (!password) return null;

  const bars = BAR_FILL[score];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        {bars.map((bg, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${bg}`}
          />
        ))}
        <span className={`ml-1 w-14 shrink-0 text-xs font-semibold ${LABEL_COLOR[score]}`}>
          {label}
        </span>
      </div>
      {tip && <p className="text-xs text-[#8b6b5c]">{tip}</p>}
    </div>
  );
}
