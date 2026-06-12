'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsCard } from '@/modules/admin/settings/components/SettingsCard';
import { saveStudioSettingsAction } from '@/modules/admin/settings/actions/settings.actions';
import { useStudioConfig } from '@/lib/studio';
import { toast } from 'sonner';

export default function GeneralSettingsPage() {
  const initialConfig = useStudioConfig();
  const [identity, setIdentity] = useState(initialConfig.identity);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await saveStudioSettingsAction({ identity });
        toast.success('Studio information saved');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save');
      }
    });
  }

  return (
    <SettingsCard
      title="General Information"
      description="Legal name, contact details, and tax information used on invoices and legal pages."
      onSave={handleSave}
      isPending={isPending}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="studioName">Studio name</Label>
          <Input
            id="studioName"
            value={identity.name}
            onChange={(e) => setIdentity({ ...identity, name: e.target.value })}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="legalName">Legal name</Label>
          <Input
            id="legalName"
            value={identity.legalName ?? ''}
            onChange={(e) => setIdentity({ ...identity, legalName: e.target.value })}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={identity.address ?? ''}
            onChange={(e) => setIdentity({ ...identity, address: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input
            id="postalCode"
            value={identity.postalCode ?? ''}
            onChange={(e) => setIdentity({ ...identity, postalCode: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={identity.city ?? ''}
            onChange={(e) => setIdentity({ ...identity, city: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country (ISO code)</Label>
          <Input
            id="country"
            maxLength={2}
            value={identity.country ?? ''}
            onChange={(e) => setIdentity({ ...identity, country: e.target.value.toUpperCase() })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={identity.phone ?? ''}
            onChange={(e) => setIdentity({ ...identity, phone: e.target.value })}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="email">Contact email</Label>
          <Input
            id="email"
            type="email"
            value={identity.email}
            onChange={(e) => setIdentity({ ...identity, email: e.target.value })}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            type="url"
            value={identity.website ?? ''}
            onChange={(e) => setIdentity({ ...identity, website: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxNumber">Tax number</Label>
          <Input
            id="taxNumber"
            value={identity.taxNumber ?? ''}
            onChange={(e) => setIdentity({ ...identity, taxNumber: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxAuthority">Tax authority</Label>
          <Input
            id="taxAuthority"
            value={identity.taxAuthority ?? ''}
            onChange={(e) => setIdentity({ ...identity, taxAuthority: e.target.value })}
          />
        </div>
      </div>
    </SettingsCard>
  );
}
