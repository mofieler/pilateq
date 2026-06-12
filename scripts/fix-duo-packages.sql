-- ============================================================================
-- FIX: Duo packages must be category='session', credit_type='session'
-- ============================================================================
-- Duo classes (reformer_duo, mat_duo) use SESSION credits, not pass credits.
-- Any credit_package for duo with category='credit' is WRONG.

-- ─── 1. FIND duo-related packages that are incorrectly categorized ──────────
\echo '\n=== Duo packages with WRONG category (should be session) ==='
SELECT
  "id",
  "name",
  "category",
  "credit_type",
  "credits_amount",
  "is_active",
  '❌ WRONG: should be category=session, credit_type=session' AS issue
FROM "credit_packages"
WHERE "name" ILIKE '%duo%'
  AND ("category" != 'session' OR "credit_type" != 'session');

-- ─── 2. FIND all duo packages for review ────────────────────────────────────
\echo '\n=== ALL duo packages (should all be category=session) ==='
SELECT
  "id",
  "name",
  "category",
  "credit_type",
  "credits_amount",
  "is_active",
  CASE
    WHEN "category" = 'session' AND "credit_type" = 'session' THEN '✅ OK'
    ELSE '❌ WRONG'
  END AS status
FROM "credit_packages"
WHERE "name" ILIKE '%duo%'
ORDER BY "name";

-- ─── 3. APPLY FIX: Move all duo packages to session category ────────────────
-- Uncomment to run:
-- \echo '\n=== Applying fix... ==='
-- UPDATE "credit_packages"
-- SET
--   "category" = 'session',
--   "credit_type" = 'session'
-- WHERE "name" ILIKE '%duo%'
--   AND ("category" != 'session' OR "credit_type" != 'session');

-- ─── 4. VERIFY class_templates for duo have correct credit_type ─────────────
\echo '\n=== Duo class templates credit_type check ==='
SELECT
  "id",
  "name",
  "class_type",
  "credit_type",
  "credit_cost",
  CASE
    WHEN "credit_type" = 'session' THEN '✅ OK'
    ELSE '❌ WRONG: duo must use session credits'
  END AS status
FROM "class_templates"
WHERE "class_type" IN ('reformer_duo', 'mat_duo');

-- ─── 5. FIX duo class_templates if wrong ────────────────────────────────────
-- Uncomment if any rows above show ❌:
-- UPDATE "class_templates"
-- SET "credit_type" = 'session'
-- WHERE "class_type" IN ('reformer_duo', 'mat_duo')
--   AND "credit_type" != 'session';
