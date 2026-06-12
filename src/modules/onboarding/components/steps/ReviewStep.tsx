'use client';

import { Check, Building2, CreditCard, Dumbbell, Palette, BadgePercent, Rocket } from 'lucide-react';
import type { StudioConfig } from '@/lib/studio';
import { CLASS_TYPES } from '@/lib/config/class-types';

interface ReviewStepProps {
  config: StudioConfig;
}

function ReviewCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#ede8e5] bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-[#4e2b22]" />
        <h3 className="font-semibold text-[#4e2b22]">{title}</h3>
      </div>
      <div className="text-sm text-[#6b3d32]">{children}</div>
    </div>
  );
}

export function ReviewStep({ config }: ReviewStepProps) {
  const enabledClasses = Object.entries(config.classTypes)
    .filter(([, value]) => value?.enabled)
    .map(([key]) => CLASS_TYPES[key as keyof typeof CLASS_TYPES]?.label ?? key);

  const enabledPayments = config.paymentProviders.filter((p) => p.enabled).map((p) => p.displayName ?? p.provider);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#4e2b22]/10 bg-[#4e2b22]/5 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#4e2b22]/10 text-[#4e2b22]">
            <Rocket className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-[#4e2b22]">Ready to launch?</h3>
            <p className="mt-1 text-sm text-[#6b3d32]">
              Review your settings below. You can change everything later in Studio Settings.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ReviewCard title="Studio" icon={Building2}>
          <p className="font-medium text-[#4e2b22]">{config.identity.name}</p>
          <p className="text-xs text-[#8b6b5c]">{config.identity.email}</p>
          {config.identity.city && (
            <p className="mt-1 text-xs text-[#8b6b5c]">
              {config.identity.address && `${config.identity.address}, `}
              {config.identity.postalCode} {config.identity.city}
            </p>
          )}
        </ReviewCard>

        <ReviewCard title="Business Model" icon={BadgePercent}>
          {config.enabledBusinessModels.length > 0 ? (
            <ul className="space-y-1">
              {config.enabledBusinessModels.map((m) => (
                <li key={m} className="flex items-center gap-2">
                  <Check className="size-3.5 text-[#4a7c4a]" />
                  <span className="capitalize">{m.replace(/_/g, ' ')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#8b6b5c]">No business model selected</p>
          )}
        </ReviewCard>

        <ReviewCard title="Class Catalog" icon={Dumbbell}>
          {enabledClasses.length > 0 ? (
            <p>{enabledClasses.join(', ')}</p>
          ) : (
            <p className="text-[#8b6b5c]">No class types enabled</p>
          )}
        </ReviewCard>

        <ReviewCard title="Payments" icon={CreditCard}>
          {enabledPayments.length > 0 ? (
            <p>{enabledPayments.join(', ')}</p>
          ) : (
            <p className="text-[#8b6b5c]">No payment methods selected</p>
          )}
        </ReviewCard>

        <ReviewCard title="Branding" icon={Palette}>
          <div className="flex items-center gap-3">
            <div
              className="size-6 rounded-full border border-[#ede8e5]"
              style={{ backgroundColor: config.branding.primaryColor }}
            />
            <div>
              <p className="font-medium text-[#4e2b22]">{config.branding.appName}</p>
              <p className="text-xs text-[#8b6b5c]">{config.branding.primaryColor}</p>
            </div>
          </div>
        </ReviewCard>
      </div>
    </div>
  );
}
