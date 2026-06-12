import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function migrate() {
  console.log('🔄 Migrating credit_type enum from standard/premium/vip → mat_group/reformer_group/private_session...');

  // PostgreSQL doesn't allow removing enum values directly.
  // Strategy: create new type, migrate all columns, drop old type, rename.
  await sql.unsafe(`
    DO $$
    BEGIN
      -- Step 1: Create the new enum type (if it doesn't exist already)
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_type_new') THEN
        CREATE TYPE credit_type_new AS ENUM ('mat_group', 'reformer_group', 'private_session');
      END IF;

      -- Step 2: Alter each column that uses credit_type
      -- class_templates.credit_type
      ALTER TABLE class_templates
        ALTER COLUMN credit_type DROP DEFAULT,
        ALTER COLUMN credit_type TYPE credit_type_new
          USING CASE credit_type::text
            WHEN 'standard' THEN 'mat_group'::credit_type_new
            WHEN 'premium'  THEN 'reformer_group'::credit_type_new
            WHEN 'vip'      THEN 'private_session'::credit_type_new
            WHEN 'mat_group'       THEN 'mat_group'::credit_type_new
            WHEN 'reformer_group'  THEN 'reformer_group'::credit_type_new
            WHEN 'private_session' THEN 'private_session'::credit_type_new
            ELSE 'mat_group'::credit_type_new
          END;

      -- credit_packages.credit_type
      ALTER TABLE credit_packages
        ALTER COLUMN credit_type DROP DEFAULT,
        ALTER COLUMN credit_type TYPE credit_type_new
          USING CASE credit_type::text
            WHEN 'standard' THEN 'mat_group'::credit_type_new
            WHEN 'premium'  THEN 'reformer_group'::credit_type_new
            WHEN 'vip'      THEN 'private_session'::credit_type_new
            WHEN 'mat_group'       THEN 'mat_group'::credit_type_new
            WHEN 'reformer_group'  THEN 'reformer_group'::credit_type_new
            WHEN 'private_session' THEN 'private_session'::credit_type_new
            ELSE 'mat_group'::credit_type_new
          END;

      -- credit_balances.credit_type
      ALTER TABLE credit_balances
        ALTER COLUMN credit_type TYPE credit_type_new
          USING CASE credit_type::text
            WHEN 'standard' THEN 'mat_group'::credit_type_new
            WHEN 'premium'  THEN 'reformer_group'::credit_type_new
            WHEN 'vip'      THEN 'private_session'::credit_type_new
            WHEN 'mat_group'       THEN 'mat_group'::credit_type_new
            WHEN 'reformer_group'  THEN 'reformer_group'::credit_type_new
            WHEN 'private_session' THEN 'private_session'::credit_type_new
            ELSE 'mat_group'::credit_type_new
          END;

      -- credit_transactions.credit_type
      ALTER TABLE credit_transactions
        ALTER COLUMN credit_type TYPE credit_type_new
          USING CASE credit_type::text
            WHEN 'standard' THEN 'mat_group'::credit_type_new
            WHEN 'premium'  THEN 'reformer_group'::credit_type_new
            WHEN 'vip'      THEN 'private_session'::credit_type_new
            WHEN 'mat_group'       THEN 'mat_group'::credit_type_new
            WHEN 'reformer_group'  THEN 'reformer_group'::credit_type_new
            WHEN 'private_session' THEN 'private_session'::credit_type_new
            ELSE 'mat_group'::credit_type_new
          END;

      -- credit_purchases.credit_type
      ALTER TABLE credit_purchases
        ALTER COLUMN credit_type TYPE credit_type_new
          USING CASE credit_type::text
            WHEN 'standard' THEN 'mat_group'::credit_type_new
            WHEN 'premium'  THEN 'reformer_group'::credit_type_new
            WHEN 'vip'      THEN 'private_session'::credit_type_new
            WHEN 'mat_group'       THEN 'mat_group'::credit_type_new
            WHEN 'reformer_group'  THEN 'reformer_group'::credit_type_new
            WHEN 'private_session' THEN 'private_session'::credit_type_new
            ELSE 'mat_group'::credit_type_new
          END;

      -- bookings.credit_type
      ALTER TABLE bookings
        ALTER COLUMN credit_type TYPE credit_type_new
          USING CASE credit_type::text
            WHEN 'standard' THEN 'mat_group'::credit_type_new
            WHEN 'premium'  THEN 'reformer_group'::credit_type_new
            WHEN 'vip'      THEN 'private_session'::credit_type_new
            WHEN 'mat_group'       THEN 'mat_group'::credit_type_new
            WHEN 'reformer_group'  THEN 'reformer_group'::credit_type_new
            WHEN 'private_session' THEN 'private_session'::credit_type_new
            ELSE 'mat_group'::credit_type_new
          END;

      -- Step 3: Drop old enum
      DROP TYPE credit_type;

      -- Step 4: Rename new enum to credit_type
      ALTER TYPE credit_type_new RENAME TO credit_type;

    END
    $$;
  `);

  console.log('✅ Enum migration complete!');
  await sql.end();
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
