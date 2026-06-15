'use client';

import { useState, useTransition } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoleSelect } from './RoleSelect';
import { inviteMemberAction } from '@/modules/members/actions/invites.actions';
import type { StudioMembershipRole } from '@/db/schema';

const inviteSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['owner', 'admin', 'instructor', 'student'] as const),
  message: z.string().max(1000, 'Message must be under 1000 characters').optional(),
});

type InviteFormData = {
  email: string;
  role: StudioMembershipRole;
  message: string;
};

type InviteMemberModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  allowOwner?: boolean;
};

export function InviteMemberModal({
  open,
  onOpenChange,
  onSuccess,
  allowOwner = true,
}: InviteMemberModalProps) {
  const [form, setForm] = useState<InviteFormData>({
    email: '',
    role: 'student',
    message: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof InviteFormData, string>>>({});
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setForm({ email: '', role: 'student', message: '' });
    setFieldErrors({});
  }

  function handleClose() {
    if (isPending) return;
    onOpenChange(false);
    resetForm();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const parsed = inviteSchema.safeParse({
      ...form,
      email: form.email.trim().toLowerCase(),
      message: form.message.trim() || undefined,
    });

    if (!parsed.success) {
      const issues = parsed.error.issues;
      const next: Partial<Record<keyof InviteFormData, string>> = {};
      for (const issue of issues) {
        const key = issue.path[0] as keyof InviteFormData;
        next[key] = issue.message;
      }
      setFieldErrors(next);
      return;
    }

    startTransition(async () => {
      const result = await inviteMemberAction({
        email: parsed.data.email,
        role: parsed.data.role,
        message: parsed.data.message ?? null,
      });

      if (result.success) {
        toast.success('Invitation sent', {
          description: `An invite was sent to ${parsed.data.email}.`,
        });
        onSuccess?.();
        handleClose();
      } else {
        toast.error(result.error ?? 'Could not send invitation');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl border-[#ede8e5] bg-[#faf9f7] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-lg font-bold text-[#4e2b22]">Invite member</DialogTitle>
          <DialogDescription className="text-sm text-[#8b6b5c]">
            Send an invitation to join this studio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email" className="text-[#6b3d32] font-medium">
              Email <span className="text-[#c45c4a]">*</span>
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@studio.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              disabled={isPending}
              required
              aria-invalid={!!fieldErrors.email}
              className="rounded-xl border-[#ede8e5] bg-[#faf9f7]/80 text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] focus:ring-[#c4a88a]/20"
            />
            {fieldErrors.email && (
              <p className="text-xs text-[#c45c4a]">{fieldErrors.email}</p>
            )}
          </div>

          <RoleSelect
            id="invite-role"
            label="Role"
            value={form.role}
            onChange={(role) => setForm((f) => ({ ...f, role }))}
            disabled={isPending}
            allowOwner={allowOwner}
            required
          />
          {fieldErrors.role && <p className="text-xs text-[#c45c4a]">{fieldErrors.role}</p>}

          <div className="space-y-1.5">
            <Label htmlFor="invite-message" className="text-[#6b3d32] font-medium">
              Personal message <span className="text-[#8b6b5c] font-normal">(optional)</span>
            </Label>
            <textarea
              id="invite-message"
              rows={3}
              placeholder="Add a short note..."
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              disabled={isPending}
              maxLength={1000}
              className="w-full resize-none rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 px-3 py-2 text-sm text-[#4e2b22] placeholder:text-[#8b6b5c]/50 outline-none focus:border-[#c4a88a] focus:ring-2 focus:ring-[#4e2b22]/10 disabled:opacity-50"
            />
            {fieldErrors.message && (
              <p className="text-xs text-[#c45c4a]">{fieldErrors.message}</p>
            )}
          </div>
        </form>

        <DialogFooter className="px-6 pb-6 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
            className="min-h-[44px] rounded-xl border-[#ede8e5] bg-[#faf9f7] text-[#4e2b22] hover:bg-[#ede8e5]/60"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isPending}
            className="min-h-[44px] rounded-xl bg-[#4e2b22] text-[#faf9f7] hover:bg-[#6b3d32]"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {isPending ? 'Sending…' : 'Send invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
