'use client';

import { Label } from '@/components/ui/label';
import type { StudioMembershipRole } from '@/db/schema';

const ROLE_OPTIONS: { value: StudioMembershipRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'student', label: 'Student' },
];

const ROLE_LABELS: Record<StudioMembershipRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  instructor: 'Instructor',
  student: 'Student',
};

type RoleSelectProps = {
  id?: string;
  label?: string;
  value: StudioMembershipRole;
  onChange: (value: StudioMembershipRole) => void;
  disabled?: boolean;
  allowOwner?: boolean;
  required?: boolean;
  className?: string;
};

export function RoleSelect({
  id = 'role',
  label = 'Role',
  value,
  onChange,
  disabled = false,
  allowOwner = true,
  required = false,
  className = '',
}: RoleSelectProps) {
  const options = allowOwner ? ROLE_OPTIONS : ROLE_OPTIONS.filter((o) => o.value !== 'owner');

  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={id} className="text-[#6b3d32] font-medium">
        {label}
        {required && <span className="ml-1 text-[#c45c4a]">*</span>}
      </Label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as StudioMembershipRole)}
          disabled={disabled}
          required={required}
          className={`
            flex h-10 w-full min-w-0 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 px-3 py-2
            text-sm font-medium text-[#4e2b22] shadow-sm outline-none transition-all
            focus:border-[#c4a88a] focus:ring-2 focus:ring-[#4e2b22]/10
            disabled:cursor-not-allowed disabled:opacity-50
            ${!value ? 'text-[#8b6b5c]' : ''}
          `}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8b6b5c]">
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>
      <p className="text-xs text-[#8b6b5c]">{ROLE_LABELS[value]}</p>
    </div>
  );
}

export { ROLE_LABELS };
