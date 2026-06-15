import { config } from 'dotenv';
config({ path: '.env.production' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { users, studios, studioMemberships } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set in .env.production');
}

const client = postgres(connectionString);
const db = drizzle(client);

async function createAdminAndStudent() {
  console.log('🔑 Creating admin and student accounts...');

  try {
    // Resolve the default studio for the seeded users.
    const [studio] = await db.select({ id: studios.id }).from(studios).orderBy(studios.createdAt).limit(1);
    if (!studio) {
      throw new Error('No studio found in the database. Create a studio before running this script.');
    }

    // Create admin user
    const adminEmail = 'admin@example.com';
    const adminPassword = 'Test1234!';
    const adminHash = await bcrypt.hash(adminPassword, 12);

    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existingAdmin.length === 0) {
      const [adminUser] = await db
        .insert(users)
        .values({
          email: adminEmail,
          name: 'Admin User',
          role: 'admin',
          studioId: studio.id,
          passwordHash: adminHash,
          emailVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      await db.insert(studioMemberships).values({
        userId: adminUser.id,
        studioId: studio.id,
        role: 'owner',
        status: 'active',
        invitedByUserId: null,
        joinedAt: new Date(),
      });

      console.log(`✅ Admin created: ${adminEmail} / ${adminPassword}`);
    } else {
      console.log(`⚠️  Admin already exists: ${adminEmail}`);
    }

    // Create student user
    const studentEmail = 'student@example.com';
    const studentPassword = 'Test1234!';
    const studentHash = await bcrypt.hash(studentPassword, 12);

    const existingStudent = await db
      .select()
      .from(users)
      .where(eq(users.email, studentEmail))
      .limit(1);

    if (existingStudent.length === 0) {
      const [studentUser] = await db
        .insert(users)
        .values({
          email: studentEmail,
          name: 'Student User',
          role: 'student',
          studioId: studio.id,
          passwordHash: studentHash,
          emailVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      await db.insert(studioMemberships).values({
        userId: studentUser.id,
        studioId: studio.id,
        role: 'student',
        status: 'active',
        invitedByUserId: null,
        joinedAt: new Date(),
      });

      console.log(`✅ Student created: ${studentEmail} / ${studentPassword}`);
    } else {
      console.log(`⚠️  Student already exists: ${studentEmail}`);
    }

    console.log('');
    console.log('✅ Setup complete!');
    console.log('');
    console.log('Login credentials:');
    console.log(`  Admin:   ${adminEmail} / ${adminPassword}`);
    console.log(`  Student: ${studentEmail} / ${studentPassword}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

createAdminAndStudent().catch(console.error);
