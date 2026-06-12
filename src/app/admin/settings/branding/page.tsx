'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsCard } from '@/modules/admin/settings/components/SettingsCard';
import { saveStudioSettingsAction } from '@/modules/admin/settings/actions/settings.actions';
import { useStudioConfig } from '@/lib/studio';
import { toast } from 'sonner';

export default function BrandingSettingsPage() {
  const initialConfig = useStudioConfig();
  const [branding, setBranding] = useState(initialConfig.branding);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await saveStudioSettingsAction({ branding });
        toast.success('Branding saved');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save');
      }
    });
  }

  return (
    <SettingsCard
      title="Branding"
      description="Customize how your studio appears to students."
      onSave={handleSave}
      isPending={isPending}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="appName">App name</Label>
          <Input
            id="appName"
            value={branding.appName}
            onChange={(e) => setBranding({ ...branding, appName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="primaryColor">Primary color</Label>
          <div className="flex items-center gap-3">
            <input
              id="primaryColor"
              type="color"
              value={branding.primaryColor}
              onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
              className="h-10 w-10 rounded border border-[#ede8e5] p-1"
            />
            <Input
              value={branding.primaryColor}
              onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input
            id="logoUrl"
            type="url"
            value={branding.logoUrl ?? ''}
            onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="faviconUrl">Favicon URL</Label>
          <Input
            id="faviconUrl"
            type="url"
            value={branding.faviconUrl ?? ''}
            onChange={(e) => setBranding({ ...branding, faviconUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>
      </div>
    </SettingsCard>
  );
}
