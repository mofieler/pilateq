'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Sparkles, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { claimStudioAction } from '@/modules/onboarding/actions/claimStudio.actions';
import { validateInviteTokenAction } from '@/modules/superadmin/actions/invite.actions';
import { PasswordStrengthMeter, getPasswordStrength } from '@/components/shared/PasswordStrengthMeter';
import { AuthShell } from '@/components/shared/AuthShell';

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export default function StartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawInviteToken = searchParams.get('invite') ?? '';

  const [formData, setFormData] = useState({
    studioName: '',
    studioSlug: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [inviteError, setInviteError] = useState('');
  const [inviteEmailBound, setInviteEmailBound] = useState(false);
  const [inviteSlugBound, setInviteSlugBound] = useState(false);

  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN;
  const previewUrl = useMemo(() => {
    if (!formData.studioSlug) return '';
    if (platformDomain) {
      return `https://${formData.studioSlug}.${platformDomain}`;
    }
    return `https://pilatesos.com/s/${formData.studioSlug}`;
  }, [formData.studioSlug, platformDomain]);

  function updateField(name: keyof typeof formData, value: string) {
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'studioName' && (!touched.studioSlug || prev.studioSlug === sanitizeSlug(prev.studioName))) {
        next.studioSlug = sanitizeSlug(value);
      }
      if (name === 'studioSlug') {
        next.studioSlug = sanitizeSlug(value);
      }
      return next;
    });
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  const validateInvite = useCallback(async (token: string) => {
    if (!token) {
      setInviteStatus('idle');
      return;
    }
    setInviteStatus('validating');
    setInviteError('');
    try {
      const result = await validateInviteTokenAction(token);
      if (!result.success) {
        setInviteStatus('invalid');
        setInviteError(result.error ?? 'Invite link is not valid.');
        return;
      }
      setInviteStatus('valid');
      if (result.email) {
        setFormData((prev) => ({ ...prev, adminEmail: result.email! }));
        setInviteEmailBound(true);
      }
      if (result.studioSlug) {
        setFormData((prev) => ({ ...prev, studioSlug: result.studioSlug! }));
        setInviteSlugBound(true);
      }
    } catch {
      setInviteStatus('invalid');
      setInviteError('Could not verify invite link. Please try again.');
    }
  }, []);

  useEffect(() => {
    validateInvite(rawInviteToken);
  }, [rawInviteToken, validateInvite]);

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};

    if (!formData.studioName.trim()) {
      nextErrors.studioName = 'Studio name is required';
    } else if (formData.studioName.length > 120) {
      nextErrors.studioName = 'Studio name must be 120 characters or less';
    }

    if (!formData.studioSlug.trim()) {
      nextErrors.studioSlug = 'Studio slug is required';
    } else if (!/^[a-z0-9-]+$/.test(formData.studioSlug)) {
      nextErrors.studioSlug = 'Only lowercase letters, numbers, and hyphens allowed';
    } else if (formData.studioSlug.length > 63) {
      nextErrors.studioSlug = 'Slug must be 63 characters or less';
    }

    const email = formData.adminEmail.trim().toLowerCase();
    if (!email) {
      nextErrors.adminEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.adminEmail = 'Please enter a valid email address';
    }

    if (!formData.adminPassword) {
      nextErrors.adminPassword = 'Password is required';
    } else {
      if (formData.adminPassword.length < 8) nextErrors.adminPassword = 'Password must be at least 8 characters';
      else if (!/[a-zA-Z]/.test(formData.adminPassword)) {
        nextErrors.adminPassword = 'Password must contain at least one letter';
      } else if (!/[0-9]/.test(formData.adminPassword)) {
        nextErrors.adminPassword = 'Password must contain at least one number';
      }
    }

    if (formData.adminPassword !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setTouched({
      studioName: true,
      studioSlug: true,
      adminEmail: true,
      adminPassword: true,
      confirmPassword: true,
    });

    if (!validate()) return;

    setLoading(true);
    try {
      const result = await claimStudioAction({
        studioName: formData.studioName.trim(),
        studioSlug: formData.studioSlug.trim(),
        adminEmail: formData.adminEmail.trim().toLowerCase(),
        adminPassword: formData.adminPassword,
        confirmPassword: formData.confirmPassword,
        inviteToken: rawInviteToken || undefined,
      });

      if (!result.success) {
        setError(result.error ?? 'Something went wrong. Please try again.');
        return;
      }

      router.push('/verify-email');
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell maxWidthClass="max-w-xl" disableOuterCard>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-[#4e2b22]/10">
          <Sparkles className="size-8 text-[#4e2b22]" />
        </div>
        <h1 className="text-3xl font-bold text-[#4e2b22] sm:text-4xl">Claim your studio</h1>
        <p className="mt-2 text-[#6b3d32]">
          Create your PilatesOS studio and become the admin in minutes.
        </p>
      </div>

      <Card className="border-[#ede8e5] bg-white/80 shadow-[0_4px_20px_rgba(78,43,34,0.04)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#4e2b22]">
              <Building2 className="size-5" />
              Studio details
            </CardTitle>
            <CardDescription className="text-[#8b6b5c]">
              You can change everything later in Studio Settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {inviteStatus === 'validating' && (
                <p className="text-sm text-[#6b3d32] bg-[#c4a88a]/10 p-3 rounded-xl border border-[#c4a88a]/20">
                  Checking your invite link…
                </p>
              )}
              {inviteStatus === 'invalid' && (
                <p role="alert" className="text-sm text-[#c45c4a] bg-[#c45c4a]/10 p-3 rounded-xl border border-[#c45c4a]/20">
                  {inviteError || 'This invite link is not valid or has expired.'}
                </p>
              )}
              {inviteStatus === 'valid' && (
                <p className="text-sm text-[#2d6a2d] bg-[#f0faf0] p-3 rounded-xl border border-[#b2dfb2]">
                  ✓ Invite accepted. Complete the form below to create your studio.
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="studioName" className="text-[#4e2b22]">
                  Studio name
                </Label>
                <Input
                  id="studioName"
                  value={formData.studioName}
                  onChange={(e) => updateField('studioName', e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, studioName: true }))}
                  placeholder="e.g. My Pilates Studio"
                  disabled={loading}
                  className="bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] focus:ring-[#c4a88a]/20 rounded-xl"
                  aria-invalid={!!errors.studioName}
                />
                {errors.studioName && <p className="text-xs text-[#c45c4a]">{errors.studioName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="studioSlug" className="text-[#4e2b22]">
                  Studio slug / subdomain
                </Label>
                <Input
                  id="studioSlug"
                  value={formData.studioSlug}
                  onChange={(e) => updateField('studioSlug', e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, studioSlug: true }))}
                  placeholder="my-studio"
                  disabled={loading || inviteSlugBound}
                  className="bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] focus:ring-[#c4a88a]/20 rounded-xl"
                  aria-invalid={!!errors.studioSlug}
                />
                {errors.studioSlug ? (
                  <p className="text-xs text-[#c45c4a]">{errors.studioSlug}</p>
                ) : previewUrl ? (
                  <p className="text-xs text-[#8b6b5c]">Your studio will be reachable at {previewUrl}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminEmail" className="text-[#4e2b22]">
                  Admin email
                </Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => updateField('adminEmail', e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, adminEmail: true }))}
                  placeholder="you@example.com"
                  disabled={loading || inviteEmailBound}
                  className="bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] focus:ring-[#c4a88a]/20 rounded-xl"
                  aria-invalid={!!errors.adminEmail}
                />
                {errors.adminEmail && <p className="text-xs text-[#c45c4a]">{errors.adminEmail}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminPassword" className="text-[#4e2b22]">
                  Admin password
                </Label>
                <div className="relative">
                  <Input
                    id="adminPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.adminPassword}
                    onChange={(e) => updateField('adminPassword', e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, adminPassword: true }))}
                    placeholder="••••••••"
                    disabled={loading}
                    className="bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] focus:ring-[#c4a88a]/20 rounded-xl pr-10"
                    aria-invalid={!!errors.adminPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md text-[#8b6b5c] hover:text-[#4e2b22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
                  </button>
                </div>
                <PasswordStrengthMeter password={formData.adminPassword} />
                {errors.adminPassword && <p className="text-xs text-[#c45c4a]">{errors.adminPassword}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-[#4e2b22]">
                  Confirm password
                </Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
                  placeholder="••••••••"
                  disabled={loading}
                  className="bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] focus:ring-[#c4a88a]/20 rounded-xl"
                  aria-invalid={!!errors.confirmPassword}
                />
                {errors.confirmPassword && <p className="text-xs text-[#c45c4a]">{errors.confirmPassword}</p>}
              </div>

              {error && (
                <p role="alert" className="text-sm text-[#c45c4a] bg-[#c45c4a]/10 p-3 rounded-xl border border-[#c45c4a]/20">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="boutique"
                className="w-full min-h-[44px]"
                disabled={loading || inviteStatus === 'invalid' || !getPasswordStrength(formData.adminPassword).isValid}
              >
                {loading ? 'Creating your studio…' : 'Create my studio'}
              </Button>

              <p className="text-center text-xs text-[#8b6b5c]">
                By creating a studio you agree to our{' '}
                <a href="/agb" className="text-[#4e2b22] hover:text-[#6b3d32] underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/datenschutz" className="text-[#4e2b22] hover:text-[#6b3d32] underline">
                  Privacy Policy
                </a>
                .
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-[#8b6b5c]">
          Already have a studio?{' '}
          <a href="/login" className="text-[#4e2b22] font-semibold hover:text-[#6b3d32] transition-colors">
            Sign in
          </a>
        </p>
    </AuthShell>
  );
}
