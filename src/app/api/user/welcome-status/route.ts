import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, creditPurchases, creditPackages } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [user] = await db
      .select({ welcomeCompletedAt: users.welcomeCompletedAt })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const [purchase] = await db
      .select({ id: creditPurchases.id })
      .from(creditPurchases)
      .innerJoin(creditPackages, eq(creditPurchases.packageId, creditPackages.id))
      .where(
        and(
          eq(creditPurchases.userId, session.user.id),
          eq(creditPackages.name, 'Welcome Journey'),
          ne(creditPurchases.paymentStatus, 'cancelled'),
        ),
      )
      .limit(1);

    return NextResponse.json({
      welcomeCompletedAt: user?.welcomeCompletedAt ?? null,
      welcomed: user?.welcomeCompletedAt != null,
      purchased: purchase != null,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to load welcome status' },
      { status: 500 },
    );
  }
}
