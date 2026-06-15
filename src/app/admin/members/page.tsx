import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { getStudioMembersAction, getStudioInvitesAction } from '@/modules/members/actions/invites.actions';
import { MembersManager } from '@/modules/members/components/MembersManager';
import type { StudioMembershipRole } from '@/db/schema';

export default async function MembersPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const [membersRes, invitesRes] = await Promise.all([
    getStudioMembersAction(),
    getStudioInvitesAction(),
  ]);

  const loadError = !membersRes.success
    ? membersRes.error
    : !invitesRes.success
    ? invitesRes.error
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#4e2b22]">Members</h1>
        <p className="mt-1 text-sm text-[#8b6b5c]">
          Invite and manage studio members and pending invitations.
        </p>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-[#c45c4a]/20 bg-[#c45c4a]/10 px-4 py-3 text-sm text-[#b54a38]">
          Failed to load members: {loadError}
        </div>
      )}

      <MembersManager
        members={membersRes.success ? (membersRes.data ?? []) : []}
        invites={invitesRes.success ? (invitesRes.data ?? []) : []}
        currentUserId={session.user.id}
        currentMemberRole={(session.user as { memberRole?: StudioMembershipRole }).memberRole}
      />
    </div>
  );
}
