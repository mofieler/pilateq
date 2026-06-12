import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

let connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Replace container hostname with localhost for host-based execution
connectionString = connectionString.replace(/@o138vve7mqivp0kmx1uhnxj5:/, '@localhost:');
connectionString = connectionString.replace(/@aura-dev-postgres-1:/, '@localhost:');

const client = postgres(connectionString);

async function checkTables() {
  console.log('🔍 Checking tables in database...');

  try {
    const result = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    console.log('✅ Found tables:');
    result.forEach((row: any) => {
      console.log(`- ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking tables:', error);
  } finally {
    await client.end();
  }
}

checkTables().catch(console.error);
