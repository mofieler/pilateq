'use client';

import { Check } from 'lucide-react';

export interface OnboardingStepperProps {
  steps: { key: string; label: string }[];
  currentStep: number;
}

export function OnboardingStepper({ steps, currentStep }: OnboardingStepperProps) {
  return (
    <nav aria-label="Onboarding progress" className="w-full">
      <ol className="flex items-start justify-between gap-2">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <li key={step.key} className="flex flex-1 flex-col items-center gap-2 min-w-0">
              <div className="flex w-full items-center">
                {/* Connector left */}
                {index > 0 && (
                  <div
                    className={`hidden sm:block h-0.5 flex-1 transition-colors ${
                      isCompleted ? 'bg-[#4e2b22]' : 'bg-[#ede8e5]'
                    }`}
                  />
                )}

                {/* Step circle */}
                <div
                  className={[
                    'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                    isCompleted
                      ? 'border-[#4e2b22] bg-[#4e2b22] text-white'
                      : isCurrent
                        ? 'border-[#4e2b22] bg-[#faf9f7] text-[#4e2b22]'
                        : 'border-[#ede8e5] bg-[#faf9f7] text-[#a6856f]',
                  ].join(' ')}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? <Check className="size-4" /> : index + 1}
                </div>

                {/* Connector right */}
                {index < steps.length - 1 && (
                  <div
                    className={`hidden sm:block h-0.5 flex-1 transition-colors ${
                      isCompleted ? 'bg-[#4e2b22]' : 'bg-[#ede8e5]'
                    }`}
                  />
                )}
              </div>

              <span
                className={[
                  'text-[10px] sm:text-xs font-medium text-center leading-tight',
                  isCurrent ? 'text-[#4e2b22]' : isUpcoming ? 'text-[#a6856f]' : 'text-[#6b3d32]',
                ].join(' ')}
              >
                {step.label}
                <span className="sr-only">
                  {isCompleted ? ' — completed' : isCurrent ? ' — current' : ' — upcoming'}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
