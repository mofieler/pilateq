'use client';

import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function InactivityWarningModal() {
  const { showWarning, secondsLeft, stayLoggedIn, logOut } = useInactivityLogout();

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeLabel = minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')} min`
    : `${seconds}s`;

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm rounded-2xl border-[#ede8e5] bg-[#faf9f7]"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-[#4e2b22] text-lg">Still there?</DialogTitle>
          <DialogDescription className="text-[#8b6b5c]">
            You&apos;ve been inactive for a while. For your security, you&apos;ll be signed out
            in <span className="font-semibold tabular-nums text-[#4e2b22]">{timeLabel}</span>.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={logOut} className="border-[#ede8e5] text-[#8b6b5c]">
            Sign out
          </Button>
          <Button variant="boutique" onClick={stayLoggedIn}>
            Stay logged in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
