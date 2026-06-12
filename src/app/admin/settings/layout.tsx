import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { SettingsNav } from '@/modules/admin/settings/components/SettingsNav';
import { MobileSettingsNav } from '@/modules/admin/settings/components/MobileSettingsNav';

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'admin') {
    redirect('/admin');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Studio Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure how your studio operates, accepts payments, and appears to students.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="block">
          <div className="lg:hidden">
            <MobileSettingsNav />
          </div>
          <div className="hidden lg:block">
            <SettingsNav />
          </div>
        </aside>
        <main className="space-y-8">{children}</main>
      </div>
    </div>
  );
}
