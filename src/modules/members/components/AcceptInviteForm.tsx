'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signOut } from 'next-auth/react';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Mail, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { acceptInviteAction } from '@/modules/members/actions/invites.actions';
import { formatStudioDateShort, formatStudioTime } from '@/lib/utils/date.utils';
import type { InviteValidationResult } from '@/modules/members/actions/invites.actions';

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  instructor: 'Instructor',
  student: 'Student',
} as const;

type AcceptInviteFormProps = {
  token: string;
  invite: InviteValidationResult;
  isAuthenticated: boolean;
  sessionEmail: string | null;
};

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function AcceptInviteForm({
  token,
  invite,
  isAuthenticated,
  sessionEmail,
}: AcceptInviteFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const emailMatches =
    isAuthenticated && sessionEmail ? normalizeEmail(sessionEmail) === normalizeEmail(invite.email) : false;

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInviteAction({ token });
      if (result.success) {
        toast.success('Welcome!', { description: `You have joined ${invite.studioName}.` });
        router.push('/');
      } else {
        setError(result.error ?? 'Could not accept invitation');
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    startTransition(async () => {
      const result = await acceptInviteAction({ token, password });

      if (!result.success) {
        setError(result.error ?? 'Could not accept invitation');
        return;
      }

      // Sign the user in after account creation / password verification.
      const signInResult = await signIn('credentials', {
        email: invite.email,
        password,
        redirect: false,
      });

      if (signInResult?.ok) {
        toast.success('Welcome!', { description: `You have joined ${invite.studioName}.` });
        router.push('/');
      } else {
        router.push(`/login?invited=true&email=${encodeURIComponent(invite.email)}`);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-[#ede8e5] bg-[#faf9f7] p-6 shadow-[0_8px_40px_rgba(78,43,34,0.08)] sm:p-8">
      <div className="text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#4e2b22] text-[#faf9f7]">
          <Mail className="size-7" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-[#4e2b22]">You&apos;re invited</h1>
        <p className="mt-1 text-sm text-[#8b6b5c]">
          Join <span className="font-semibold text-[#4e2b22]">{invite.studioName}</span> as a{' '}
          <Badge variant="boutique">{ROLE_LABELS[invite.role]}</Badge>
        </p>
      </div>

      <div className="mt-6 space-y-3 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-[#8b6b5c]">Invited email</span>
          <span className="font-medium text-[#4e2b22]">{invite.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#8b6b5c]">Invited by</span>
          <span className="font-medium text-[#4e2b22]">{invite.invitedByName ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#8b6b5c]">Expires</span>
          <span className="font-medium text-[#4e2b22]">
            {formatStudioDateShort(invite.expiresAt)} at {formatStudioTime(invite.expiresAt)}
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#c45c4a]/20 bg-[#c45c4a]/10 p-3 text-sm text-[#b54a38]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isAuthenticated ? (
        <div className="mt-6">
          {emailMatches ? (
            <Button
              onClick={handleAccept}
              disabled={isPending}
              className="w-full min-h-[44px] rounded-xl bg-[#4e2b22] text-[#faf9f7] hover:bg-[#6b3d32]"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Accept invitation
            </Button>
          ) : (
            <div className="space-y-4">
              <p className="rounded-xl border border-[#c45c4a]/20 bg-[#c45c4a]/10 p-3 text-sm text-[#b54a38]">
                This invite was sent to <strong>{invite.email}</strong>, but you are signed in as{' '}
                <strong>{sessionEmail}</strong>. Please sign out and use the invited email address.
              </p>
              <Button
                variant="outline"
                onClick={() => signOut({ redirectTo: '/login' })}
                className="w-full min-h-[44px] rounded-xl border-[#ede8e5] bg-[#faf9f7] text-[#4e2b22] hover:bg-[#ede8e5]/60"
              >
                <ArrowRight className="size-4" />
                Sign out and continue
              </Button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[#6b3d32] font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={invite.email}
              disabled
              className="rounded-xl border-[#ede8e5] bg-[#ede8e5]/40 text-[#4e2b22]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[#6b3d32] font-medium">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create or enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                required
                minLength={8}
                autoComplete="new-password"
                className="rounded-xl border-[#ede8e5] bg-[#faf9f7]/80 pr-10 text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] focus:ring-[#c4a88a]/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b6b5c] hover:text-[#4e2b22]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
            <p className="text-xs text-[#8b6b5c]">
              {password.length > 0 && password.length < 8
                ? 'Password must be at least 8 characters.'
                : 'Choose a strong password to secure your account.'}
            </p>
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full min-h-[44px] rounded-xl bg-[#4e2b22] text-[#faf9f7] hover:bg-[#6b3d32]"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Accept invitation
          </Button>
        </form>
      )}
    </div>
  );
}
