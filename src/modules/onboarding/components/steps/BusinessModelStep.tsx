'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { StudioConfig, BusinessModel } from '@/lib/studio';
import { CreditCard, Package, Ticket, Coins, Gift, Users } from 'lucide-react';
import type { StepFieldErrors } from '../OnboardingWizard';

const MODELS: { key: BusinessModel; label: string; description: string; icon: React.ElementType }[] = [
  {
    key: 'credits',
    label: 'Credit System',
    description: 'Students buy credits and spend them per class. Great for flexible attendance.',
    icon: Coins,
  },
  {
    key: 'session_packages',
    label: 'Session Packages',
    description: 'Fixed private or duo session bundles, e.g. 10 one-to-one sessions.',
    icon: Package,
  },
  {
    key: 'memberships',
    label: 'Memberships',
    description: 'Recurring subscriptions with weekly credit grants or unlimited access.',
    icon: Users,
  },
  {
    key: 'class_passes',
    label: 'Class Pass Partners',
    description: 'Accept external partners such as Wellpass, Urban Sports Club or ClassPass.',
    icon: Ticket,
  },
  {
    key: 'drop_in',
    label: 'Drop-in / Pay-per-class',
    description: 'Students pay a single price for each class without buying a package.',
    icon: CreditCard,
  },
  {
    key: 'free',
    label: 'Free / Invite-only',
    description: 'No payment required. Useful for internal or community classes.',
    icon: Gift,
  },
];

export interface BusinessModelStepProps {
  value: StudioConfig['enabledBusinessModels'];
  onChange: (value: StudioConfig['enabledBusinessModels']) => void;
  errors?: StepFieldErrors;
}

export function BusinessModelStep({ value, onChange, errors = {} }: BusinessModelStepProps) {
  const generalError = errors[''];

  function toggleModel(model: BusinessModel) {
    onChange(
      value.includes(model)
        ? value.filter((m) => m !== model)
        : [...value, model]
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#8b6b5c]">
        Choose how students can book and pay. You can enable multiple models and change this later.
      </p>

      {MODELS.map((model) => {
        const enabled = value.includes(model.key);
        const Icon = model.icon;
        return (
          <div
            key={model.key}
            className={[
              'flex items-start gap-4 rounded-xl border p-4 transition-colors',
              enabled
                ? 'border-[#4e2b22]/20 bg-[#4e2b22]/5'
                : 'border-[#ede8e5] bg-white hover:border-[#c4a88a]/50',
            ].join(' ')}
          >
            <div
              className={[
                'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg',
                enabled ? 'bg-[#4e2b22]/10 text-[#4e2b22]' : 'bg-[#ede8e5]/60 text-[#8b6b5c]',
              ].join(' ')}
            >
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor={`model-${model.key}`} className="font-semibold text-[#4e2b22] cursor-pointer">
                  {model.label}
                </Label>
                <Switch
                  id={`model-${model.key}`}
                  checked={enabled}
                  onCheckedChange={() => toggleModel(model.key)}
                  aria-label={`Enable ${model.label}`}
                />
              </div>
              <p className="mt-1 text-sm text-[#8b6b5c]">{model.description}</p>
            </div>
          </div>
        );
      })}

      {(value.length === 0 || generalError) && (
        <p className="rounded-xl border border-[#d4a574]/30 bg-[#d4a574]/10 p-4 text-sm text-[#6b3d32]">
          {generalError || 'Select at least one business model so students know how to book.'}
        </p>
      )}
    </div>
  );
}
