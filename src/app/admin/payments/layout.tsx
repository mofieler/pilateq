import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';

export default async function PaymentsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user?.role === 'instructor') redirect('/admin/classes');
  return <>{children}</>;
}
