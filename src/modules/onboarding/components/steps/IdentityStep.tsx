'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { StudioConfig } from '@/lib/studio';
import type { StepFieldErrors } from '../OnboardingWizard';

export interface IdentityStepProps {
  value: StudioConfig['identity'];
  onChange: (value: StudioConfig['identity']) => void;
  onBlur?: () => void;
  errors?: StepFieldErrors;
  platformDomain?: string;
}

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export function IdentityStep({ value, onChange, onBlur, errors = {}, platformDomain }: IdentityStepProps) {
  const previewUrl = useMemo(() => {
    if (!value.slug) return '';
    if (platformDomain) {
      return `https://${value.slug}.${platformDomain}`;
    }
    return `https://pilatesos.com/s/${value.slug}`;
  }, [value.slug, platformDomain]);

  const slugError = errors.slug ?? (value.slug && !/^[a-z0-9-]+$/.test(value.slug)
    ? 'Only lowercase letters, numbers and hyphens allowed.'
    : undefined);
  const nameError = errors.name;
  const emailError = errors.email;
  const countryError = errors.country;
  const websiteError = errors.website;
  const phoneError = errors.phone;

  return (
    <div className="space-y-5" onBlur={onBlur}>
      <div className="space-y-2">
        <Label htmlFor="studioName">Studio name</Label>
        <Input
          id="studioName"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="e.g. My Pilates Studio"
          className="bg-[#faf9f7]/80 border-[#ede8e5]"
          aria-invalid={!!nameError}
          aria-describedby={nameError ? 'name-error' : undefined}
        />
        {nameError && (
          <p id="name-error" className="text-xs text-[#c45c4a]">{nameError}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="studioSlug">Subdomain / slug</Label>
        <Input
          id="studioSlug"
          value={value.slug}
          onChange={(e) => onChange({ ...value, slug: sanitizeSlug(e.target.value) })}
          placeholder="my-studio"
          className="bg-[#faf9f7]/80 border-[#ede8e5]"
          aria-invalid={!!slugError}
          aria-describedby={slugError ? 'slug-error' : undefined}
        />
        {slugError ? (
          <p id="slug-error" className="text-xs text-[#c45c4a]">{slugError}</p>
        ) : previewUrl ? (
          <p className="text-xs text-[#8b6b5c]">Your studio will be reachable at {previewUrl}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="studioEmail">Contact email</Label>
        <Input
          id="studioEmail"
          type="email"
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          placeholder="hello@yourstudio.com"
          className="bg-[#faf9f7]/80 border-[#ede8e5]"
          aria-invalid={!!emailError}
          aria-describedby={emailError ? 'email-error' : undefined}
        />
        {emailError && (
          <p id="email-error" className="text-xs text-[#c45c4a]">{emailError}</p>
        )}
        {!emailError && (
          <p className="text-xs text-[#8b6b5c]">Used for booking confirmations and invoices.</p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="legalName">Legal name</Label>
          <Input
            id="legalName"
            value={value.legalName ?? ''}
            onChange={(e) => onChange({ ...value, legalName: e.target.value })}
            placeholder="e.g. My Pilates Studio GmbH"
            className="bg-[#faf9f7]/80 border-[#ede8e5]"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Street address</Label>
          <Input
            id="address"
            value={value.address ?? ''}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
            placeholder="Musterstraße 12"
            className="bg-[#faf9f7]/80 border-[#ede8e5]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input
            id="postalCode"
            value={value.postalCode ?? ''}
            onChange={(e) => onChange({ ...value, postalCode: e.target.value })}
            placeholder="10115"
            className="bg-[#faf9f7]/80 border-[#ede8e5]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={value.city ?? ''}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            placeholder="Berlin"
            className="bg-[#faf9f7]/80 border-[#ede8e5]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={value.country ?? ''}
            maxLength={2}
            onChange={(e) => onChange({ ...value, country: e.target.value.toUpperCase() })}
            placeholder="DE"
            className="bg-[#faf9f7]/80 border-[#ede8e5]"
            aria-invalid={!!countryError}
            aria-describedby={countryError ? 'country-error' : undefined}
          />
          {countryError && (
            <p id="country-error" className="text-xs text-[#c45c4a]">{countryError}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={value.phone ?? ''}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
            placeholder="+49 30 12345678"
            className="bg-[#faf9f7]/80 border-[#ede8e5]"
            aria-invalid={!!phoneError}
            aria-describedby={phoneError ? 'phone-error' : undefined}
          />
          {phoneError && (
            <p id="phone-error" className="text-xs text-[#c45c4a]">{phoneError}</p>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="taxNumber">Tax number</Label>
          <Input
            id="taxNumber"
            value={value.taxNumber ?? ''}
            onChange={(e) => onChange({ ...value, taxNumber: e.target.value })}
            placeholder="123 456 789"
            className="bg-[#faf9f7]/80 border-[#ede8e5]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="taxAuthority">Tax authority</Label>
          <Input
            id="taxAuthority"
            value={value.taxAuthority ?? ''}
            onChange={(e) => onChange({ ...value, taxAuthority: e.target.value })}
            placeholder="Finanzamt Berlin"
            className="bg-[#faf9f7]/80 border-[#ede8e5]"
          />
        </div>
      </div>
    </div>
  );
}
