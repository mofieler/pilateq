-- Migration: Remove waiver logic completely
-- Description: Drop waivers table and remove has_signed_waiver column from users table
-- This allows users to book without signing a waiver

-- Step 1: Drop the waivers table completely
DROP TABLE IF EXISTS "waivers" CASCADE;

-- Step 2: Remove has_signed_waiver column from users table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'has_signed_waiver'
    ) THEN
        ALTER TABLE "users" DROP COLUMN "has_signed_waiver";
    END IF;
END
$$;
