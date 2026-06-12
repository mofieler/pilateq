'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { acceptDuoInviteAction } from '@/modules/booking/actions/acceptDuoInvite.action';

interface Props {
  token: string;
  creditLabel: string;
  creditCost: number;
}

export function AcceptInviteButton({ token, creditLabel, creditCost }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptDuoInviteAction({ token });
      if (result.success) {
        toast.success('You\'re booked!', { description: 'See you on the reformer.' });
        router.push('/');
      } else {
        toast.error(result.error ?? 'Something went wrong');
        if (result.code === 'INSUFFICIENT_CREDITS') {
          router.push(`/credits?return=/invite/${token}`);
        }
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleAccept}
      disabled={isPending}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4e2b22] px-4 py-3.5 text-sm font-semibold text-white hover:bg-[#6b3d32] transition-colors disabled:opacity-60"
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : null}
      Confirm — {creditCost} {creditLabel}
    </button>
  );
}
