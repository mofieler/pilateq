'use client';

import { useState } from 'react';
import { formatStudio } from '@/lib/utils/date.utils';
import { CheckCircle, Copy, Share2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  sessionName: string;
  startsAt: Date;
  inviteToken: string;
  expiresAt: Date;
  onDone: () => void;
}

export function DuoInviteShareSheet({ sessionName, startsAt, inviteToken, expiresAt, onDone }: Props) {
  const [copied, setCopied] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const inviteUrl = `${appUrl}/invite/${inviteToken}`;
  const formattedDate = formatStudio(startsAt, "EEEE, d MMMM 'at' HH:mm");
  const formattedExpiry = formatStudio(expiresAt, "d MMM 'at' HH:mm");

  async function handleShare() {
    const shareData = {
      title: 'Pilates Duo Invite',
      text: `Join me for ${sessionName} on ${formatStudio(startsAt, 'd MMMM')}!`,
      url: inviteUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or share not available — fall through to clipboard
      }
    }
    handleCopy();
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard not available
    }
  }

  return (
    <div className="flex flex-col items-center text-center px-6 py-8 gap-5">
      {/* Success icon */}
      <div className="flex size-16 items-center justify-center rounded-full bg-[#6b8e6b]/15">
        <CheckCircle className="size-8 text-[#4a7c4a]" />
      </div>

      {/* Heading */}
      <div>
        <h2 className="font-semibold text-lg text-[#4e2b22]">Your spot is reserved!</h2>
        <p className="text-sm text-[#8b6b5c] mt-1">
          {sessionName} · {formattedDate}
        </p>
      </div>

      {/* Invite URL display */}
      <div className="w-full rounded-xl bg-[#faf9f7] border border-[#ede8e5] px-4 py-3">
        <p className="text-xs text-[#8b6b5c] mb-1 text-left">Share link</p>
        <p className="font-mono text-xs text-[#6b3d32] break-all text-left">{inviteUrl}</p>
      </div>

      {/* CTAs */}
      <div className="w-full flex flex-col gap-2">
        <Button
          variant="boutique"
          className="w-full gap-2"
          onClick={handleShare}
        >
          <Share2 className="size-4" />
          Share Invite
        </Button>
        <Button
          variant="outline"
          className="w-full gap-2 border-[#ede8e5] text-[#6b3d32]"
          onClick={handleCopy}
        >
          <Copy className="size-4" />
          <span className={cn('transition-all', copied && 'text-[#4a7c4a]')}>
            {copied ? 'Copied!' : 'Copy Link'}
          </span>
        </Button>
      </div>

      {/* Expiry notice */}
      <div className="flex items-center gap-1.5 text-xs text-[#a6856f]">
        <Clock className="size-3.5 shrink-0" />
        <span>Invite expires {formattedExpiry}</span>
      </div>

      {/* Done */}
      <button
        type="button"
        onClick={onDone}
        className="text-sm text-[#8b6b5c] hover:text-[#4e2b22] transition-colors underline underline-offset-2"
      >
        Done
      </button>
    </div>
  );
}
