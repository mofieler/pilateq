import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { requireStudioId } from '@/lib/studio/studio-context';

export async function GET() {
  try {
    const { auth } = await import('@/lib/auth/auth');
    const session = await auth();

    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studioId = await requireStudioId();

    const students = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(
        and(
          eq(users.studioId, studioId),
          eq(users.role, 'student'),
          isNull(users.deletedAt)
        )
      )
      .orderBy(users.name);

    return NextResponse.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json(
      { error: 'Failed to fetch students' },
      { status: 500 }
    );
  }
}
