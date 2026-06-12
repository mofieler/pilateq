-- Migration: Add session package support with simplified categories
-- Description: Create enum, add category column, and add class_type for session packages

-- Step 1: Create the credit_pack_category enum with only credit and session values
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_pack_category') THEN
        CREATE TYPE "public"."credit_pack_category" AS ENUM ('credit', 'session');
    END IF;
END
$$;

-- Step 2: Add category column to credit_packages table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'credit_packages' AND column_name = 'category') THEN
        ALTER TABLE "credit_packages" ADD COLUMN "category" "public"."credit_pack_category" DEFAULT 'credit';
    END IF;
END
$$;

-- Step 3: Update any existing rows to have a category value
UPDATE "credit_packages" SET "category" = 'credit' WHERE "category" IS NULL;

-- Step 4: Add class_type column for session packages (mat/reformer selection)
ALTER TABLE "credit_packages" ADD COLUMN IF NOT EXISTS "class_type" varchar(50);

-- Step 5: Add indexes for performance
CREATE INDEX IF NOT EXISTS "credit_packages_class_type_idx" ON "credit_packages" ("class_type");
CREATE INDEX IF NOT EXISTS "credit_packages_category_idx" ON "credit_packages" ("category");
