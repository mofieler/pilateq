import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Load environment variables
config({ path: '.env.local' });
if (!process.env.DATABASE_URL) {
  config({ path: '.env.production' });
}

let connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set in .env.local or .env.production');
}

// Replace container hostname with 127.0.0.1 for local script execution
connectionString = connectionString.replace('@o138vve7mqivp0kmx1uhnxj5:', '@127.0.0.1:');

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function run() {
  console.log('🔄 Running migration to add preferred_slots to welcome_journey_requests...');
  try {
    await db.execute(
      `ALTER TABLE welcome_journey_requests ADD COLUMN IF NOT EXISTS preferred_slots jsonb DEFAULT '[]'::jsonb;`
    );
    console.log('✅ Migration successful!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.end();
  }
}

run();
