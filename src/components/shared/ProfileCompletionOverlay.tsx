'use client';

import { useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { completeProfileAction } from '@/modules/users/actions/complete-profile.action';
import { skipProfileCompletionAction } from '@/modules/users/actions/skip-profile.action';
import { AvatarUploader } from '@/modules/users/components/AvatarUploader';

interface Props {
  initialName: string;
}

export function ProfileCompletionOverlay({ initialName }: Props) {
  const { update } = useSession();
  const [dismissed, setDismissed] = useState(false);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  function handleSkip() {
    startTransition(async () => {
      await skipProfileCompletionAction();
      await update({ needsProfileCompletion: false });
      setDismissed(true);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      const result = await completeProfileAction({ name, phone: phone || undefined });
      if (!result.success) {
        setError(result.error ?? 'Something went wrong');
        return;
      }
      await update({ needsProfileCompletion: false });
      setDismissed(true);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#4e2b22]/25 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative w-full max-w-md bg-[#faf9f7] rounded-2xl border border-[#ede8e5] shadow-[0_20px_60px_rgba(78,43,34,0.18)] p-8">
        <div className="text-center mb-6">
          <div className="mb-4">
            <AvatarUploader name={name} currentAvatarUrl={null} />
          </div>
          <h2 className="text-xl font-bold text-[#4e2b22]">Complete your profile</h2>
          <p className="text-sm text-[#6b3d32] mt-1.5 leading-relaxed">
            Help us personalise your experience.<br />
            You can always update this in your profile settings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="overlay-name" className="text-[#4e2b22] font-medium text-sm">
              Full name <span className="text-[#c45c4a]">*</span>
            </Label>
            <Input
              id="overlay-name"
              type="text"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              required
              className="mt-1.5 bg-white border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="overlay-phone" className="text-[#4e2b22] font-medium text-sm">
              Phone number{' '}
              <span className="text-[#8b6b5c] font-normal text-xs">(optional)</span>
            </Label>
            <Input
              id="overlay-phone"
              type="tel"
              placeholder="+49 170 1234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isPending}
              className="mt-1.5 bg-white border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] rounded-xl"
            />
          </div>

          {error && (
            <p className="text-sm text-[#c45c4a] bg-[#c45c4a]/10 p-3 rounded-xl">{error}</p>
          )}

          <Button
            type="submit"
            disabled={isPending || name.trim().length < 2}
            className="w-full bg-[#4e2b22] hover:bg-[#6b3d32] text-[#faf9f7] rounded-xl font-semibold"
          >
            {isPending ? 'Saving…' : 'Save & continue'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isPending}
            className="text-sm text-[#8b6b5c] hover:text-[#4e2b22] transition-colors disabled:opacity-40 underline underline-offset-2 decoration-[#8b6b5c]/40"
          >
            Skip for now
          </button>
          <p className="text-xs text-[#a6856f] mt-1.5">
            You&apos;ll be asked again next time you log in.
          </p>
        </div>
      </div>
    </div>
  );
}
