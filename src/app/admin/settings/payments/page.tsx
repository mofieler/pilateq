'use client';

import { useState, useTransition } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { SettingsCard } from '@/modules/admin/settings/components/SettingsCard';
import { saveStudioSettingsAction } from '@/modules/admin/settings/actions/settings.actions';
import { useStudioConfig } from '@/lib/studio';
import { toast } from 'sonner';
import { PAYMENT_PROVIDERS } from '@/lib/plugins/payment-providers';
import type { PaymentProvider, PaymentProviderConfig } from '@/lib/studio';

const PAYMENT_PLUGINS = PAYMENT_PROVIDERS;

const CREDENTIAL_FIELDS: Record<string, { label: string; type: string }[]> = {
  stripe: [
    { label: 'Secret key', type: 'password' },
    { label: 'Publishable key', type: 'text' },
    { label: 'Webhook secret', type: 'password' },
  ],
  paypal: [
    { label: 'Client ID', type: 'text' },
    { label: 'Client secret', type: 'password' },
  ],
  sepa: [
    { label: 'Creditor ID', type: 'text' },
  ],
};

function normalizeProviderConfig(
  key: PaymentProvider,
  existing?: PaymentProviderConfig
): PaymentProviderConfig {
  return {
    provider: key,
    enabled: false,
    displayName: PAYMENT_PLUGINS.find((p) => p.key === key)?.displayName ?? key,
    credentials: {},
    supportedCurrencies: ['EUR'],
    manualConfirmation: ['pay_at_studio', 'bank_transfer', 'cash'].includes(key),
    ...existing,
  };
}

export default function PaymentsSettingsPage() {
  const initialConfig = useStudioConfig();
  const [providers, setProviders] = useState<PaymentProviderConfig[]>(() => {
    const existingKeys = new Set(initialConfig.paymentProviders.map((p) => p.provider));
    const allKeys = PAYMENT_PLUGINS.map((p) => p.key as PaymentProvider);
    return allKeys.map((key) =>
      normalizeProviderConfig(key, initialConfig.paymentProviders.find((p) => p.provider === key))
    );
  });
  const [isPending, startTransition] = useTransition();

  function updateProvider(index: number, patch: Partial<PaymentProviderConfig>) {
    setProviders((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function updateCredential(index: number, key: string, value: string) {
    setProviders((current) => {
      const next = [...current];
      next[index] = {
        ...next[index],
        credentials: { ...next[index].credentials, [key]: value },
      };
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveStudioSettingsAction({ paymentProviders: providers });
        toast.success('Payment settings saved');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save');
      }
    });
  }

  return (
    <SettingsCard
      title="Payment Providers"
      description="Choose which payment methods your studio accepts and configure credentials."
      onSave={handleSave}
      isPending={isPending}
    >
      <div className="space-y-6">
        {providers.map((provider, index) => {
          const plugin = PAYMENT_PLUGINS.find((p) => p.key === provider.provider);
          const fields = CREDENTIAL_FIELDS[provider.provider] ?? [];
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

              {provider.enabled && fields.length > 0 && (
                <div className="mt-4 grid gap-4 border-t border-[#ede8e5] pt-4">
                  {fields.map((field) => (
                    <div key={field.label} className="space-y-2">
                      <Label htmlFor={`${provider.provider}-${field.label}`}>{field.label}</Label>
                      <Input
                        id={`${provider.provider}-${field.label}`}
                        type={field.type}
                        value={provider.credentials[field.label] ?? ''}
                        onChange={(e) => updateCredential(index, field.label, e.target.value)}
                        placeholder={field.type === 'password' ? '••••••••' : ''}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SettingsCard>
  );
}
