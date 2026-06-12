import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, welcomeJourneyRequests, classSessions, classTemplates } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!.replace('o138vve7mqivp0kmx1uhnxj5', '127.0.0.1');
const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  const [student] = await db.select().from(users).where(eq(users.email, 'alice@example.com')).limit(1);
  if (!student) {
    console.error('Student alice not found');
    return;
  }
  if (!student.studioId) {
    console.error('Student alice has no studioId');
    return;
  }

  // Clear existing requests first
  await db.delete(welcomeJourneyRequests);

  // Preferred slot tomorrow morning
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  // Preferred slot day after tomorrow morning
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  dayAfter.setHours(10, 30, 0, 0);

  const [req] = await db.insert(welcomeJourneyRequests).values({
    studioId: student.studioId,
    userId: student.id,
    status: 'pending',
    userMessage: 'Please schedule me!',
    preferredSlots: [tomorrow.toISOString(), dayAfter.toISOString()],
  }).returning();

  console.log('Inserted welcome journey request:', req.id);
}

main().catch(console.error).finally(() => client.end());
