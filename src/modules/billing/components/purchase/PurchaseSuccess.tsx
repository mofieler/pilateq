'use client';

import { CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import type { PaymentProvider } from '@/lib/studio/studio.config.schema';

interface PurchaseSuccessProps {
  packageName: string;
  dueDate: string;
  isWelcomeJourney: boolean;
  paymentMethod: PaymentProvider;
  onReset: () => void;
}

function isOfflinePayment(method: PaymentProvider): boolean {
  return ['pay_at_studio', 'bank_transfer', 'cash'].includes(method);
}

export function PurchaseSuccess({ packageName, dueDate, isWelcomeJourney, paymentMethod, onReset }: PurchaseSuccessProps) {
  const router = useRouter();

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center size-16 rounded-full bg-[#6b8e6b]/10 mb-4">
          <CheckCircle className="size-8 text-[#6b8e6b]" />
        </div>
        <h1 className="text-2xl font-bold text-[#4e2b22] mb-2">
          {isWelcomeJourney
            ? 'Welcome Journey purchased!'
            : isOfflinePayment(paymentMethod)
              ? 'Order placed — pending payment confirmation'
              : 'Credits added — book away!'}
        </h1>
        <p className="text-[#8b6b5c]">
          {isOfflinePayment(paymentMethod) ? (
            <>Your <strong>{packageName}</strong> is reserved. Credits will be activated once the studio confirms your payment.</>
          ) : (
            <>Your <strong>{packageName}</strong> is already in your account.</>
          )}
        </p>
      </div>

      <div className="rounded-2xl border border-[#ede8e5]/80 bg-linear-to-br from-[#faf9f7]/90 to-[#ede8e5]/40 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#d4a574]/10">
            <Clock className="size-5 text-[#d4a574]" />
          </div>
          <div>
            <p className="font-semibold text-[#4e2b22]">Payment due by</p>
            <p className="text-sm text-[#8b6b5c]">{dueDate}</p>
          </div>
        </div>
        <p className="text-sm text-[#6b3d32]">
          {isOfflinePayment(paymentMethod) ? (
            <>
              Your credits are <strong>reserved</strong> and will be activated once the studio confirms your payment.
              Please pay at the studio or via bank transfer within the next 14 days.
              Your invoice (PDF) has been sent to your email.
            </>
          ) : (
            <>
              Your credits are <strong>already available</strong> — you can book classes right away.
              Your invoice (PDF) has been sent to your email.
            </>
          )}
        </p>
      </div>

      <div className="flex gap-3">
        {isWelcomeJourney ? (
          <Button variant="boutique" className="flex-1" onClick={() => router.push('/welcome-journey')}>
            Request your Welcome Journey slots
          </Button>
        ) : (
          <Button variant="outline" className="flex-1 border-[#ede8e5] text-[#8b6b5c]" onClick={() => router.push('/')}>
            Go to Dashboard
          </Button>
        )}
        <Button variant="boutique" className="flex-1" onClick={onReset}>
          Buy More Credits
        </Button>
      </div>
    </div>
  );
}
