'use client';

import { useState, useEffect, useTransition, useMemo, useCallback } from 'react';
import { OnboardingStepper } from './OnboardingStepper';
import { WelcomeStep } from './steps/WelcomeStep';
import { IdentityStep } from './steps/IdentityStep';
import { BrandingStep } from './steps/BrandingStep';
import { BusinessModelStep } from './steps/BusinessModelStep';
import { PaymentsStep } from './steps/PaymentsStep';
import { ClassCatalogStep } from './steps/ClassCatalogStep';
import { ReviewStep } from './steps/ReviewStep';
import { DEFAULT_STUDIO_CONFIG } from '@/lib/studio';
import type { StudioConfig } from '@/lib/studio';
import type { OnboardingStepInput } from '@/modules/onboarding/actions/onboarding.actions';
import {
  loadOnboardingStateAction,
  saveOnboardingStepAction,
  completeOnboardingAction,
} from '@/modules/onboarding/actions/onboarding.actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import {
  studioIdentitySchema,
  studioBrandingSchema,
  paymentProviderConfigSchema,
} from '@/lib/studio/studio.config.schema';
import { businessModelEnum } from '@/lib/studio/studio.config.schema';
import { z } from 'zod';

const STEPS = [
  { key: 'welcome', label: 'Welcome', isIntro: true },
  { key: 'identity', label: 'Studio Identity' },
  { key: 'branding', label: 'Branding' },
  { key: 'businessModel', label: 'Business Model' },
  { key: 'payments', label: 'Payments' },
  { key: 'classCatalog', label: 'Class Catalog' },
  { key: 'review', label: 'Review' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

const STEP_TO_SAVE_KEY: Record<
  Exclude<StepKey, 'welcome' | 'review'>,
  keyof OnboardingStepInput
> = {
  identity: 'identity',
  branding: 'branding',
  businessModel: 'enabledBusinessModels',
  payments: 'paymentProviders',
  classCatalog: 'classTypes',
};

export type StepFieldErrors = Record<string, string>;

function flattenZodErrors(error: z.ZodError): StepFieldErrors {
  const errors: StepFieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  }
  return errors;
}

function validateIdentityStep(identity: StudioConfig['identity']): StepFieldErrors {
  const result = studioIdentitySchema.safeParse(identity);
  if (result.success) return {};
  return flattenZodErrors(result.error);
}

function validateBrandingStep(branding: StudioConfig['branding']): StepFieldErrors {
  const result = studioBrandingSchema.safeParse(branding);
  if (result.success) return {};
  return flattenZodErrors(result.error);
}

const businessModelArraySchema = z.array(businessModelEnum).min(1, 'Select at least one business model.');

function validateBusinessModelStep(models: StudioConfig['enabledBusinessModels']): StepFieldErrors {
  const result = businessModelArraySchema.safeParse(models);
  if (result.success) return {};
  return { '': result.error.issues[0]?.message ?? 'Invalid selection.' };
}

const paymentProvidersSchema = z
  .array(paymentProviderConfigSchema)
  .refine((providers) => providers.some((p) => p.enabled), {
    message: 'Enable at least one payment method.',
  });

function validatePaymentsStep(providers: StudioConfig['paymentProviders']): StepFieldErrors {
  const result = paymentProvidersSchema.safeParse(providers);
  if (result.success) return {};
  return { '': result.error.issues[0]?.message ?? 'Invalid payment providers.' };
}

function validateClassCatalogStep(classTypes: StudioConfig['classTypes']): StepFieldErrors {
  const enabledCount = Object.values(classTypes).filter((v) => v?.enabled).length;
  if (enabledCount === 0) {
    return { '': 'Enable at least one class type.' };
  }
  return {};
}

export function OnboardingWizard() {
  const [config, setConfig] = useState<StudioConfig>(DEFAULT_STUDIO_CONFIG);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState('');
  const [seedDefaults, setSeedDefaults] = useState(true);
  const [touched, setTouched] = useState<Record<StepKey, boolean>>({
    welcome: false,
    identity: false,
    branding: false,
    businessModel: false,
    payments: false,
    classCatalog: false,
    review: false,
  });

  useEffect(() => {
    loadOnboardingStateAction().then((res) => {
      if (res.success) {
        setConfig(res.config);
        const savedStep = res.onboardingStep ?? res.config.onboardingState.currentStep ?? 'welcome';
        const stepIndex = STEPS.findIndex((s) => s.key === savedStep);
        setCurrentStep(Math.max(0, stepIndex));
      }
      setLoading(false);
    });
  }, []);

  const stepErrors = useMemo<StepFieldErrors>(() => {
    const stepKey = STEPS[currentStep].key;
    switch (stepKey) {
      case 'identity':
        return validateIdentityStep(config.identity);
      case 'branding':
        return validateBrandingStep(config.branding);
      case 'businessModel':
        return validateBusinessModelStep(config.enabledBusinessModels);
      case 'payments':
        return validatePaymentsStep(config.paymentProviders);
      case 'classCatalog':
        return validateClassCatalogStep(config.classTypes);
      case 'review':
        return {};
      default:
        return {};
    }
  }, [config, currentStep]);

  const hasStepErrors = Object.keys(stepErrors).length > 0;
  const showErrors = touched[STEPS[currentStep].key];

  function updateConfig<K extends keyof StudioConfig>(key: K, value: StudioConfig[K]) {
    setConfig((prev: StudioConfig) => ({ ...prev, [key]: value }));
  }

  const markStepTouched = useCallback(() => {
    setTouched((prev) => ({ ...prev, [STEPS[currentStep].key]: true }));
  }, [currentStep]);

  function handleNext() {
    markStepTouched();
    if (hasStepErrors) return;

    const stepKey = STEPS[currentStep].key;

    // Welcome is an intro step — just advance without saving.
    if (stepKey === 'welcome') {
      setCurrentStep((s: number) => s + 1);
      return;
    }

    const saveKey = STEP_TO_SAVE_KEY[stepKey as Exclude<StepKey, 'welcome' | 'review'>];
    const stepData = config[saveKey];
    setError('');
    startSaving(async () => {
      try {
        const result = await saveOnboardingStepAction(
          config.identity.slug,
          saveKey,
          stepData,
        );
        if (!result.success) {
          setError('Failed to save step');
          return;
        }
        if (currentStep < STEPS.length - 1) {
          setCurrentStep((s: number) => s + 1);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save step');
      }
    });
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep((s: number) => s - 1);
    }
  }

  function handleComplete() {
    setError('');
    startSaving(async () => {
      try {
        const result = await completeOnboardingAction(config.identity.slug, seedDefaults);
        if (result.success) {
          if (result.reauthRequired) {
            window.location.href = '/login?reason=onboarding';
          } else {
            window.location.href = '/admin';
          }
        } else {
          setError('Failed to complete onboarding');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to complete onboarding');
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-[#c4a88a]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <OnboardingStepper
        steps={STEPS.map((s) => ({ key: s.key, label: s.label }))}
        currentStep={currentStep}
      />
      <div className="rounded-2xl border border-[#ede8e5] bg-[#faf9f7]/90 p-6 sm:p-8 shadow-[0_4px_20px_rgba(78,43,34,0.08)]">
        {error && (
          <div className="mb-4 rounded-xl bg-[#c45c4a]/10 px-4 py-3 text-sm text-[#c45c4a]">
            {error}
          </div>
        )}
        {currentStep === 0 && <WelcomeStep />}
        {currentStep === 1 && (
          <IdentityStep
            value={config.identity}
            onChange={(v) => updateConfig('identity', v)}
            onBlur={markStepTouched}
            errors={showErrors ? stepErrors : {}}
            platformDomain={process.env.NEXT_PUBLIC_PLATFORM_DOMAIN}
          />
        )}
        {currentStep === 2 && (
          <BrandingStep
            value={config.branding}
            onChange={(v) => updateConfig('branding', v)}
            onBlur={markStepTouched}
            errors={showErrors ? stepErrors : {}}
          />
        )}
        {currentStep === 3 && (
          <BusinessModelStep
            value={config.enabledBusinessModels}
            onChange={(v) => updateConfig('enabledBusinessModels', v)}
            errors={showErrors ? stepErrors : {}}
          />
        )}
        {currentStep === 4 && (
          <PaymentsStep
            value={config.paymentProviders}
            onChange={(v) => updateConfig('paymentProviders', v)}
            errors={showErrors ? stepErrors : {}}
          />
        )}
        {currentStep === 5 && (
          <ClassCatalogStep
            value={config.classTypes}
            onChange={(v) => updateConfig('classTypes', v)}
            errors={showErrors ? stepErrors : {}}
          />
        )}
        {currentStep === 6 && <ReviewStep config={config} />}
        {currentStep === 5 && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/60 p-4">
            <Checkbox
              id="seedDefaults"
              checked={seedDefaults}
              onCheckedChange={(checked) => setSeedDefaults(checked === true)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="seedDefaults" className="cursor-pointer font-medium text-[#4e2b22]">
                Create sample classes and packages to help me get started
              </Label>
              <p className="text-sm text-[#8b6b5c]">
                We&apos;ll add a default instructor, a starter class template, two credit packages, and a sample session within the next 7 days.
              </p>
            </div>
          </div>
        )}
        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0 || saving}
            className="rounded-xl border-[#ede8e5] text-[#4e2b22]"
          >
            Back
          </Button>
          {currentStep === 0 ? (
            <Button
              onClick={handleNext}
              disabled={saving}
              className="rounded-xl bg-[#4e2b22] text-white hover:bg-[#3a1f18]"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : 'Get started'}
            </Button>
          ) : currentStep < STEPS.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={saving || (showErrors && hasStepErrors)}
              className="rounded-xl bg-[#4e2b22] text-white hover:bg-[#3a1f18]"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Next'
              )}
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={saving}
              className="rounded-xl bg-[#4e2b22] text-white hover:bg-[#3a1f18]"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Complete Onboarding'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
