'use client';

import { useState, useTransition } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SettingsCard } from '@/modules/admin/settings/components/SettingsCard';
import { saveStudioSettingsAction } from '@/modules/admin/settings/actions/settings.actions';
import { useStudioConfig } from '@/lib/studio';
import { toast } from 'sonner';
import type { BusinessModel } from '@/lib/studio';

const MODELS: { key: BusinessModel; label: string; description: string }[] = [
  {
    key: 'credits',
    label: 'Credit System',
    description: 'Students buy credits and spend them per class.',
  },
  {
    key: 'session_packages',
    label: 'Session Packages',
    description: 'Students buy a fixed number of sessions (e.g. 10 private sessions).',
  },
  {
    key: 'memberships',
    label: 'Memberships',
    description: 'Recurring subscriptions with periodic credit grants or unlimited access.',
  },
  {
    key: 'class_passes',
    label: 'Class Passes',
    description: 'Accept external partners such as Wellpass, Urban Sports Club, ClassPass.',
  },
  {
    key: 'drop_in',
    label: 'Drop-in / Pay-per-class',
    description: 'Students pay a single price for each class.',
  },
  {
    key: 'free',
    label: 'Free / Invite-only',
    description: 'No payment required; useful for internal or community classes.',
  },
];

export default function BusinessModelSettingsPage() {
  const initialConfig = useStudioConfig();
  const [enabledModels, setEnabledModels] = useState<BusinessModel[]>(
    initialConfig.enabledBusinessModels
  );
  const [isPending, startTransition] = useTransition();

  function toggleModel(model: BusinessModel) {
    setEnabledModels((current) =>
      current.includes(model)
        ? current.filter((m) => m !== model)
        : [...current, model]
    );
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveStudioSettingsAction({ enabledBusinessModels: enabledModels });
        toast.success('Business model saved');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save');
      }
    });
  }

  return (
    <SettingsCard
      title="Business Model"
      description="Choose how students can access your classes. You can enable multiple models."
      onSave={handleSave}
      isPending={isPending}
    >
      <div className="space-y-4">
        {MODELS.map((model) => {
          const enabled = enabledModels.includes(model.key);
          return (
            <div
              key={model.key}
              className="flex items-center justify-between rounded-lg border border-[#ede8e5] p-4"
            >
              <div className="pr-4">
                <p className="font-medium text-[#4e2b22]">{model.label}</p>
                <p className="text-sm text-[#8b6b5c]">{model.description}</p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={() => toggleModel(model.key)}
                aria-label={`Enable ${model.label}`}
              />
            </div>
          );
        })}
      </div>
    </SettingsCard>
  );
}
