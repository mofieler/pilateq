'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Building2, ChevronDown, Loader2, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { switchStudioAction } from '@/modules/studio/actions/switchStudio.action';
import type { MyMembershipItem } from '@/modules/studio/actions/memberships.actions';
import type { StudioMembershipRole } from '@/db/schema';

const ROLE_LABELS: Record<StudioMembershipRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  instructor: 'Instructor',
  student: 'Student',
};

type StudioSwitcherProps = {
  initialMemberships: MyMembershipItem[];
};

export function StudioSwitcher({ initialMemberships }: StudioSwitcherProps) {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const currentStudioId = (session?.user as { studioId?: string } | undefined)?.studioId;
  const currentRole = (session?.user as { memberRole?: StudioMembershipRole } | undefined)
    ?.memberRole;

  const currentStudio =
    initialMemberships.find((m) => m.studioId === currentStudioId) ?? initialMemberships[0];

  if (initialMemberships.length === 0) {
    return null;
  }

  function handleSelect(studioId: string) {
    if (studioId === currentStudioId || isPending) return;

    startTransition(async () => {
      const result = await switchStudioAction({ studioId });
      if (result.success) {
        toast.success('Studio switched');
        await updateSession();
        router.refresh();
      } else {
        toast.error(result.error ?? 'Could not switch studio');
      }
      setOpen(false);
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={isPending || initialMemberships.length <= 1}
        className="hidden sm:flex items-center gap-2 rounded-full bg-[#ede8e5]/60 px-3 py-2 text-left transition-colors hover:bg-[#ede8e5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2 disabled:opacity-60"
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#4e2b22] text-[#faf9f7]">
          <Building2 className="size-3.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[#4e2b22] max-w-[140px]">
            {currentStudio?.name ?? 'Your Studio'}
          </p>
          <p className="text-[10px] font-medium text-[#8b6b5c]">
            {currentRole ? ROLE_LABELS[currentRole] : 'Studio'}
          </p>
        </div>
        {initialMemberships.length > 1 && (
          <ChevronDown className="size-3.5 shrink-0 text-[#8b6b5c]" />
        )}
        {isPending && <Loader2 className="size-3.5 shrink-0 animate-spin text-[#8b6b5c]" />}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="min-w-[220px] rounded-xl border-[#ede8e5] bg-[#faf9f7] p-1.5 shadow-lg shadow-[#4e2b22]/10"
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-[#8b6b5c]">
          Your studios
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[#ede8e5]/80" />
        {initialMemberships.map((membership) => {
          const isActive = membership.studioId === currentStudioId;
          return (
            <DropdownMenuItem
              key={membership.studioId}
              onClick={() => handleSelect(membership.studioId)}
              disabled={isPending}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#4e2b22] focus:bg-[#ede8e5]/60 focus:text-[#4e2b22] data-[disabled]:opacity-50"
            >
              <span className="flex-1 truncate text-sm font-medium">{membership.name}</span>
              <span className="rounded-full bg-[#ede8e5] px-2 py-0.5 text-[10px] font-semibold text-[#6b3d32]">
                {ROLE_LABELS[membership.role]}
              </span>
              {isActive && <Check className="size-4 text-[#4e2b22]" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
