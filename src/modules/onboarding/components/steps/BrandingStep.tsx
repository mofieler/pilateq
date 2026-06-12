'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { StudioConfig } from '@/lib/studio';
import type { StepFieldErrors } from '../OnboardingWizard';

const PRESET_COLORS = [
  '#4e2b22',
  '#6b3d32',
  '#8b6b5c',
  '#c4a88a',
  '#d4a574',
  '#2d5a4a',
  '#3d6b5b',
  '#1e3a5f',
  '#5c3d7a',
  '#7a3d3d',
];

export interface BrandingStepProps {
  value: StudioConfig['branding'];
  onChange: (value: StudioConfig['branding']) => void;
  onBlur?: () => void;
  errors?: StepFieldErrors;
}

export function BrandingStep({ value, onChange, onBlur, errors = {} }: BrandingStepProps) {
  const isValidHex = /^#([0-9A-Fa-f]{3}){1,2}$/.test(value.primaryColor);
  const appNameError = errors.appName;
  const primaryColorError = errors['primaryColor'];
  const logoUrlError = errors.logoUrl;
  const faviconUrlError = errors.faviconUrl;

  return (
    <div className="space-y-6" onBlur={onBlur}>
      <p className="text-sm text-[#8b6b5c]">
        Make the app feel like your studio. Students will see this color and name throughout their booking experience.
      </p>

      <div className="space-y-2">
        <Label htmlFor="appName">App name</Label>
        <Input
          id="appName"
          value={value.appName}
          onChange={(e) => onChange({ ...value, appName: e.target.value })}
          placeholder="PilatesOS"
          className="bg-[#faf9f7]/80 border-[#ede8e5]"
          aria-invalid={!!appNameError}
          aria-describedby={appNameError ? 'appName-error' : undefined}
        />
        {appNameError && (
          <p id="appName-error" className="text-xs text-[#c45c4a]">{appNameError}</p>
        )}
      </div>

      <div className="space-y-3">
        <Label>Primary brand color</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...value, primaryColor: color })}
              className={[
                'size-8 rounded-full border-2 transition-all',
                value.primaryColor.toLowerCase() === color.toLowerCase()
                  ? 'border-[#4e2b22] scale-110'
                  : 'border-transparent hover:scale-105',
              ].join(' ')}
              style={{ backgroundColor: color }}
              aria-label={`Select brand color ${color}`}
              aria-pressed={value.primaryColor.toLowerCase() === color.toLowerCase()}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            id="primaryColor"
            type="color"
            value={isValidHex ? value.primaryColor : '#4e2b22'}
            onChange={(e) => onChange({ ...value, primaryColor: e.target.value })}
            className="size-10 rounded-lg border border-[#ede8e5] p-1"
          />
          <Input
            value={value.primaryColor}
            onChange={(e) => onChange({ ...value, primaryColor: e.target.value })}
            placeholder="#4e2b22"
            className="flex-1 bg-[#faf9f7]/80 border-[#ede8e5]"
            aria-invalid={!!primaryColorError}
            aria-describedby={primaryColorError ? 'primaryColor-error' : undefined}
          />
        </div>
        {(primaryColorError || !isValidHex) && (
          <p id="primaryColor-error" className="text-xs text-[#c45c4a]">
            {primaryColorError || 'Please enter a valid hex color like #4e2b22.'}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="logoUrl">Logo URL (optional)</Label>
        <Input
          id="logoUrl"
          type="url"
          value={value.logoUrl ?? ''}
          onChange={(e) => onChange({ ...value, logoUrl: e.target.value })}
          placeholder="https://..."
          className="bg-[#faf9f7]/80 border-[#ede8e5]"
          aria-invalid={!!logoUrlError}
          aria-describedby={logoUrlError ? 'logoUrl-error' : undefined}
        />
        {logoUrlError && (
          <p id="logoUrl-error" className="text-xs text-[#c45c4a]">{logoUrlError}</p>
        )}
        {!logoUrlError && (
          <p className="text-xs text-[#8b6b5c]">Recommended: square PNG or SVG on a transparent background.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="faviconUrl">Favicon URL (optional)</Label>
        <Input
          id="faviconUrl"
          type="url"
          value={value.faviconUrl ?? ''}
          onChange={(e) => onChange({ ...value, faviconUrl: e.target.value })}
          placeholder="https://..."
          className="bg-[#faf9f7]/80 border-[#ede8e5]"
          aria-invalid={!!faviconUrlError}
          aria-describedby={faviconUrlError ? 'faviconUrl-error' : undefined}
        />
        {faviconUrlError && (
          <p id="faviconUrl-error" className="text-xs text-[#c45c4a]">{faviconUrlError}</p>
        )}
      </div>

      {/* Live preview */}
      <div
        className="rounded-2xl border border-[#ede8e5] p-6 text-center transition-colors"
        style={{ backgroundColor: `${value.primaryColor}10`, borderColor: `${value.primaryColor}30` }}
      >
        <h3 className="text-lg font-bold" style={{ color: value.primaryColor }}>
          {value.appName}
        </h3>
        <p className="mt-1 text-sm text-[#6b3d32]">Preview of your branded header</p>
      </div>
    </div>
  );
}
