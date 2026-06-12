'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { signWaiverAction } from '@/modules/users/actions/waiver.actions';
import { WAIVER_TEXT } from '@/lib/legal/waiver-content';

export default function WaiverPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [agreed, setAgreed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userId) {
      toast.error('Unable to identify your account. Please sign in again.');
      return;
    }
    if (!agreed) {
      toast.error('Please confirm that you have read and agree to the waiver.');
      return;
    }

    startTransition(async () => {
      const result = await signWaiverAction(userId);
      if (result.success) {
        toast.success('Waiver signed successfully.');
        router.push('/');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Failed to sign waiver. Please try again.');
      }
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-sm font-medium text-[#6b3d32]">Liability waiver</p>
        <h1 className="mt-1 text-2xl font-bold text-[#4e2b22]">Sign Waiver</h1>
        <p className="mt-2 text-sm text-[#6b4a3d]">
          Please read the waiver below and confirm your agreement before booking classes.
        </p>
      </div>

      <section className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#f5f3f1]/70 p-6 shadow-[0_4px_20px_rgba(78,43,34,0.04)]">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]" aria-hidden>
            <FileText className="size-4" aria-hidden />
          </span>
          <h2 className="text-base font-semibold text-[#4e2b22]">Studio Liability Waiver</h2>
        </div>

        <div className="max-h-96 overflow-y-auto rounded-xl border border-[#ede8e5] bg-white p-5 text-sm leading-relaxed text-[#4e2b22] whitespace-pre-line">
          {WAIVER_TEXT}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#ede8e5] bg-white p-4 transition-colors hover:bg-[#faf9f7]">
            <input
              type="checkbox"
              name="agreed"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[#4e2b22]"
            />
            <span className="text-sm text-[#4e2b22]">
              I have read and agree to the liability waiver above. I understand that participation
              in classes involves inherent risks and I voluntarily assume those risks.
            </span>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending || !agreed}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#4e2b22] px-6 py-2.5 text-sm font-semibold text-[#faf9f7] shadow-[0_4px_14px_rgba(78,43,34,0.25)] transition-all hover:bg-[#6b3d32] hover:shadow-[0_6px_20px_rgba(78,43,34,0.35)] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Sign waiver
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={isPending}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#ede8e5] bg-white px-5 py-2.5 text-sm font-semibold text-[#4e2b22] transition-colors hover:bg-[#faf9f7] disabled:opacity-60"
            >
              Go back
            </button>
          </div>
        </form>
      </section>

    </div>
  );
}
