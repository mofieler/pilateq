'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export interface SettingsCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  onSave?: () => void | Promise<void>;
  isPending?: boolean;
  saveLabel?: string;
}

export function SettingsCard({
  title,
  description,
  children,
  onSave,
  isPending: externalPending,
  saveLabel = 'Save changes',
}: SettingsCardProps) {
  const [internalPending, startTransition] = useTransition();
  const isPending = externalPending ?? internalPending;

  function handleSave() {
    if (!onSave) return;
    startTransition(async () => {
      await onSave();
    });
  }

  return (
    <section className="rounded-xl border border-[#ede8e5] bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#4e2b22]">{title}</h2>
        {description && <p className="mt-1 text-sm text-[#8b6b5c]">{description}</p>}
      </div>

      <div className="space-y-5">{children}</div>

      {onSave && (
        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="bg-[#4e2b22] hover:bg-[#3d221b] text-white"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saveLabel}
          </Button>
        </div>
      )}
    </section>
  );
}
