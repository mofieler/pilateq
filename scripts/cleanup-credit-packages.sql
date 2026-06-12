-- ============================================================================
-- CLEANUP: Credit Packages — Deduplicate, Clean Descriptions, Activate All
-- ============================================================================
-- This script fixes:
-- 1. Duplicate packages (old migrated vs new)
-- 2. Descriptions containing "[migrated ..." system log text
-- 3. Inactive packages that should be active
--
-- SAFE: checks purchases before deleting. Will skip packages with purchases.

-- ─── STEP 0: See current mess ───────────────────────────────────────────────
\echo '\n=== BEFORE: All packages ==='
SELECT
  "id",
  "name",
  "category",
  "credits_amount",
  "price_cents",
  "validity_days",
  "is_active",
  LEFT("description", 60) AS description_preview
FROM "credit_packages"
ORDER BY "name", "is_active" DESC, "updated_at" DESC;

-- ─── STEP 1: Which packages have purchases? (can't delete these) ────────────
\echo '\n=== Packages with existing purchases ==='
SELECT
  cp."id",
  cp."name",
  cp."is_active",
  COUNT(cpur."id") AS purchase_count
FROM "credit_packages" cp
LEFT JOIN "credit_purchases" cpur ON cpur."package_id" = cp."id"
GROUP BY cp."id", cp."name", cp."is_active"
HAVING COUNT(cpur."id") > 0;

-- ─── STEP 2: Delete inactive duplicates with migration log text ─────────────
-- These are the old migrated versions. Only delete if NO purchases.
\echo '\n=== Deleting inactive migrated duplicates... ==='
DELETE FROM "credit_packages"
WHERE "description" LIKE '%[migrated%'
  AND "is_active" = false
  AND "id" NOT IN (
    SELECT DISTINCT "package_id" FROM "credit_purchases" WHERE "package_id" IS NOT NULL
  );

-- ─── STEP 3: Delete other exact duplicates (same name, inactive, no purchases) ─
-- Keep the most recently updated one for each name.
\echo '\n=== Deleting other inactive duplicates... ==='
DELETE FROM "credit_packages" del
WHERE del."is_active" = false
  AND del."id" NOT IN (
    SELECT DISTINCT "package_id" FROM "credit_purchases" WHERE "package_id" IS NOT NULL
  )
  AND del."id" NOT IN (
    SELECT DISTINCT ON ("name") "id"
    FROM "credit_packages"
    ORDER BY "name", "updated_at" DESC
  );

-- ─── STEP 4: Clean migration text from remaining descriptions ───────────────
\echo '\n=== Cleaning migration text from descriptions... ==='
UPDATE "credit_packages"
SET "description" = REGEXP_REPLACE("description", '\s*\[migrated [^\]]*\][^\n]*', '', 'g')
WHERE "description" LIKE '%[migrated%';

-- Also trim any resulting trailing whitespace/empty descriptions
UPDATE "credit_packages"
SET "description" = NULL
WHERE TRIM("description") = '';

-- ─── STEP 5: Activate ALL remaining packages ────────────────────────────────
\echo '\n=== Activating all packages... ==='
UPDATE "credit_packages"
SET "is_active" = true
WHERE "is_active" = false;

-- ─── STEP 6: Verify final state ─────────────────────────────────────────────
\echo '\n=== AFTER: All packages (should be unique names, all active, clean desc) ==='
SELECT
  "name",
  "category",
  "credits_amount",
  "price_cents",
  "validity_days",
  "is_active",
  LEFT("description", 70) AS description_preview
FROM "credit_packages"
ORDER BY
  CASE "category" WHEN 'session' THEN 0 ELSE 1 END,
  "sort_order",
  "name";

\echo '\n=== Duplicate names check (should be empty) ==='
SELECT "name", COUNT(*) AS cnt
FROM "credit_packages"
GROUP BY "name"
HAVING COUNT(*) > 1;
