-- ============================================================
-- Pilates OS — Enum migration: class_type + credit_type
-- Run directly in your VPS PostgreSQL terminal:
--   psql $DATABASE_URL -f migrate-enums.sql
-- ============================================================
-- This script migrates from the old enum values to the new ones:
--
--   OLD class_type: mat, reformer, private, duo, group, online, sound_healing
--   NEW class_type: reformer_group, reformer_private, reformer_duo,
--                   mat_group, mat_private, mat_duo, online, sound_healing
--
--   OLD credit_type: mat_group, reformer_group, private_session,
--                    duo_group, general_group, online_class, sound_healing
--   NEW credit_type: reformer, mat
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- STEP 1: Add new enum values to existing enum types
--         (PostgreSQL requires ALTER TYPE ... ADD VALUE for each)
-- ─────────────────────────────────────────────────────────────

-- Add new class_type values
ALTER TYPE class_type ADD VALUE IF NOT EXISTS 'reformer_group';
ALTER TYPE class_type ADD VALUE IF NOT EXISTS 'reformer_private';
ALTER TYPE class_type ADD VALUE IF NOT EXISTS 'reformer_duo';
ALTER TYPE class_type ADD VALUE IF NOT EXISTS 'mat_group';
ALTER TYPE class_type ADD VALUE IF NOT EXISTS 'mat_private';
ALTER TYPE class_type ADD VALUE IF NOT EXISTS 'mat_duo';
-- 'online' and 'sound_healing' already exist in old enum — no-op

-- Add new credit_type values
ALTER TYPE credit_type ADD VALUE IF NOT EXISTS 'reformer';
ALTER TYPE credit_type ADD VALUE IF NOT EXISTS 'mat';

-- Note: ALTER TYPE ADD VALUE cannot run inside a transaction on some
-- PostgreSQL versions. If you get an error here, run the ALTER TYPE
-- statements outside the transaction, then re-run the rest.

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- STEP 2: Update data to use new values
--         Run each UPDATE inside its own transaction for safety.
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- ── class_templates: classType ────────────────────────────────
UPDATE class_templates SET class_type = 'mat_group'        WHERE class_type = 'mat';
UPDATE class_templates SET class_type = 'reformer_group'   WHERE class_type = 'reformer';
UPDATE class_templates SET class_type = 'reformer_private' WHERE class_type = 'private';
UPDATE class_templates SET class_type = 'reformer_duo'     WHERE class_type = 'duo';
UPDATE class_templates SET class_type = 'mat_group'        WHERE class_type = 'group';
-- 'online' and 'sound_healing' are unchanged

-- ── class_templates: creditType ───────────────────────────────
UPDATE class_templates SET credit_type = 'reformer' WHERE credit_type = 'reformer_group';
UPDATE class_templates SET credit_type = 'mat'      WHERE credit_type = 'mat_group';
UPDATE class_templates SET credit_type = 'reformer' WHERE credit_type = 'private_session';
UPDATE class_templates SET credit_type = 'mat'      WHERE credit_type = 'duo_group';
UPDATE class_templates SET credit_type = 'mat'      WHERE credit_type = 'general_group';
UPDATE class_templates SET credit_type = 'mat'      WHERE credit_type = 'online_class';
UPDATE class_templates SET credit_type = 'mat'      WHERE credit_type = 'sound_healing';

-- ── credit_packages: creditType ───────────────────────────────
UPDATE credit_packages SET credit_type = 'reformer' WHERE credit_type = 'reformer_group';
UPDATE credit_packages SET credit_type = 'mat'      WHERE credit_type = 'mat_group';
UPDATE credit_packages SET credit_type = 'reformer' WHERE credit_type = 'private_session';
UPDATE credit_packages SET credit_type = 'mat'      WHERE credit_type = 'duo_group';
UPDATE credit_packages SET credit_type = 'mat'      WHERE credit_type = 'general_group';
UPDATE credit_packages SET credit_type = 'mat'      WHERE credit_type = 'online_class';
UPDATE credit_packages SET credit_type = 'mat'      WHERE credit_type = 'sound_healing';

-- ── credit_balances: creditType ───────────────────────────────
-- Merge duplicate balances: if a user has both old mat_group + duo_group,
-- they both roll into 'mat' — sum them first, then delete duplicates.
-- Safe approach: update then deduplicate.
UPDATE credit_balances SET credit_type = 'reformer' WHERE credit_type = 'reformer_group';
UPDATE credit_balances SET credit_type = 'mat'      WHERE credit_type = 'mat_group';
UPDATE credit_balances SET credit_type = 'reformer' WHERE credit_type = 'private_session';
UPDATE credit_balances SET credit_type = 'mat'      WHERE credit_type = 'duo_group';
UPDATE credit_balances SET credit_type = 'mat'      WHERE credit_type = 'general_group';
UPDATE credit_balances SET credit_type = 'mat'      WHERE credit_type = 'online_class';
UPDATE credit_balances SET credit_type = 'mat'      WHERE credit_type = 'sound_healing';

-- Deduplicate: if the same user now has two 'mat' or two 'reformer' rows
-- (e.g. one was mat_group, another was duo_group), merge them.
-- This sums the balances and keeps one row.
WITH merged AS (
  SELECT
    user_id,
    credit_type,
    SUM(balance) AS total_balance,
    MIN(expires_at) AS earliest_expiry,
    MIN(id) AS keep_id
  FROM credit_balances
  GROUP BY user_id, credit_type
  HAVING COUNT(*) > 1
)
UPDATE credit_balances cb
SET balance = merged.total_balance,
    expires_at = merged.earliest_expiry
FROM merged
WHERE cb.id = merged.keep_id;

-- Delete the duplicate rows (keep only the one with MIN(id))
DELETE FROM credit_balances
WHERE id NOT IN (
  SELECT MIN(id)
  FROM credit_balances
  GROUP BY user_id, credit_type
);

-- ── credit_transactions: creditType ───────────────────────────
UPDATE credit_transactions SET credit_type = 'reformer' WHERE credit_type = 'reformer_group';
UPDATE credit_transactions SET credit_type = 'mat'      WHERE credit_type = 'mat_group';
UPDATE credit_transactions SET credit_type = 'reformer' WHERE credit_type = 'private_session';
UPDATE credit_transactions SET credit_type = 'mat'      WHERE credit_type = 'duo_group';
UPDATE credit_transactions SET credit_type = 'mat'      WHERE credit_type = 'general_group';
UPDATE credit_transactions SET credit_type = 'mat'      WHERE credit_type = 'online_class';
UPDATE credit_transactions SET credit_type = 'mat'      WHERE credit_type = 'sound_healing';

-- ── credit_purchases: creditType ──────────────────────────────
UPDATE credit_purchases SET credit_type = 'reformer' WHERE credit_type = 'reformer_group';
UPDATE credit_purchases SET credit_type = 'mat'      WHERE credit_type = 'mat_group';
UPDATE credit_purchases SET credit_type = 'reformer' WHERE credit_type = 'private_session';
UPDATE credit_purchases SET credit_type = 'mat'      WHERE credit_type = 'duo_group';
UPDATE credit_purchases SET credit_type = 'mat'      WHERE credit_type = 'general_group';
UPDATE credit_purchases SET credit_type = 'mat'      WHERE credit_type = 'online_class';
UPDATE credit_purchases SET credit_type = 'mat'      WHERE credit_type = 'sound_healing';

-- ── bookings: creditType ──────────────────────────────────────
UPDATE bookings SET credit_type = 'reformer' WHERE credit_type = 'reformer_group';
UPDATE bookings SET credit_type = 'mat'      WHERE credit_type = 'mat_group';
UPDATE bookings SET credit_type = 'reformer' WHERE credit_type = 'private_session';
UPDATE bookings SET credit_type = 'mat'      WHERE credit_type = 'duo_group';
UPDATE bookings SET credit_type = 'mat'      WHERE credit_type = 'general_group';
UPDATE bookings SET credit_type = 'mat'      WHERE credit_type = 'online_class';
UPDATE bookings SET credit_type = 'mat'      WHERE credit_type = 'sound_healing';

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- STEP 3: Drop old enum values
--         PostgreSQL does NOT support DROP VALUE from an enum.
--         To remove old values we must replace the enum type.
--         This approach:
--           1. Creates new enum types with only the new values
--           2. Alters each column to use the new type (via USING cast)
--           3. Drops the old enum type
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- Create the replacement enum types
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

-- Alter class_templates
ALTER TABLE class_templates
  ALTER COLUMN class_type  TYPE class_type_new  USING class_type::text::class_type_new,
  ALTER COLUMN credit_type TYPE credit_type_new USING credit_type::text::credit_type_new;

-- Alter credit_packages
ALTER TABLE credit_packages
  ALTER COLUMN credit_type TYPE credit_type_new USING credit_type::text::credit_type_new;

-- Alter credit_balances
ALTER TABLE credit_balances
  ALTER COLUMN credit_type TYPE credit_type_new USING credit_type::text::credit_type_new;

-- Alter credit_transactions
ALTER TABLE credit_transactions
  ALTER COLUMN credit_type TYPE credit_type_new USING credit_type::text::credit_type_new;

-- Alter credit_purchases
ALTER TABLE credit_purchases
  ALTER COLUMN credit_type TYPE credit_type_new USING credit_type::text::credit_type_new;

-- Alter bookings
ALTER TABLE bookings
  ALTER COLUMN credit_type TYPE credit_type_new USING credit_type::text::credit_type_new;

-- Drop old types and rename new ones into place
DROP TYPE class_type;
DROP TYPE credit_type;

ALTER TYPE class_type_new  RENAME TO class_type;
ALTER TYPE credit_type_new RENAME TO credit_type;

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- STEP 4: Verify the migration
-- ─────────────────────────────────────────────────────────────

-- Check no old values remain
SELECT 'class_templates.class_type' AS col, class_type::text AS val, COUNT(*) FROM class_templates GROUP BY class_type;
SELECT 'class_templates.credit_type' AS col, credit_type::text AS val, COUNT(*) FROM class_templates GROUP BY credit_type;
SELECT 'credit_packages.credit_type' AS col, credit_type::text AS val, COUNT(*) FROM credit_packages GROUP BY credit_type;
SELECT 'credit_balances.credit_type' AS col, credit_type::text AS val, COUNT(*) FROM credit_balances GROUP BY credit_type;
SELECT 'bookings.credit_type' AS col, credit_type::text AS val, COUNT(*) FROM bookings GROUP BY credit_type;

-- Confirm enum definitions
SELECT typname, enumlabel FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE typname IN ('class_type', 'credit_type')
ORDER BY typname, enumsortorder;
