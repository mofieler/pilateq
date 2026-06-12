-- ============================================================================
-- FIX: Session package credits_amount should equal the number of sessions
-- ============================================================================
-- For session packages (category='session'), 1 credit = 1 session.
-- So a package named "Private Reformer · 10 sessions" should have credits_amount=10.
--
-- This script shows current vs expected values, then offers an UPDATE.

-- ─── 1. Inspect all session packages ────────────────────────────────────────
\echo '\n=== Current session packages ==='
SELECT
  "id",
  "name",
  "credits_amount" AS current_credits,
  "category",
  "credit_type",
  "is_active"
FROM "credit_packages"
WHERE "category" = 'session'
ORDER BY "name";

-- ─── 2. Show expected credits extracted from name ───────────────────────────
-- Extracts the first integer found in the package name.
-- e.g. "Private Reformer · 10 sessions" → 10
-- e.g. "Duo Mat · 8 Sessions" → 8
\echo '\n=== Expected credits (extracted from name) ==='
SELECT
  "id",
  "name",
  "credits_amount" AS current_credits,
  COALESCE(
    (regexp_match("name", '(\d+)\s*(session|Session|SESSION|Kurs|kurs)'))[1]::int,
    (regexp_match("name", '(\d+)'))[1]::int,
    "credits_amount"
  ) AS expected_credits
FROM "credit_packages"
WHERE "category" = 'session'
ORDER BY "name";

-- ─── 3. Preview what would change ───────────────────────────────────────────
\echo '\n=== Packages that would be updated ==='
SELECT
  "id",
  "name",
  "credits_amount" AS old_credits,
  COALESCE(
    (regexp_match("name", '(\d+)\s*(session|Session|SESSION|Kurs|kurs)'))[1]::int,
    (regexp_match("name", '(\d+)'))[1]::int,
    "credits_amount"
  ) AS new_credits
FROM "credit_packages"
WHERE "category" = 'session'
  AND "credits_amount" != COALESCE(
    (regexp_match("name", '(\d+)\s*(session|Session|SESSION|Kurs|kurs)'))[1]::int,
    (regexp_match("name", '(\d+)'))[1]::int,
    "credits_amount"
  );

-- ─── 4. APPLY THE FIX (uncomment to run) ────────────────────────────────────
-- \echo '\n=== Applying fix... ==='
-- UPDATE "credit_packages"
-- SET "credits_amount" = COALESCE(
--   (regexp_match("name", '(\d+)\s*(session|Session|SESSION|Kurs|kurs)'))[1]::int,
--   (regexp_match("name", '(\d+)'))[1]::int,
--   "credits_amount"
-- )
-- WHERE "category" = 'session';

-- ─── 5. Verify after fix ────────────────────────────────────────────────────
-- \echo '\n=== After fix ==='
-- SELECT "name", "credits_amount" FROM "credit_packages" WHERE "category" = 'session' ORDER BY "name";
