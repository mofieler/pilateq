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

async function debugAuth() {
  console.log('🔍 Debugging authentication setup...');
  console.log('📡 DATABASE_URL:', connectionString);
  console.log('🌐 Hostname extracted:', connectionString.split('@')[1]?.split(':')[0]);

  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    await client`SELECT 1`;
    console.log('✅ Database connection successful');

    // Check all users
    console.log('👥 Checking all users in database...');
    const allUsers = await db.select().from(users);
    console.log(`📊 Found ${allUsers.length} users:`);
    
    for (const user of allUsers) {
      console.log(`   👤 ${user.email} | Role: ${user.role} | Has Password: ${!!user.passwordHash} | Waiver: No longer required`);
    }

    // Test password verification for admin
    console.log('🔐 Testing admin password verification...');
    const adminUser = allUsers.find(u => u.email === 'admin@pilatesos.com');
    if (adminUser) {
      const bcrypt = require('bcryptjs');
      const isValidPassword = await bcrypt.compare('password123', adminUser.passwordHash);
      console.log(`✅ Admin password verification: ${isValidPassword}`);
      
      if (!isValidPassword) {
        console.log('❌ PASSWORD HASH MISMATCH - RESEEDING ADMIN USER...');
        const newHash = await bcrypt.hash('password123', 10);
        await db.update(users)
          .set({ passwordHash: newHash })
          .where(eq(users.email, 'admin@pilatesos.com'));
        console.log('✅ Admin user password hash updated');
      }
    } else {
      console.log('❌ Admin user not found!');
    }

  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await client.end();
  }
}

debugAuth().catch(console.error);
