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

const PLATFORM_STUDIO_SLUG = 'platform';
const PLATFORM_STUDIO_NAME = 'Platform';

function generatePassword(length = 16): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function getOrCreatePlatformStudio() {
  const [existing] = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.slug, PLATFORM_STUDIO_SLUG))
    .limit(1);

  if (existing) {
    console.log(`ℹ️  Platform studio already exists: ${existing.id}`);
    return existing.id;
  }

  const [studio] = await db
    .insert(studios)
    .values({
      slug: PLATFORM_STUDIO_SLUG,
      name: PLATFORM_STUDIO_NAME,
      status: 'suspended',
      timezone: 'Europe/Berlin',
      defaultLocale: 'en',
    })
    .returning({ id: studios.id });

  console.log(`✅ Platform studio created: ${studio.id}`);
  return studio.id;
}

async function createSuperAdmin() {
  const emailArg = process.argv[2];
  const nameArg = process.argv[3];

  if (!emailArg || !nameArg) {
    console.error('Usage: npx tsx scripts/create-superadmin.ts <email> "Full Name"');
    process.exit(1);
  }

  const email = emailArg.toLowerCase().trim();
  const name = nameArg.trim();
  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      console.error(`❌ A user with email ${email} already exists.`);
      process.exit(1);
    }

    const platformStudioId = await getOrCreatePlatformStudio();

    await db.insert(users).values({
      email,
      name,
      role: 'superadmin',
      studioId: platformStudioId,
      passwordHash,
      emailVerified: new Date(),
      profileCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('');
    console.log('✅ Superadmin created successfully.');
    console.log('');
    console.log(`  Email:    ${email}`);
    console.log(`  Name:     ${name}`);
    console.log(`  Password: ${password}`);
    console.log('');
    console.log('Store this password securely. It will not be shown again.');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

createSuperAdmin().catch(console.error);
