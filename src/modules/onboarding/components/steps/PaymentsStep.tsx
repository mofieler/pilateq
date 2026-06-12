'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PAYMENT_PROVIDERS } from '@/lib/plugins/payment-providers';
import type { StudioConfig, PaymentProvider, PaymentProviderConfig } from '@/lib/studio';
import type { StepFieldErrors } from '../OnboardingWizard';

const PAYMENT_PLUGINS = PAYMENT_PROVIDERS;

const CREDENTIAL_FIELDS: Record<string, { label: string; type: string; key: string }[]> = {
  stripe: [
    { label: 'Secret key', type: 'password', key: 'secretKey' },
    { label: 'Publishable key', type: 'text', key: 'publishableKey' },
    { label: 'Webhook secret', type: 'password', key: 'webhookSecret' },
  ],
};

function normalizeProviderConfig(
  key: PaymentProvider,
  existing?: PaymentProviderConfig
): PaymentProviderConfig {
  const plugin = PAYMENT_PLUGINS.find((p) => p.key === key);
  return {
    provider: key,
    enabled: false,
    displayName: plugin?.displayName ?? key,
    credentials: {},
    supportedCurrencies: ['EUR'],
    manualConfirmation: ['pay_at_studio', 'bank_transfer', 'cash'].includes(key),
    ...existing,
  };
}

export interface PaymentsStepProps {
  value: StudioConfig['paymentProviders'];
  onChange: (value: StudioConfig['paymentProviders']) => void;
  errors?: StepFieldErrors;
}

export function PaymentsStep({ value, onChange, errors = {} }: PaymentsStepProps) {
  const providers: PaymentProviderConfig[] = PAYMENT_PLUGINS.map((plugin) => {
    const existing = value.find((p) => p.provider === plugin.key);
    return normalizeProviderConfig(plugin.key as PaymentProvider, existing);
  });

  const generalError = errors[''];

  function updateProvider(index: number, patch: Partial<PaymentProviderConfig>) {
    const next = [...providers];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function updateCredential(index: number, key: string, credentialValue: string) {
    const next = [...providers];
    next[index] = {
      ...next[index],
      credentials: { ...next[index].credentials, [key]: credentialValue },
    };
    onChange(next);
  }

  const enabledCount = providers.filter((p) => p.enabled).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#8b6b5c]">
        Select how students can pay. Manual methods work immediately; Stripe needs your API keys.
      </p>

      {providers.map((provider, index) => {
        const plugin = PAYMENT_PLUGINS.find((p) => p.key === provider.provider);
        const fields = CREDENTIAL_FIELDS[provider.provider] ?? [];

        return (
          <div
            key={provider.provider}
            className={[
              'rounded-xl border p-4 transition-colors',
              provider.enabled
                ? 'border-[#4e2b22]/20 bg-[#4e2b22]/5'
                : 'border-[#ede8e5] bg-white',
            ].join(' ')}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor={`payment-${provider.provider}`} className="font-semibold text-[#4e2b22] cursor-pointer">
                  {provider.displayName ?? plugin?.displayName}
                </Label>
                <p className="text-xs text-[#8b6b5c]">{plugin?.description}</p>
              </div>
              <Switch
                id={`payment-${provider.provider}`}
                checked={provider.enabled}
                onCheckedChange={(checked) => updateProvider(index, { enabled: checked })}
                aria-label={`Enable ${provider.displayName}`}
              />
            </div>

            {provider.enabled && fields.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-[#ede8e5]/80 pt-4">
                {fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={`${provider.provider}-${field.key}`} className="text-xs font-medium text-[#6b3d32]">
                      {field.label}
                    </Label>
                    <Input
                      id={`${provider.provider}-${field.key}`}
                      type={field.type}
                      value={(provider.credentials[field.key] as string) ?? ''}
                      onChange={(e) => updateCredential(index, field.key, e.target.value)}
                      placeholder={field.type === 'password' ? '••••••••' : ''}
                      className="bg-[#faf9f7]/80 border-[#ede8e5]"
                    />
                  </div>
                ))}
                <p className="text-xs text-[#8b6b5c]">
                  Credentials are encrypted before storage.
                </p>
              </div>
            )}

            {provider.enabled && provider.manualConfirmation && (
              <p className="mt-3 text-xs text-[#6b3d32]">
                You will confirm these payments manually in the admin area.
              </p>
            )}
          </div>
        );
      })}

      {(enabledCount === 0 || generalError) && (
        <p className="rounded-xl border border-[#d4a574]/30 bg-[#d4a574]/10 p-4 text-sm text-[#6b3d32]">
          {generalError || 'Select at least one payment method. You can start with pay-at-studio or bank transfer.'}
        </p>
      )}
    </div>
  );
}
