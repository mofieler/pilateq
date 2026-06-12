-- Migration: Fix credit types enum expansion
-- This migration properly handles the enum expansion by updating all dependent tables

-- Step 1: Update all tables that use credit_type enum to text first
ALTER TABLE "credit_packages" ALTER COLUMN "credit_type" TYPE text;
ALTER TABLE "credit_balances" ALTER COLUMN "credit_type" TYPE text;
ALTER TABLE "credit_transactions" ALTER COLUMN "credit_type" TYPE text;
ALTER TABLE "credit_purchases" ALTER COLUMN "credit_type" TYPE text;
ALTER TABLE "bookings" ALTER COLUMN "credit_type" TYPE text;
ALTER TABLE "class_templates" ALTER COLUMN "credit_type" TYPE text;

-- Step 2: Recreate the enum with all values
DROP TYPE IF EXISTS "public"."credit_type" CASCADE;
CREATE TYPE "public"."credit_type" AS ENUM('mat_group', 'reformer_group', 'private_session', 'duo_group', 'general_group', 'online_class', 'sound_healing');

-- Step 3: Convert text columns back to enum type
ALTER TABLE "credit_packages" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
ALTER TABLE "credit_balances" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
ALTER TABLE "credit_transactions" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
ALTER TABLE "credit_purchases" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
ALTER TABLE "bookings" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
ALTER TABLE "class_templates" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";

-- Step 4: Add validityWeeks column to credit_packages
ALTER TABLE "credit_packages" 
ADD COLUMN "validity_weeks" integer NOT NULL DEFAULT 52;

-- Step 5: Update existing packages to have default validityWeeks
UPDATE "credit_packages" 
SET "validity_weeks" = 52 
WHERE "validity_weeks" IS NULL;
