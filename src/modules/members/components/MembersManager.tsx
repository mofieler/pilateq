'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Users,
  Mail,
  Clock,
  UserX,
  RefreshCw,
  Trash2,
  Loader2,
  UserPlus,
  SearchX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RoleSelect, ROLE_LABELS } from './RoleSelect';
import { InviteMemberModal } from './InviteMemberModal';
import {
  updateMemberRoleAction,
  resendInviteAction,
  revokeInviteAction,
} from '@/modules/members/actions/invites.actions';
import { formatStudioDateShort, formatStudio } from '@/lib/utils/date.utils';
import type { StudioMemberListItem, StudioInviteListItem } from '@/modules/members/actions/invites.actions';
import type { StudioMembershipRole } from '@/db/schema';

const ROLE_BADGES: Record<StudioMembershipRole, 'default' | 'secondary' | 'outline' | 'ghost' | 'success' | 'destructive' | 'boutique'> = {
  owner: 'default',
  admin: 'boutique',
  instructor: 'success',
  student: 'secondary',
};

type Tab = 'members' | 'invites';

type MembersManagerProps = {
  members: StudioMemberListItem[];
  invites: StudioInviteListItem[];
  currentUserId: string;
  currentMemberRole?: StudioMembershipRole;
};

export function MembersManager({
  members,
  invites,
  currentUserId,
  currentMemberRole = 'student',
}: MembersManagerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<StudioInviteListItem | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const ownerCount = members.filter((m) => m.role === 'owner').length;
  const canManageRoles = currentMemberRole === 'owner' || currentMemberRole === 'admin';

  function setPending(id: string, pending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleRoleChange(member: StudioMemberListItem, newRole: StudioMembershipRole) {
    if (newRole === member.role) return;

    startTransition(async () => {
      setPending(member.userId, true);
      const result = await updateMemberRoleAction({ userId: member.userId, role: newRole });
      setPending(member.userId, false);

      if (result.success) {
        toast.success('Role updated', {
          description: `${member.name ?? member.email} is now ${ROLE_LABELS[newRole]}.`,
        });
        router.refresh();
      } else {
        toast.error(result.error ?? 'Could not update role');
      }
    });
  }

  function handleResend(invite: StudioInviteListItem) {
    startTransition(async () => {
      setPending(invite.id, true);
      const result = await resendInviteAction(invite.id);
      setPending(invite.id, false);

      if (result.success) {
        toast.success('Invitation resent', { description: `A new invite was sent to ${invite.email}.` });
        router.refresh();
      } else {
        toast.error(result.error ?? 'Could not resend invitation');
      }
    });
  }

  function confirmRevoke(invite: StudioInviteListItem) {
    setRevokeTarget(invite);
  }

  function executeRevoke() {
    if (!revokeTarget) return;
    const invite = revokeTarget;
    setRevokeTarget(null);

    startTransition(async () => {
      setPending(invite.id, true);
      const result = await revokeInviteAction(invite.id);
      setPending(invite.id, false);

      if (result.success) {
        toast.success('Invitation revoked', { description: `The invite for ${invite.email} was revoked.` });
        router.refresh();
      } else {
        toast.error(result.error ?? 'Could not revoke invitation');
      }
    });
  }

  function isRoleChangeDisabled(member: StudioMemberListItem): boolean {
    if (!canManageRoles) return true;
    // Only owners can change owner roles or assign owner.
    if (member.role === 'owner' && currentMemberRole !== 'owner') return true;
    // Prevent the only owner from demoting themselves.
    if (member.userId === currentUserId && member.role === 'owner' && ownerCount <= 1) return true;
    return false;
  }

  const allowOwnerInSelect = currentMemberRole === 'owner';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-[#ede8e5] bg-[#faf9f7] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={[
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all min-h-[44px]',
              activeTab === 'members'
                ? 'bg-[#4e2b22] text-[#faf9f7] shadow-sm'
                : 'text-[#6b3d32] hover:bg-[#ede8e5]/60',
            ].join(' ')}
          >
            <Users className="size-4" />
            Members <span className="ml-1 rounded-full bg-current/20 px-1.5 py-0.5 text-xs">{members.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invites')}
            className={[
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all min-h-[44px]',
              activeTab === 'invites'
                ? 'bg-[#4e2b22] text-[#faf9f7] shadow-sm'
                : 'text-[#6b3d32] hover:bg-[#ede8e5]/60',
            ].join(' ')}
          >
            <Mail className="size-4" />
            Pending invites{' '}
            <span className="ml-1 rounded-full bg-current/20 px-1.5 py-0.5 text-xs">{invites.length}</span>
          </button>
        </div>

        <Button
          onClick={() => setInviteOpen(true)}
          disabled={!canManageRoles}
          className="min-h-[44px] rounded-xl bg-[#4e2b22] text-[#faf9f7] hover:bg-[#6b3d32]"
        >
          <UserPlus className="size-4" />
          Invite member
        </Button>
      </div>

      {activeTab === 'members' && (
        <div className="rounded-2xl border border-[#ede8e5] bg-[#faf9f7] shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-[#ede8e5] hover:bg-transparent">
                <TableHead className="text-[#8b6b5c]">Name</TableHead>
                <TableHead className="text-[#8b6b5c]">Email</TableHead>
                <TableHead className="text-[#8b6b5c]">Role</TableHead>
                <TableHead className="text-[#8b6b5c]">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow className="border-0">
                  <TableCell colSpan={4}>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <SearchX className="size-10 text-[#c4a88a]" />
                      <p className="mt-3 font-medium text-[#4e2b22]">No members yet</p>
                      <p className="text-sm text-[#8b6b5c]">Invite someone to get started.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id} className="border-[#ede8e5]">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#ede8e5] text-[#4e2b22] text-xs font-semibold">
                          {(member.name ?? member.email).charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-[#4e2b22]">
                          {member.name ?? '—'}
                          {member.userId === currentUserId && (
                            <span className="ml-2 text-[10px] font-semibold text-[#8b6b5c]">YOU</span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#6b3d32]">{member.email}</TableCell>
                    <TableCell>
                      {canManageRoles ? (
                        <RoleSelect
                          id={`role-${member.userId}`}
                          label=""
                          value={member.role}
                          onChange={(role) => handleRoleChange(member, role)}
                          disabled={isRoleChangeDisabled(member) || pendingIds.has(member.userId)}
                          allowOwner={allowOwnerInSelect}
                          className="max-w-[160px]"
                        />
                      ) : (
                        <Badge variant={ROLE_BADGES[member.role]}>{ROLE_LABELS[member.role]}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-[#6b3d32]">
                      {member.joinedAt ? formatStudioDateShort(member.joinedAt) : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {isPending && (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full rounded-xl bg-[#ede8e5]/60" />
              <Skeleton className="h-10 w-full rounded-xl bg-[#ede8e5]/60" />
              <Skeleton className="h-10 w-full rounded-xl bg-[#ede8e5]/60" />
            </div>
          )}
        </div>
      )}

      {activeTab === 'invites' && (
        <div className="rounded-2xl border border-[#ede8e5] bg-[#faf9f7] shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-[#ede8e5] hover:bg-transparent">
                <TableHead className="text-[#8b6b5c]">Email</TableHead>
                <TableHead className="text-[#8b6b5c]">Role</TableHead>
                <TableHead className="text-[#8b6b5c]">Expires</TableHead>
                <TableHead className="text-[#8b6b5c]">Invited by</TableHead>
                <TableHead className="text-right text-[#8b6b5c]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.length === 0 ? (
                <TableRow className="border-0">
                  <TableCell colSpan={5}>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Mail className="size-10 text-[#c4a88a]" />
                      <p className="mt-3 font-medium text-[#4e2b22]">No pending invites</p>
                      <p className="text-sm text-[#8b6b5c]">All invitations have been accepted or revoked.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                invites.map((invite) => (
                  <TableRow key={invite.id} className="border-[#ede8e5]">
                    <TableCell className="font-medium text-[#4e2b22]">{invite.email}</TableCell>
                    <TableCell>
                      <Badge variant={ROLE_BADGES[invite.role]}>{ROLE_LABELS[invite.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-[#6b3d32]">
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-[#8b6b5c]" />
                        {formatStudio(invite.expiresAt, 'd MMM yyyy')}
                      </span>
                    </TableCell>
                    <TableCell className="text-[#6b3d32]">{invite.invitedByName ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResend(invite)}
                          disabled={pendingIds.has(invite.id)}
                          className="min-h-[36px] rounded-lg border-[#ede8e5] bg-[#faf9f7] text-[#4e2b22] hover:bg-[#ede8e5]/60"
                        >
                          {pendingIds.has(invite.id) ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="size-3.5" />
                          )}
                          <span className="hidden sm:inline">Resend</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmRevoke(invite)}
                          disabled={pendingIds.has(invite.id)}
                          className="min-h-[36px] rounded-lg border-[#c45c4a]/30 bg-[#c45c4a]/5 text-[#c45c4a] hover:bg-[#c45c4a]/10 hover:text-[#b54a38]"
                        >
                          <Trash2 className="size-3.5" />
                          <span className="hidden sm:inline">Revoke</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <InviteMemberModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={() => router.refresh()}
        allowOwner={allowOwnerInSelect}
      />

      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent className="rounded-2xl border-[#ede8e5] bg-[#faf9f7]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-[#4e2b22]">Revoke invitation?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#8b6b5c]">
              The invite sent to <strong className="text-[#4e2b22]">{revokeTarget?.email}</strong> will be
              permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setRevokeTarget(null)}
              className="min-h-[44px] rounded-xl border-[#ede8e5] bg-[#faf9f7] text-[#4e2b22] hover:bg-[#ede8e5]/60"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeRevoke}
              className="min-h-[44px] rounded-xl bg-[#c45c4a] text-[#faf9f7] hover:bg-[#b54a38]"
            >
              <UserX className="size-4" />
              Revoke invite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
