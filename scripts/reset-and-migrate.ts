import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const client = postgres(connectionString);

async function resetAndMigrate() {
  console.log('🗑️  Resetting database...');

  try {
    // Drop all tables in public schema
    console.log('Dropping all tables...');
    
    // Get all tables
    const tables = await client`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `;
    
    for (const table of tables) {
      const tableName = table.tablename;
      console.log(`Dropping table: ${tableName}`);
      await client.unsafe(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
    }
    
    // Drop all ENUM types
    console.log('Dropping all ENUM types...');
    const enums = await client`
      SELECT typname 
      FROM pg_type 
      WHERE typtype = 'e' AND typnamespace = 'public'::regnamespace
    `;
    
    for (const enumType of enums) {
      const typeName = enumType.typname;
      console.log(`Dropping ENUM type: ${typeName}`);
      await client.unsafe(`DROP TYPE IF EXISTS "${typeName}" CASCADE`);
    }
    
    // Drop drizzle schema
    console.log('Dropping drizzle schema...');
    await client.unsafe(`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    
    console.log('✅ Database reset complete!');
    console.log('');
    console.log('🚀 Now run: pnpm db:migrate');
    console.log('🌱 Then run: pnpm db:seed');
    
  } catch (error) {
    console.error('❌ Error during reset:', error);
    throw error;
  } finally {
    await client.end();
  }
}

resetAndMigrate().catch(console.error);
