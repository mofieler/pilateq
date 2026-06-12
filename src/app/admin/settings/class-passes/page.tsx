'use client';

import { useState, useTransition } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { SettingsCard } from '@/modules/admin/settings/components/SettingsCard';
import { saveStudioSettingsAction } from '@/modules/admin/settings/actions/settings.actions';
import { useStudioConfig } from '@/lib/studio';
import { toast } from 'sonner';
import { CLASSPASS_PROVIDERS } from '@/lib/plugins/classpass-providers';
import type { AccessProvider, AccessProviderConfig } from '@/lib/studio';

const CLASSPASS_PLUGINS = CLASSPASS_PROVIDERS;

function normalizeAccessProvider(
  key: AccessProvider,
  existing?: AccessProviderConfig,
  priority?: number
): AccessProviderConfig {
  const plugin = CLASSPASS_PLUGINS.find((p) => p.key === key);
  return {
    provider: key,
    enabled: false,
    displayName: plugin?.displayName ?? key,
    config: { maxSpotsPerClass: 2 },
    priority: priority ?? 30,
    ...existing,
  };
}

export default function ClassPassesSettingsPage() {
  const initialConfig = useStudioConfig();
  const [providers, setProviders] = useState<AccessProviderConfig[]>(() => {
    const existing = initialConfig.accessProviders;
    const classPassKeys = CLASSPASS_PLUGINS.map((p) => p.key as AccessProvider);
    return classPassKeys.map((key, i) =>
      normalizeAccessProvider(key, existing.find((p) => p.provider === key), 30 + i * 10)
    );
  });
  const [isPending, startTransition] = useTransition();

  function updateProvider(index: number, patch: Partial<AccessProviderConfig>) {
    setProviders((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function updateConfig(index: number, key: string, value: unknown) {
    setProviders((current) => {
      const next = [...current];
      next[index] = {
        ...next[index],
        config: { ...next[index].config, [key]: value },
      };
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      try {
        // Merge class pass providers with existing access providers (credit system, memberships).
        const existingNonClassPass = initialConfig.accessProviders.filter(
          (p) => !CLASSPASS_PLUGINS.some((cp) => cp.key === p.provider)
        );
        await saveStudioSettingsAction({
          accessProviders: [...existingNonClassPass, ...providers],
        });
        toast.success('Class pass settings saved');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save');
      }
    });
  }

  return (
    <SettingsCard
      title="Class Pass Partners"
      description="Accept students from external fitness platforms. Configure spots and credentials."
      onSave={handleSave}
      isPending={isPending}
    >
      <div className="space-y-6">
        {providers.map((provider, index) => {
          const plugin = CLASSPASS_PLUGINS.find((p) => p.key === provider.provider);
          return (
            <div
              key={provider.provider}
              className="rounded-lg border border-[#ede8e5] p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#4e2b22]">
                    {provider.displayName ?? plugin?.displayName}
                  </p>
                  <p className="text-sm text-[#8b6b5c]">{plugin?.description}</p>
                </div>
                <Switch
                  checked={provider.enabled}
                  onCheckedChange={(checked) => updateProvider(index, { enabled: checked })}
                  aria-label={`Enable ${provider.displayName}`}
                />
              </div>

              {provider.enabled && (
                <div className="mt-4 grid gap-4 border-t border-[#ede8e5] pt-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${provider.provider}-spots`}>Max spots per class</Label>
                    <Input
                      id={`${provider.provider}-spots`}
                      type="number"
                      min={0}
                      value={(provider.config.maxSpotsPerClass as number) ?? 0}
                      onChange={(e) =>
                        updateConfig(index, 'maxSpotsPerClass', parseInt(e.target.value, 10) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${provider.provider}-priority`}>Priority</Label>
                    <Input
                      id={`${provider.provider}-priority`}
                      type="number"
                      min={0}
                      value={provider.priority}
                      onChange={(e) =>
                        updateProvider(index, { priority: parseInt(e.target.value, 10) || 0 })
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
