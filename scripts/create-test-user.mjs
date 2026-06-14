#!/usr/bin/env node
/**
 * Create a test admin user for the default studio.
 *
 * Usage:
 *   DATABASE_URL=postgres://postgres:password@localhost:5432/postgres \
 *     node scripts/create-test-user.mjs [email] [password]
 *
 * Defaults:
 *   email: admin@example.com
 *   password: Test1234!
 *   role: admin
 */
import bcrypt from 'bcryptjs';
import postgres from 'postgres';

const email = process.argv[2] || 'admin@example.com';
const password = process.argv[3] || 'Test1234!';
const role = process.argv[4] || 'admin';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const passwordHash = await bcrypt.hash(password, 12);

  const [{ id: studioId }] = await sql`
    INSERT INTO public.studios (slug, name, status, timezone, default_locale)
    VALUES ('default', 'PilatesOS Studio', 'active', 'Europe/Berlin', 'de')
    ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
    RETURNING id
  `;

  await sql`
    INSERT INTO public.studio_settings (studio_id, config_json)
    VALUES (${studioId}, '{}'::jsonb)
    ON CONFLICT (studio_id) DO NOTHING
  `;

  const [user] = await sql`
    INSERT INTO public.users (email, name, password_hash, role, studio_id, email_verified, profile_completed)
    VALUES (${email}, 'Test Admin', ${passwordHash}, ${role}, ${studioId}, NOW(), true)
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = EXCLUDED.role,
      studio_id = EXCLUDED.studio_id,
      email_verified = EXCLUDED.email_verified,
      profile_completed = EXCLUDED.profile_completed,
      updated_at = NOW()
    RETURNING id, email, role
  `;

  console.log('Test user created/updated:', user);
} catch (err) {
  console.error('Failed to create test user:', err);
  process.exit(1);
} finally {
  await sql.end();
}
