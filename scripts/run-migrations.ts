import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const client = postgres(connectionString);
const db = drizzle(client);

async function runMigrations() {
  console.log('🚀 Running migrations...');
  
  try {
    // Create drizzle schema if not exists
    await client`CREATE SCHEMA IF NOT EXISTS drizzle`;
    
    // Create migrations table if not exists
    await client`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    // Get all migration files
    const migrationsDir = join(process.cwd(), 'src', 'db', 'migrations');
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    // Get already applied migrations
    const appliedMigrations = await client`
      SELECT hash FROM drizzle.__drizzle_migrations
    `;
    const appliedHashes = new Set(appliedMigrations.map(m => m.hash));
    
    for (const file of files) {
      const hash = file.replace('.sql', '');
      
      if (appliedHashes.has(hash)) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        continue;
      }
      
      console.log(`📝 Applying ${file}...`);
      
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      
      // Split by statement-breakpoint and execute each statement
      const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s);
      
      for (const statement of statements) {
        if (statement) {
          try {
            await client.unsafe(statement);
          } catch (error: any) {
            // Ignore "already exists" errors for types and tables
            if (error.code === '42710' || // type already exists
                error.code === '42P07' || // relation already exists  
                error.code === '42P06' || // schema already exists
                error.message?.includes('already exists')) {
              console.log(`   ⚠️  Skipping (already exists): ${statement.substring(0, 50)}...`);
              continue;
            }
            // Ignore "cannot drop type because other objects depend on it" - means type is still needed
            if (error.code === '2BP01' || // dependent objects
                error.message?.includes('cannot drop type') ||
                error.message?.includes('other objects depend on it')) {
              console.log(`   ⚠️  Skipping (type in use): ${statement.substring(0, 50)}...`);
              continue;
            }
            // Ignore "column does not exist" - column was dropped by CASCADE
            if (error.code === '42703' || // column does not exist
                error.message?.includes('column') && error.message?.includes('does not exist')) {
              console.log(`   ⚠️  Skipping (column missing): ${statement.substring(0, 50)}...`);
              continue;
            }
            console.error(`❌ Error executing statement in ${file}:`, error);
            throw error;
          }
        }
      }
      
      // Record migration
      await client`
        INSERT INTO drizzle.__drizzle_migrations (hash) VALUES (${hash})
      `;
      
      console.log(`✅ Applied ${file}`);
    }
    
    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

runMigrations().catch(console.error);
