import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { users, studios, studioMemberships } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const client = postgres(connectionString);
const db = drizzle(client);

async function seedSimple() {
  console.log('🌱 Starting simple database seeding...');

  try {
    // Resolve the default studio for the seeded users.
    const [studio] = await db.select({ id: studios.id }).from(studios).orderBy(studios.createdAt).limit(1);
    if (!studio) {
      throw new Error('No studio found in the database. Create a studio before running this seed script.');
    }

    // Check if admin user already exists
    console.log('👤 Creating admin user...');
    let adminUser;
    try {
      adminUser = await db.insert(users).values({
        email: 'admin@pilatesos.com',
        name: 'Admin User',
        role: 'admin',
        studioId: studio.id,
        passwordHash: await bcrypt.hash('password123', 10),
        emailVerified: new Date(),
      }).returning();
      await db.insert(studioMemberships).values({
        userId: adminUser[0].id,
        studioId: studio.id,
        role: 'owner',
        status: 'active',
        invitedByUserId: null,
        joinedAt: new Date(),
      });
      console.log('✅ Admin user created:', adminUser[0].email);
    } catch (error: any) {
      if (error.code === '23505' && error.message?.includes('already exists')) {
        console.log('   ⚠️  Admin user already exists, skipping...');
        adminUser = await db.select().from(users).where(eq(users.email, 'admin@pilatesos.com')).limit(1);
      } else {
        throw error;
      }
    }

    // Create test user
    console.log('👤 Creating test user...');
    let testUser;
    try {
      testUser = await db.insert(users).values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'student',
        studioId: studio.id,
        passwordHash: await bcrypt.hash('password123', 10),
        emailVerified: new Date(),
      }).returning();
      await db.insert(studioMemberships).values({
        userId: testUser[0].id,
        studioId: studio.id,
        role: 'student',
        status: 'active',
        invitedByUserId: null,
        joinedAt: new Date(),
      });
      console.log('✅ Test user created:', testUser[0].email);
    } catch (error: any) {
      if (error.code === '23505' && error.message?.includes('already exists')) {
        console.log('   ⚠️  Test user already exists, skipping...');
        testUser = await db.select().from(users).where(eq(users.email, 'test@example.com')).limit(1);
      } else {
        throw error;
      }
    }

    console.log('');
    console.log('🎉 Simple seeding completed successfully!');
    console.log('');
    console.log('👤 Login credentials:');
    console.log('   Admin: admin@pilatesos.com / password123');
    console.log('   Test:  test@example.com / password123');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await client.end();
  }
}

seedSimple().catch(console.error);
