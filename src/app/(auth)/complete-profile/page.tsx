'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { completeProfileAction } from '@/modules/users/actions/complete-profile.action';
import { UserCircle2 } from 'lucide-react';

export default function CompleteProfilePage() {
  const router = useRouter();
  const { data: session, update } = useSession();

  const [name, setName] = useState(session?.user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await completeProfileAction({ name, phone: phone || undefined });

      if (!result.success) {
        setError(result.error ?? 'Something went wrong');
        return;
      }

      // Refresh the JWT so needsProfileCompletion is cleared
      await update({ needsProfileCompletion: false });
      router.push('/');
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center size-16 rounded-full bg-[#4e2b22]/10 mb-4">
          <UserCircle2 className="size-8 text-[#4e2b22]" />
        </div>
        <h1 className="text-2xl font-bold text-[#4e2b22] mb-1">Complete your profile</h1>
        <p className="text-[#6b3d32]">
          Just a few details before you dive in.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
          <div>
            <Label htmlFor="name" className="text-[#4e2b22] font-medium">
              Full name <span className="text-[#c45c4a]">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
              className="mt-1.5 bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="phone" className="text-[#4e2b22] font-medium">
              Phone number <span className="text-[#8b6b5c] font-normal text-xs">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+49 170 1234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              className="mt-1.5 bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] rounded-xl"
            />
          </div>

          {error && (
            <p className="text-sm text-[#c45c4a] bg-[#c45c4a]/10 p-3 rounded-xl">{error}</p>
          )}

          <Button type="submit" variant="boutique" className="w-full" disabled={loading}>
            {loading ? 'Saving…' : 'Save & continue'}
          </Button>
        </form>
    </>
  );
}
