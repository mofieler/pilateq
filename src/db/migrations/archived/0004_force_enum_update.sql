-- Force update the credit_type enum by dropping and recreating it
-- This ensures the new enum values are properly applied
DROP TYPE IF EXISTS "public"."credit_type" CASCADE;
CREATE TYPE "public"."credit_type" AS ENUM('mat_group', 'reformer_group', 'private_session');

-- Update all tables to use the new enum
ALTER TABLE "credit_packages" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
ALTER TABLE "credit_balances" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
ALTER TABLE "bookings" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
ALTER TABLE "class_templates" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
ALTER TABLE "credit_purchases" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
ALTER TABLE "credit_transactions" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
