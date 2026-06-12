import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ProfileSettings } from '@/modules/users/components/ProfileSettings';
import type { Metadata } from 'next';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

export const metadata: Metadata = {
  title: `Your Profile — ${APP_CONFIG.APP_NAME}`,
  description: 'Manage your profile picture, name, and account settings.',
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = await db
    .select({
      name: users.name,
      email: users.email,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      image: users.image,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!user) redirect('/login');

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Page header */}
      <div>
        <p className="text-sm font-medium text-[#6b3d32]">Account</p>
        <h1 className="mt-1 text-2xl font-bold text-[#4e2b22]">Your Profile</h1>
        <p className="mt-2 text-sm text-[#8b6b5c]">
          Manage your personal information and account settings.
        </p>
      </div>

      <ProfileSettings
        userId={session.user.id}
        name={user.name}
        email={user.email}
        phone={user.phone}
        avatarUrl={user.avatarUrl || user.image}
        hasPassword={!!user.passwordHash}
      />
    </div>
  );
}
