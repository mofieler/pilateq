'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CLASS_TYPES, type ClassType } from '@/lib/config/class-types';
import type { StudioConfig } from '@/lib/studio';
import type { StepFieldErrors } from '../OnboardingWizard';

export interface ClassCatalogStepProps {
  value: StudioConfig['classTypes'];
  onChange: (value: StudioConfig['classTypes']) => void;
  errors?: StepFieldErrors;
}

export function ClassCatalogStep({ value, onChange, errors = {} }: ClassCatalogStepProps) {
  const generalError = errors[''];

  function updateClassType(key: ClassType, patch: Partial<StudioConfig['classTypes'][string]>) {
    const current = value[key] ?? {
      enabled: false,
      defaultDurationMinutes: CLASS_TYPES[key].defaultDuration,
      defaultCapacity: CLASS_TYPES[key].defaultCapacity,
    };
    onChange({ ...value, [key]: { ...current, ...patch } });
  }

  const enabledCount = Object.values(value).filter((v) => v?.enabled).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#8b6b5c]">
        Activate the class types you actually offer. Defaults are pre-filled — just turn on what you teach.
      </p>

      {Object.entries(CLASS_TYPES).map(([key, config]) => {
        const classTypeKey = key as ClassType;
        const override = value[classTypeKey] ?? {
          enabled: false,
          defaultDurationMinutes: config.defaultDuration,
          defaultCapacity: config.defaultCapacity,
        };
        const enabled = override.enabled ?? false;

        return (
          <div
            key={key}
            className={[
              'rounded-xl border p-4 transition-colors',
              enabled
                ? 'border-[#4e2b22]/20 bg-[#4e2b22]/5'
                : 'border-[#ede8e5] bg-white',
            ].join(' ')}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor={`class-${key}`} className="font-semibold text-[#4e2b22] cursor-pointer">
                  {config.label}
                </Label>
                <p className="text-xs text-[#8b6b5c]">{config.description}</p>
              </div>
              <Switch
                id={`class-${key}`}
                checked={enabled}
                onCheckedChange={(checked) => updateClassType(classTypeKey, { enabled: checked })}
                aria-label={`Enable ${config.label}`}
              />
            </div>

            {enabled && (
              <div className="mt-4 grid gap-4 border-t border-[#ede8e5]/80 pt-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${key}-duration`} className="text-xs font-medium text-[#6b3d32]">
                    Default duration (min)
                  </Label>
                  <Input
                    id={`${key}-duration`}
                    type="number"
                    min={5}
                    value={override.defaultDurationMinutes ?? config.defaultDuration}
                    onChange={(e) =>
                      updateClassType(classTypeKey, {
                        defaultDurationMinutes: parseInt(e.target.value, 10) || config.defaultDuration,
                      })
                    }
                    className="bg-[#faf9f7]/80 border-[#ede8e5]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${key}-capacity`} className="text-xs font-medium text-[#6b3d32]">
                    Default capacity
                  </Label>
                  <Input
                    id={`${key}-capacity`}
                    type="number"
                    min={1}
                    value={override.defaultCapacity ?? config.defaultCapacity}
                    onChange={(e) =>
                      updateClassType(classTypeKey, {
                        defaultCapacity: parseInt(e.target.value, 10) || config.defaultCapacity,
                      })
                    }
                    className="bg-[#faf9f7]/80 border-[#ede8e5]"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {(enabledCount === 0 || generalError) && (
        <p className="rounded-xl border border-[#d4a574]/30 bg-[#d4a574]/10 p-4 text-sm text-[#6b3d32]">
          {generalError || 'Enable at least one class type so your schedule is visible to students.'}
        </p>
      )}
    </div>
  );
}
