import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const client = postgres(connectionString);
const db = drizzle(client);

async function checkUser() {
  console.log('🔍 Checking admin user in database...');

  try {
    const adminUser = await db.select().from(users).where(eq(users.email, 'admin@pilatesos.com')).limit(1);
    
    if (adminUser.length > 0) {
      console.log('✅ Found admin user:', adminUser[0]);
      console.log('📧 Email:', adminUser[0].email);
      console.log('👤 Name:', adminUser[0].name);
      console.log('🔑 Role:', adminUser[0].role);
      console.log('🔐 Has Password Hash:', !!adminUser[0].passwordHash);
      console.log('📝 Waiver Status: No longer required - removed from system');
      
      // Test password verification
      const bcrypt = require('bcryptjs');
      const isValidPassword = await bcrypt.compare('password123', adminUser[0].passwordHash);
      console.log('✅ Password "password123" is valid:', isValidPassword);
    } else {
      console.log('❌ Admin user not found!');
    }
    
  } catch (error) {
    console.error('❌ Error checking user:', error);
  } finally {
    await client.end();
  }
}

checkUser().catch(console.error);
