'use client';

import { useState, useTransition } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { SettingsCard } from '@/modules/admin/settings/components/SettingsCard';
import { saveStudioSettingsAction } from '@/modules/admin/settings/actions/settings.actions';
import { useStudioConfig } from '@/lib/studio';
import { CLASS_TYPES } from '@/lib/config/class-types';
import { toast } from 'sonner';
import type { StudioClassTypeOverrideConfig } from '@/lib/studio';

export default function ClassCatalogSettingsPage() {
  const initialConfig = useStudioConfig();
  const [classTypes, setClassTypes] = useState<Record<string, StudioClassTypeOverrideConfig>>(() => {
    const defaults: Record<string, StudioClassTypeOverrideConfig> = {};
    for (const [key, config] of Object.entries(CLASS_TYPES)) {
      const existing = initialConfig.classTypes[key];
      defaults[key] = {
        enabled: existing?.enabled ?? true,
        defaultDurationMinutes: existing?.defaultDurationMinutes ?? config.defaultDuration,
        defaultCapacity: existing?.defaultCapacity ?? config.defaultCapacity,
        creditCost: existing?.creditCost,
        sessionCost: existing?.sessionCost,
        acceptedAccessProviders: existing?.acceptedAccessProviders,
      };
    }
    return defaults;
  });
  const [isPending, startTransition] = useTransition();

  function updateClassType(
    key: string,
    patch: Partial<StudioClassTypeOverrideConfig>
  ) {
    setClassTypes((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveStudioSettingsAction({ classTypes });
        toast.success('Class catalog saved');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save');
      }
    });
  }

  return (
    <SettingsCard
      title="Class Catalog"
      description="Choose which class types your studio offers and their default duration and capacity."
      onSave={handleSave}
      isPending={isPending}
    >
      <div className="space-y-6">
        {Object.entries(CLASS_TYPES).map(([key, config]) => {
          const override = classTypes[key] ?? { enabled: false };
          return (
            <div
              key={key}
              className="rounded-lg border border-[#ede8e5] p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#4e2b22]">{config.label}</p>
                  <p className="text-sm text-[#8b6b5c]">{config.description}</p>
                </div>
                <Switch
                  checked={override.enabled}
                  onCheckedChange={(checked) => updateClassType(key, { enabled: checked })}
                  aria-label={`Enable ${config.label}`}
                />
              </div>

              {override.enabled && (
                <div className="mt-4 grid gap-4 border-t border-[#ede8e5] pt-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`${key}-duration`}>Default duration (min)</Label>
                    <Input
                      id={`${key}-duration`}
                      type="number"
                      min={5}
                      value={override.defaultDurationMinutes ?? config.defaultDuration}
                      onChange={(e) =>
                        updateClassType(key, {
                          defaultDurationMinutes: parseInt(e.target.value, 10) || config.defaultDuration,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${key}-capacity`}>Default capacity</Label>
                    <Input
                      id={`${key}-capacity`}
                      type="number"
                      min={1}
                      value={override.defaultCapacity ?? config.defaultCapacity}
                      onChange={(e) =>
                        updateClassType(key, {
                          defaultCapacity: parseInt(e.target.value, 10) || config.defaultCapacity,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${key}-credit-cost`}>Credit cost</Label>
                    <Input
                      id={`${key}-credit-cost`}
                      type="number"
                      min={0}
                      value={override.creditCost ?? ''}
                      placeholder={`Default: ${config.defaultCapacity}`}
                      onChange={(e) =>
                        updateClassType(key, {
                          creditCost: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SettingsCard>
  );
}
