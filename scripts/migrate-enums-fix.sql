-- ============================================================
-- Pilates OS — Enum migration FIX (run this after the original script failed)
-- Run: psql $DATABASE_URL -f migrate-enums-fix.sql
--
-- What this fixes:
--   1. Adds missing 'online' value to class_type (Step 1 assumed it existed)
--   2. Re-runs Step 3 with credit_adjustments included (was the missing table)
--
-- Safe to run: all data tables are empty (reset was done first).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- PRE-FLIGHT: check current enum state
-- ─────────────────────────────────────────────────────────────
SELECT typname, enumlabel
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE typname IN ('class_type', 'credit_type')
ORDER BY typname, enumsortorder;

-- ─────────────────────────────────────────────────────────────
-- STEP A: Add missing 'online' to class_type
-- ALTER TYPE ADD VALUE cannot run inside a transaction in PG < 12.
-- PG 16 supports it, but we run it outside for safety.
-- ─────────────────────────────────────────────────────────────
ALTER TYPE class_type ADD VALUE IF NOT EXISTS 'online';

-- ─────────────────────────────────────────────────────────────
-- STEP B: Replace both enum types — clean slate
--   Creates new enum types, migrates ALL columns (including
--   credit_adjustments which was missing from the original script),
--   then swaps the names.
--
--   All tables are empty so the USING cast never touches live rows.
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- Guard: drop any leftover _new types from a previous failed run
DROP TYPE IF EXISTS class_type_new;
DROP TYPE IF EXISTS credit_type_new;

CREATE TYPE class_type_new AS ENUM (
  'reformer_group',
  'reformer_private',
  'reformer_duo',
  'mat_group',
  'mat_private',
  'mat_duo',
  'online',
  'sound_healing'
);

CREATE TYPE credit_type_new AS ENUM (
  'reformer',
  'mat'
);

-- class_templates has both enum columns
ALTER TABLE class_templates
  ALTER COLUMN class_type  TYPE class_type_new  USING class_type::text::class_type_new,
  ALTER COLUMN credit_type TYPE credit_type_new USING credit_type::text::credit_type_new;

-- credit_packages
ALTER TABLE credit_packages
  ALTER COLUMN credit_type TYPE credit_type_new USING credit_type::text::credit_type_new;

-- credit_balances
ALTER TABLE credit_balances
  ALTER COLUMN credit_type TYPE credit_type_new USING credit_type::text::credit_type_new;

-- credit_transactions
ALTER TABLE credit_transactions
  ALTER COLUMN credit_type TYPE credit_type_new USING credit_type::text::credit_type_new;

-- credit_purchases
ALTER TABLE credit_purchases
  ALTER COLUMN credit_type TYPE credit_type_new USING credit_type::text::credit_type_new;

-- bookings
ALTER TABLE bookings
  ALTER COLUMN credit_type TYPE credit_type_new USING credit_type::text::credit_type_new;

-- credit_adjustments — THIS WAS MISSING FROM THE ORIGINAL SCRIPT
-- Use a mapping USING clause to convert old enum values to new ones
ALTER TABLE credit_adjustments
  ALTER COLUMN credit_type TYPE credit_type_new USING
    CASE
      WHEN credit_type::text IN ('reformer_group', 'private_session') THEN 'reformer'::credit_type_new
      WHEN credit_type::text IN ('mat_group', 'duo_group', 'general_group', 'online_class', 'sound_healing') THEN 'mat'::credit_type_new
      ELSE credit_type::text::credit_type_new
    END;

-- Swap: drop old types (no more dependents after the ALTER TABLEs above)
DROP TYPE class_type;
DROP TYPE credit_type;

ALTER TYPE class_type_new  RENAME TO class_type;
ALTER TYPE credit_type_new RENAME TO credit_type;

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- VERIFY: confirm only new values exist
-- ─────────────────────────────────────────────────────────────
SELECT typname, enumlabel
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE typname IN ('class_type', 'credit_type')
ORDER BY typname, enumsortorder;

-- Expected output:
--  class_type  | reformer_group
--  class_type  | reformer_private
--  class_type  | reformer_duo
--  class_type  | mat_group
--  class_type  | mat_private
--  class_type  | mat_duo
--  class_type  | online
--  class_type  | sound_healing
--  credit_type | reformer
--  credit_type | mat
