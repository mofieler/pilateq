-- Migration: Simplify credit system to single credit type and add chair class
-- Description: Wipe test data, update enums to single credit type, add chair class type, add session_cost column

-- Step 1: Add 'chair' to class_type enum
DO $$
BEGIN
    -- Drop existing enum
    DROP TYPE IF EXISTS "public"."class_type" CASCADE;

    -- Recreate enum with chair added
    CREATE TYPE "public"."class_type" AS ENUM (
        'reformer_group',
        'reformer_private',
        'reformer_duo',
        'mat_group',
        'mat_private',
        'mat_duo',
        'online',
        'sound_healing',
        'chair'
    );
END
$$;

-- Step 2: Update credit_type enum to single value
DO $$
BEGIN
    -- Drop existing enum
    DROP TYPE IF EXISTS "public"."credit_type" CASCADE;

    -- Recreate enum with single value
    CREATE TYPE "public"."credit_type" AS ENUM ('credit');
END
$$;

-- Step 3: Wipe all test user credit balances (test data only)
DELETE FROM credit_balances;

-- Step 4: Wipe all test credit transactions (test data only)
DELETE FROM credit_transactions;

-- Step 5: Wipe all test credit purchases (test data only)
DELETE FROM credit_purchases;

-- Step 6: Wipe all test credit adjustments (test data only)
DELETE FROM credit_adjustments;

-- Step 7: Update bookings credit_type to 'credit'
UPDATE bookings SET credit_type = 'credit' WHERE credit_type IN ('reformer', 'mat');

-- Step 8: Add session_cost column to class_templates
ALTER TABLE class_templates ADD COLUMN IF NOT EXISTS session_cost integer;

-- Step 9: Update class_templates credit_type to 'credit'
-- For group classes, set to 'credit' and session_cost to NULL
UPDATE class_templates
SET credit_type = 'credit', session_cost = NULL
WHERE class_type IN ('reformer_group', 'mat_group', 'online', 'sound_healing', 'chair');

-- For private/duo classes, set credit_type to 'credit', credit_cost to NULL, session_cost to 1
UPDATE class_templates
SET credit_type = 'credit', credit_cost = NULL, session_cost = 1
WHERE class_type IN ('reformer_private', 'reformer_duo', 'mat_private', 'mat_duo');
