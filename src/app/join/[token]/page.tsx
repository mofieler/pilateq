import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { getStudioConfig } from '@/lib/studio/server';
import { validateInviteAction } from '@/modules/members/actions/invites.actions';
import { AcceptInviteForm } from '@/modules/members/components/AcceptInviteForm';
import { MailX, MailWarning, ArrowLeft } from 'lucide-react';

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [validation, session, config] = await Promise.all([
    validateInviteAction(token),
    auth(),
    getStudioConfig(),
  ]);

  const studioEmail = config.identity.email || '';

  if (!validation.success) {
    const isExpired = validation.code === 'EXPIRED';
    const Icon = isExpired ? MailWarning : MailX;

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#faf9f7] to-[#f5f3f1] p-4">
        <div className="w-full max-w-md rounded-2xl border border-[#ede8e5] bg-[#faf9f7] p-6 text-center shadow-[0_8px_40px_rgba(78,43,34,0.08)] sm:p-8">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#c45c4a]/10 text-[#c45c4a]">
            <Icon className="size-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[#4e2b22]">
            {isExpired ? 'Invite expired' : 'Invite unavailable'}
          </h1>
          <p className="mt-2 text-sm text-[#8b6b5c]">{validation.error}</p>

          {studioEmail && (
            <p className="mt-4 text-sm text-[#6b3d32]">
              Need a new invite?{' '}
              <a
                href={`mailto:${studioEmail}?subject=Request new studio invitation`}
                className="font-semibold text-[#4e2b22] underline-offset-2 hover:underline"
              >
                Contact the studio
              </a>
              .
            </p>
          )}

          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#4e2b22] px-5 py-2.5 text-sm font-semibold text-[#faf9f7] transition-all hover:bg-[#6b3d32] min-h-[44px]"
          >
            <ArrowLeft className="size-4" />
            Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#faf9f7] to-[#f5f3f1] p-4">
      <AcceptInviteForm
        token={token}
        invite={validation.data!}
        isAuthenticated={!!session}
        sessionEmail={session?.user?.email ?? null}
      />
    </div>
  );
}
