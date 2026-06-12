import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const connectionString = 'postgres://postgres:mysecretpassword@localhost:5432/postgres';
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const client = postgres(connectionString);

async function inspectColumns() {
  console.log('🔍 Inspecting columns...');
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
    console.error('❌ Error inspecting columns:', error);
  } finally {
    await client.end();
  }
}

inspectColumns().catch(console.error);
