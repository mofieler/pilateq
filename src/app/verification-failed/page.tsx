'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { XCircle, Clock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { resendVerificationEmailAction } from '@/modules/users/actions/resendVerification.action';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

function supportEmail(): string {
  try {
    return `support@${new URL(APP_CONFIG.APP_URL).hostname}`;
  } catch {
    return 'support@localhost';
  }
}

function VerificationFailedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  const isExpired = reason === 'expired';
  const isInvalid = reason === 'invalid';
  const isGeneric = !isExpired && !isInvalid;

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const result = await resendVerificationEmailAction(email.trim().toLowerCase());
      if (result.success) {
        setStatus('sent');
        setMessage('If an account exists, a new verification link has been sent.');
      } else {
        setStatus('error');
        setMessage(result.error ?? 'Could not resend the email. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('An unexpected error occurred. Please try again.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4 py-8">
      <div className="w-full max-w-md text-center">
        <div
          className={`inline-flex items-center justify-center size-20 rounded-full mb-6 ${
            isExpired ? 'bg-[#c4a88a]/20' : 'bg-[#c45c4a]/10'
          }`}
        >
          {isExpired ? (
            <Clock className="size-10 text-[#8b5a3c]" />
          ) : (
            <XCircle className="size-10 text-[#c45c4a]" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-[#4e2b22] mb-3">
          {isExpired ? 'Link expired' : 'Verification failed'}
        </h1>
        <p className="text-[#6b3d32] mb-6 leading-relaxed">
          {isExpired
            ? 'This verification link has expired. For security reasons, verification links are only valid for 24 hours.'
            : isInvalid
            ? "We couldn't verify your email address. The link may be invalid or has already been used."
            : "We couldn't verify your email address. The link may be expired, invalid, or has already been used."}
        </p>

        <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6 text-left mb-6">
          <p className="text-sm text-[#6b3d32] font-medium mb-3">What you can do:</p>
          <ul className="text-sm text-[#8b6b5c] space-y-2">
            <li className="flex items-start gap-2">
              <Mail className="size-4 mt-0.5 text-[#8b6b5c]" />
              <span>Enter your email below to request a new verification link</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#4e2b22] mt-0.5">2.</span>
              <span>Or sign in — if your account is already verified you will be redirected to your dashboard</span>
            </li>
          </ul>

          <form onSubmit={handleResend} className="mt-5 space-y-3">
            <div>
              <Label htmlFor="email" className="text-[#4e2b22]">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={status === 'loading' || status === 'sent'}
                className="mt-1.5 bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] focus:ring-[#c4a88a]/20 rounded-xl"
              />
            </div>

            {message && (
              <p
                role="alert"
                className={`text-sm p-3 rounded-xl border ${
                  status === 'sent'
                    ? 'text-[#4a7c4a] bg-[#4a7c4a]/10 border-[#4a7c4a]/20'
                    : 'text-[#c45c4a] bg-[#c45c4a]/10 border-[#c45c4a]/20'
                }`}
              >
                {message}
              </p>
            )}

            <Button
              type="submit"
              variant="boutique"
              className="w-full min-h-[44px]"
              disabled={status === 'loading' || status === 'sent'}
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending…
                </>
              ) : status === 'sent' ? (
                'Verification email sent'
              ) : (
                'Resend verification email'
              )}
            </Button>
          </form>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4e2b22] px-6 py-3 text-sm font-semibold text-[#faf9f7] shadow-sm hover:bg-[#6b3d32] transition-colors min-h-[44px]"
          >
            Go to sign in
            <ArrowRight className="size-4" />
          </Link>

          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-xl border border-[#c4a88a]/50 bg-transparent px-6 py-3 text-sm font-semibold text-[#4e2b22] hover:bg-[#ede8e5]/60 transition-colors min-h-[44px]"
          >
            Create new account
          </Link>
        </div>

        <p className="text-sm text-[#8b6b5c] mt-6">
          Need help?{' '}
          <a href={`mailto:${supportEmail()}`} className="text-[#4e2b22] font-medium hover:text-[#6b3d32] transition-colors">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}

export default function VerificationFailedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
          <div className="w-full max-w-md text-center">
            <div className="inline-flex items-center justify-center size-20 rounded-full bg-[#c45c4a]/10 mb-6 animate-pulse">
              <XCircle className="size-10 text-[#c45c4a]" />
            </div>
            <h1 className="text-2xl font-bold text-[#4e2b22] mb-3">Loading…</h1>
          </div>
        </div>
      }
    >
      <VerificationFailedContent />
    </Suspense>
  );
}
