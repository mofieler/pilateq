'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resetPasswordAction } from '@/modules/users/actions/reset-password.action';
import { PasswordStrengthMeter, getPasswordStrength } from '@/components/shared/PasswordStrengthMeter';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    const identifierParam = searchParams.get('identifier');

    if (!tokenParam || !identifierParam) {
      router.push('/forgot-password');
      return;
    }

    setToken(tokenParam);
    setIdentifier(identifierParam);
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token || !identifier) {
      setError('Invalid reset link');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const result = await resetPasswordAction({
        token,
        identifier,
        password,
        confirmPassword,
      });

      if (!result.success) {
        if (result.error === 'expired') {
          setError('This reset link has expired. Please request a new one.');
        } else {
          setError(result.error || 'Something went wrong. Please try again.');
        }
        return;
      }

      router.push('/login?reset=true');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !identifier) {
    return (
      <div className="text-center py-8">
        <p className="text-[#6b3d32]">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="password" className="text-[#4e2b22] font-medium">
            New password
          </Label>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              className="bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] focus:ring-[#c4a88a]/20 rounded-xl pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b6b5c] hover:text-[#4e2b22] transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeSlashIcon className="size-5" /> : <EyeIcon className="size-5" />}
            </button>
          </div>
          <PasswordStrengthMeter password={password} />
        </div>

        <div>
          <Label htmlFor="confirmPassword" className="text-[#4e2b22] font-medium">
            Confirm password
          </Label>
          <div className="relative mt-1.5">
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
              className="bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] focus:ring-[#c4a88a]/20 rounded-xl pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b6b5c] hover:text-[#4e2b22] transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeSlashIcon className="size-5" /> : <EyeIcon className="size-5" />}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-[#c45c4a] bg-[#c45c4a]/10 p-3 rounded-xl">{error}</p>}

        <Button
          type="submit"
          variant="boutique"
          className="w-full"
          disabled={loading || !getPasswordStrength(password).isValid}
        >
          {loading ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>

      <p className="text-sm text-[#8b6b5c] text-center mt-6">
        Didn&apos;t receive the email?{' '}
        <a href="/forgot-password" className="text-[#4e2b22] font-semibold hover:text-[#6b3d32] transition-colors">
          Request a new link
        </a>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-[#4e2b22] mb-1">Create a new password</h1>
        <p className="text-[#8b6b5c]">Choose a strong password</p>
      </div>

      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
