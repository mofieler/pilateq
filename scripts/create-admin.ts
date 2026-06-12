import { config } from 'dotenv';
config({ path: '.env.production' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { users, studios } from '../src/db/schema';
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
    const adminHash = await bcrypt.hash('admin123', 12);

    // Check if admin already exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, 'admin@pilates.de'))
      .limit(1);

    if (existingAdmin.length === 0) {
      await db.insert(users).values({
        email: 'admin@pilates.de',
        name: 'Admin User',
        role: 'admin',
        studioId: studio.id,
        passwordHash: adminHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('✅ Admin created: admin@pilates.de / admin123');
    } else {
      console.log('⚠️  Admin already exists: admin@pilates.de');
    }

    // Create student user
    const studentHash = await bcrypt.hash('student123', 12);

    const existingStudent = await db
      .select()
      .from(users)
      .where(eq(users.email, 'student@pilates.de'))
      .limit(1);

    if (existingStudent.length === 0) {
      await db.insert(users).values({
        email: 'student@pilates.de',
        name: 'Student User',
        role: 'student',
        studioId: studio.id,
        passwordHash: studentHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('✅ Student created: student@pilates.de / student123');
    } else {
      console.log('⚠️  Student already exists: student@pilates.de');
    }

    console.log('');
    console.log('✅ Setup complete!');
    console.log('');
    console.log('Login credentials:');
    console.log('  Admin:   admin@pilates.de / admin123');
    console.log('  Student: student@pilates.de / student123');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

createAdminAndStudent().catch(console.error);
