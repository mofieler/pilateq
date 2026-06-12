'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPasswordAction } from '@/modules/users/actions/forgot-password.action';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await forgotPasswordAction({ email });
      setSubmitted(true);
      setEmail('');
    } catch {
      // Silently fail (anti-enumeration)
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#4e2b22] mb-1">Password recovery</h1>
          <p className="text-[#8b6b5c]">Reset your password</p>
        </div>

        <div className="text-center">
          <p className="text-[#4a7c4a] text-sm font-medium mb-2">Check your email</p>
          <p className="text-sm text-[#6b3d32] mb-6">
            If an account exists with that email address, we&apos;ve sent a password reset link. The link expires in 1 hour.
          </p>
          <a
            href="/login"
            className="inline-block text-[#4e2b22] font-semibold hover:text-[#6b3d32] transition-colors"
          >
            Back to sign in
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-[#4e2b22] mb-1">Forgot your password?</h1>
        <p className="text-[#8b6b5c]">We'll send you a reset link</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
          <div>
            <Label htmlFor="email" className="text-[#4e2b22] font-medium">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              className="mt-1.5 bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] focus:ring-[#c4a88a]/20 rounded-xl"
            />
          </div>

          <p className="text-xs text-[#8b6b5c]">
            Enter the email address associated with your account and we'll send you a link to reset your password.
          </p>

          <Button type="submit" variant="boutique" className="w-full" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>

        <p className="text-sm text-[#8b6b5c] text-center mt-6">
          Remember your password?{' '}
          <a href="/login" className="text-[#4e2b22] font-semibold hover:text-[#6b3d32] transition-colors">
            Sign in
          </a>
        </p>
    </>
  );
}
