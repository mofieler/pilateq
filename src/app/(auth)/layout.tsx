import { auth } from '@/lib/auth/auth';
import { AuthShell } from '@/components/shared/AuthShell';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAuthenticated = Boolean(session);

  return (
    <AuthShell showFooter={!isAuthenticated}>
      {children}
    </AuthShell>
  );
}
