import { db } from '@/db';
import { sql } from 'drizzle-orm';

async function fixEnum() {
  console.log('🔧 Fixing credit_type enum...');
  
  try {
    // Drop and recreate the enum
    await db.execute(sql`
      DROP TYPE IF EXISTS "public"."credit_type" CASCADE;
    `);
    
    await db.execute(sql`
      CREATE TYPE "public"."credit_type" AS ENUM('mat_group', 'reformer_group', 'private_session');
    `);
    
    // Update all tables to use the new enum
    await db.execute(sql`
      ALTER TABLE "credit_packages" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
    `);
    
    await db.execute(sql`
      ALTER TABLE "credit_balances" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
    `);
    
    await db.execute(sql`
      ALTER TABLE "bookings" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
    `);
    
    await db.execute(sql`
      ALTER TABLE "class_templates" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
    `);
    
    await db.execute(sql`
      ALTER TABLE "credit_purchases" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
    `);
    
    await db.execute(sql`
      ALTER TABLE "credit_transactions" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
    `);
    
    console.log('✅ Enum fixed successfully!');
  } catch (error) {
    console.error('❌ Error fixing enum:', error);
    throw error;
  }
}

fixEnum().catch(console.error);
