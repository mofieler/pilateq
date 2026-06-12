import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL?.replace('o138vve7mqivp0kmx1uhnxj5', '127.0.0.1');
if (!dbUrl) {
  console.error('DATABASE_URL is not set in .env.local');
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1 });
const db = drizzle(sql);

async function main() {
  console.log('Running custom migrations for promotions system...');
  
  try {
    // 1. Create promo_codes table
    console.log('Creating promo_codes table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "promo_codes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(50) NOT NULL UNIQUE,
        "type" varchar(20) NOT NULL,
        "value" integer NOT NULL,
        "max_uses" integer,
        "current_uses" integer NOT NULL DEFAULT 0,
        "max_uses_per_user" integer NOT NULL DEFAULT 1,
        "expires_at" timestamp with time zone,
        "package_id" uuid REFERENCES "credit_packages"("id") ON DELETE CASCADE,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `;
    
    // Create indexes for promo_codes
    console.log('Creating indexes for promo_codes...');
    await sql`CREATE INDEX IF NOT EXISTS "promo_codes_code_idx" ON "promo_codes" ("code");`;
    await sql`CREATE INDEX IF NOT EXISTS "promo_codes_is_active_idx" ON "promo_codes" ("is_active");`;
    await sql`CREATE INDEX IF NOT EXISTS "promo_codes_package_idx" ON "promo_codes" ("package_id");`;

    // 2. Add discount_price_cents to credit_packages
    console.log('Adding discount_price_cents to credit_packages...');
    await sql`
      ALTER TABLE "credit_packages" 
      ADD COLUMN IF NOT EXISTS "discount_price_cents" integer;
    `;

    // 3. Add promo_code_id to credit_purchases
    console.log('Adding promo_code_id to credit_purchases...');
    await sql`
      ALTER TABLE "credit_purchases" 
      ADD COLUMN IF NOT EXISTS "promo_code_id" uuid REFERENCES "promo_codes"("id") ON DELETE SET NULL;
    `;

    // 4. Create promo_usages table
    console.log('Creating promo_usages table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "promo_usages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "promo_id" uuid NOT NULL REFERENCES "promo_codes"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "purchase_id" uuid NOT NULL REFERENCES "credit_purchases"("id") ON DELETE CASCADE,
        "applied_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `;

    // Create indexes for promo_usages
    console.log('Creating indexes for promo_usages...');
    await sql`CREATE INDEX IF NOT EXISTS "promo_usages_promo_id_idx" ON "promo_usages" ("promo_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "promo_usages_user_id_idx" ON "promo_usages" ("user_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "promo_usages_purchase_id_idx" ON "promo_usages" ("purchase_id");`;

    console.log('Migrations applied successfully!');
  } catch (error) {
    console.error('Error applying migrations:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
