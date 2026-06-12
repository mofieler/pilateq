'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction } from '@/modules/users/actions/login.action';

function roleRedirect(role: string | undefined | null): string {
  if (role === 'admin' || role === 'instructor') return '/admin';
  return '/';
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    const verified = searchParams.get('verified');
    const reset = searchParams.get('reset');
    const errorParam = searchParams.get('error');
    const reason = searchParams.get('reason');

    if (verified === 'true') {
      setInfo('Email successfully verified! You can now sign in.');
    } else if (reset === 'true') {
      setInfo('Password successfully reset! You can now sign in.');
    } else if (reason === 'idle') {
      setInfo('You have been logged out due to inactivity. Please sign in again.');
    } else if (reason === 'onboarding') {
      setInfo('Your studio is ready. Please sign in again to access your admin dashboard.');
    } else if (errorParam === 'expired_token') {
      setError('Verification link has expired. Please sign up again.');
    } else if (errorParam === 'invalid_token') {
      setError('Invalid verification link.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining]);

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (secondsRemaining > 0) return;

    setError('');
    setInfo('');
    setLoading(true);

    try {
      const result = await loginAction({ email, password });

      if (result.success) {
        router.push(roleRedirect(result.role));
        router.refresh();
        return;
      }

      // Handle structured errors
      if (result.attempts !== undefined) {
        setAttempts(result.attempts);
      }

      if (result.code === 'RATE_LIMITED') {
        const remaining = result.resetTime
          ? Math.max(0, Math.ceil((result.resetTime - Date.now()) / 1000))
          : 60;
        setSecondsRemaining(remaining);
        setError(
          `Too many attempts — please wait ${formatCountdown(remaining)} and try again.`
        );
      } else if (result.code === 'INVALID_CREDENTIALS') {
        setError(
          'Invalid email or password. If you just registered, please check your email for a verification link.'
        );
      } else if (result.code === 'EMAIL_NOT_VERIFIED') {
        setError(
          'Please verify your email address first. We have sent a verification link to your email.'
        );
      } else {
        setError(result.error || 'A technical problem occurred — please try again later.');
      }
    } catch {
      setError('A technical problem occurred — please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const activeError =
    secondsRemaining > 0
      ? `Too many attempts — please wait ${formatCountdown(secondsRemaining)} and try again.`
      : error;

  return (
    <>
      {info && (
        <p className="text-sm text-[#4a7c4a] bg-[#6b8e6b]/10 border border-[#6b8e6b]/20 p-3 rounded-xl mb-4 text-center">
          {info}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-[#faf9f7]/90 p-6 rounded-2xl border border-[#ede8e5] shadow-[0_4px_20px_rgba(78,43,34,0.08)] backdrop-blur-sm"
      >
        <div>
          <Label htmlFor="email" className="text-[#4e2b22] font-medium">
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || secondsRemaining > 0}
            required
            className="mt-1.5 bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] focus:ring-[#c4a88a]/20 rounded-xl"
          />
        </div>

        <div>
          <div className="flex justify-between items-center">
            <Label htmlFor="password" className="text-[#4e2b22] font-medium">
              Password
            </Label>
            {attempts < 3 && (
              <a
                href="/forgot-password"
                className="text-xs text-[#6b3d32] hover:text-[#4e2b22] transition-colors"
              >
                Forgot password?
              </a>
            )}
          </div>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || secondsRemaining > 0}
              required
              className="bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] focus:ring-[#c4a88a]/20 rounded-xl pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md text-[#8b6b5c] hover:text-[#4e2b22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeSlashIcon className="size-5" aria-hidden />
              ) : (
                <EyeIcon className="size-5" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {activeError && (
          <p role="alert" className="text-sm text-[#c45c4a] bg-[#c45c4a]/10 p-3 rounded-xl border border-[#c45c4a]/20">
            {activeError}
          </p>
        )}

        {attempts >= 3 && (
          <div className="bg-[#ede8e5]/80 border border-[#c4a88a] rounded-xl p-4 text-center text-sm text-[#4e2b22] mt-4">
            <p className="font-semibold mb-1 text-[#6b3d32]">Trouble signing in?</p>
            <p className="text-[#8b6b5c] text-xs mb-3">
              You have had {attempts} unsuccessful login attempts.
            </p>
            <a
              href="/forgot-password"
              className="inline-block bg-[#6b3d32] text-white text-xs px-4 py-2 rounded-lg font-medium hover:bg-[#4e2b22] transition-colors shadow-sm"
            >
              Reset password
            </a>
          </div>
        )}

        <Button
          type="submit"
          variant="boutique"
          className="w-full min-h-[44px]"
          disabled={loading || secondsRemaining > 0}
        >
          {loading
            ? 'Signing in...'
            : secondsRemaining > 0
            ? `Locked (${formatCountdown(secondsRemaining)})`
            : 'Sign In'}
        </Button>
      </form>

      {/* Google login */}
      <div className="mt-6 flex items-center">
        <div className="flex-1 border-t border-[#ede8e5]" />
        <span className="px-3 text-sm text-[#8b6b5c]">or</span>
        <div className="flex-1 border-t border-[#ede8e5]" />
      </div>

      <Button
        variant="outline"
        className="w-full min-h-[44px] mt-4 border-[#ede8e5] bg-[#faf9f7]/60 text-[#4e2b22] hover:bg-[#ede8e5]/60 rounded-xl"
        onClick={() => signIn('google', { redirect: true, redirectTo: '/' })}
        disabled={loading}
      >
        Continue with Google
      </Button>

      <p className="text-sm text-[#8b6b5c] text-center mt-6">
        Don&apos;t have an account?{' '}
        <a
          href="/register"
          className="text-[#4e2b22] font-semibold hover:text-[#6b3d32] transition-colors"
        >
          Sign up
        </a>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-[#4e2b22] mb-1">Sign in</h1>
        <p className="text-[#8b6b5c]">Sign in to your account</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
