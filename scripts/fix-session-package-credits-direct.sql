-- ============================================================================
-- FIX: Session package credits — 1 session = 1 credit
-- ============================================================================
-- This updates ALL session packages (category='session') so that
-- credits_amount matches the number extracted from the package name.
--
-- Safe to run: only rows where current != expected are updated.

\echo '\n=== BEFORE: Session packages with wrong credits ==='
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

\echo '\n=== APPLYING FIX... ==='
UPDATE "credit_packages"
SET "credits_amount" = COALESCE(
  (regexp_match("name", '(\d+)\s*(session|Session|SESSION|Kurs|kurs)'))[1]::int,
  (regexp_match("name", '(\d+)'))[1]::int,
  "credits_amount"
)
WHERE "category" = 'session';

\echo '\n=== AFTER: Verify all session packages ==='
SELECT "name", "credits_amount" FROM "credit_packages"
WHERE "category" = 'session'
ORDER BY "name";
