-- ============================================================================
-- VERIFICATION + FIX: Credit Packages & Memberships
-- ============================================================================
-- Run this in psql. It will show you EXACTLY what is in the DB right now,
-- then fix anything that is still wrong.
-- ============================================================================

-- ─── 1. FULL DUMP: every active credit package ──────────────────────────────
\echo '\n=== ACTIVE CREDIT PACKAGES (current reality) ==='
SELECT
  "id",
  "name",
  "credits_amount",
  "price_cents" / 100.0 AS price_eur,
  "validity_weeks",
  "validity_days",
  "category",
  "credit_type",
  "is_active",
  "sort_order"
FROM "credit_packages"
WHERE "is_active" = true
ORDER BY "sort_order", "name";

-- ─── 2. FULL DUMP: every active membership plan ─────────────────────────────
\echo '\n=== ACTIVE MEMBERSHIP PLANS (current reality) ==='
SELECT
  "id",
  "name",
  "weekly_credits",
  "duration_weeks",
  "price_cents" / 100.0 AS price_eur,
  "credit_type",
  "is_active",
  "sort_order"
FROM "membership_plans"
WHERE "is_active" = true
ORDER BY "sort_order", "name";

-- ─── 3. VALIDITY WEEKS CHECK ────────────────────────────────────────────────
\echo '\n=== VALIDITY AUDIT (what SHOULD be vs what IS) ==='
SELECT
  "name",
  "validity_weeks" AS current_weeks,
  CASE "name"
    WHEN 'Welcome Journey' THEN 52
    WHEN 'Essence'         THEN 5
    WHEN 'Empower'         THEN 7
    WHEN 'Bloom'           THEN 9
    WHEN 'Return to Life'  THEN 12
    ELSE "validity_weeks"
  END AS expected_weeks,
  CASE
    WHEN "validity_weeks" = CASE "name"
      WHEN 'Welcome Journey' THEN 52
      WHEN 'Essence'         THEN 5
      WHEN 'Empower'         THEN 7
      WHEN 'Bloom'           THEN 9
      WHEN 'Return to Life'  THEN 12
      ELSE "validity_weeks"
    END THEN '✅ OK'
    ELSE '❌ NEEDS FIX'
  END AS status
FROM "credit_packages"
WHERE "name" IN ('Welcome Journey', 'Essence', 'Empower', 'Bloom', 'Return to Life')
ORDER BY "sort_order";

-- ─── 4. PRICE CHECK ─────────────────────────────────────────────────────────
\echo '\n=== PRICE AUDIT (what SHOULD be vs what IS) ==='
SELECT
  "name",
  "price_cents" / 100.0 AS current_eur,
  CASE "name"
    WHEN 'Welcome Journey' THEN 120
    WHEN 'Essence'         THEN 115
    WHEN 'Empower'         THEN 220
    WHEN 'Bloom'           THEN 340
    WHEN 'Return to Life'  THEN 660
    ELSE "price_cents" / 100.0
  END AS expected_eur,
  CASE
    WHEN "price_cents" = CASE "name"
      WHEN 'Welcome Journey' THEN 12000
      WHEN 'Essence'         THEN 11500
      WHEN 'Empower'         THEN 22000
      WHEN 'Bloom'           THEN 34000
      WHEN 'Return to Life'  THEN 66000
      ELSE "price_cents"
    END THEN '✅ OK'
    ELSE '❌ NEEDS FIX'
  END AS status
FROM "credit_packages"
WHERE "name" IN ('Welcome Journey', 'Essence', 'Empower', 'Bloom', 'Return to Life')
ORDER BY "sort_order";

-- ─── 5. FIX validity weeks (run this only if step 3 shows ❌) ───────────────
\echo '\n=== FIXING validity weeks... ==='
UPDATE "credit_packages" SET "validity_weeks" = 52, "validity_days" = 364, "updated_at" = NOW() WHERE "name" = 'Welcome Journey';
UPDATE "credit_packages" SET "validity_weeks" = 5,  "validity_days" = 35,  "updated_at" = NOW() WHERE "name" = 'Essence';
UPDATE "credit_packages" SET "validity_weeks" = 7,  "validity_days" = 49,  "updated_at" = NOW() WHERE "name" = 'Empower';
UPDATE "credit_packages" SET "validity_weeks" = 9,  "validity_days" = 63,  "updated_at" = NOW() WHERE "name" = 'Bloom';
UPDATE "credit_packages" SET "validity_weeks" = 12, "validity_days" = 84,  "updated_at" = NOW() WHERE "name" = 'Return to Life';

-- ─── 6. FIX prices (safety net — idempotent) ────────────────────────────────
\echo '\n=== FIXING prices... ==='
UPDATE "credit_packages" SET "price_cents" = 12000, "updated_at" = NOW() WHERE "name" = 'Welcome Journey';
UPDATE "credit_packages" SET "price_cents" = 11500, "updated_at" = NOW() WHERE "name" = 'Essence';
UPDATE "credit_packages" SET "price_cents" = 22000, "updated_at" = NOW() WHERE "name" = 'Empower';
UPDATE "credit_packages" SET "price_cents" = 34000, "updated_at" = NOW() WHERE "name" = 'Bloom';
UPDATE "credit_packages" SET "price_cents" = 66000, "updated_at" = NOW() WHERE "name" = 'Return to Life';

-- ─── 7. FIX membership prices (safety net) ──────────────────────────────────
\echo '\n=== FIXING membership prices... ==='
UPDATE "membership_plans" SET "price_cents" = 14500, "updated_at" = NOW() WHERE "name" ILIKE '%1%x%week%' OR "name" ILIKE '%1 x week%' OR "name" = '1x Week';
UPDATE "membership_plans" SET "price_cents" = 24500, "updated_at" = NOW() WHERE "name" ILIKE '%2%x%week%' OR "name" ILIKE '%2 x week%' OR "name" = '2x Week';

-- ─── 8. FINAL VERIFICATION ──────────────────────────────────────────────────
\echo '\n=== FINAL STATE: credit_packages ==='
SELECT
  "name",
  "credits_amount",
  "price_cents" / 100.0 AS price_eur,
  "validity_weeks",
  "validity_days",
  "category",
  "is_active"
FROM "credit_packages"
WHERE "name" IN ('Welcome Journey', 'Essence', 'Empower', 'Bloom', 'Return to Life')
ORDER BY "sort_order";

\echo '\n=== FINAL STATE: membership_plans ==='
SELECT "name", "weekly_credits", "duration_weeks", "price_cents" / 100.0 AS price_eur, "is_active"
FROM "membership_plans"
WHERE "is_active" = true
ORDER BY "sort_order", "name";
