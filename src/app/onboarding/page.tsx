import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/db';
import { studios } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { OnboardingWizard } from '@/modules/onboarding/components/OnboardingWizard';

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/register?reason=onboarding');
  }

  // If the user already completed onboarding and has an active studio, send them to admin.
  if (session.user.role === 'admin' && session.user.studioId) {
    const [studio] = await db
      .select({ status: studios.status })
      .from(studios)
      .where(eq(studios.id, session.user.studioId))
      .limit(1);

    if (studio?.status === 'active') {
      redirect('/admin');
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#faf9f7] to-[#f5f3f1] py-8 px-4">
      <OnboardingWizard />
    </main>
  );
}
