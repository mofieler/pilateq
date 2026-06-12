-- ═══════════════════════════════════════════════════════════════════════════
-- SPRINT 6 — Wallet Consolidation + Enum Reduction + Session Cost Update
-- ═══════════════════════════════════════════════════════════════════════════
-- Consolidates the four-wallet credit_type system (mat, reformer, group,
-- session) into two wallets (pass, session). Updates classTemplates so
-- private/duo costs match the new pricing (mat=3, reformer=5). Drops the
-- creditPackages.class_type marketing label column.
--
-- THIS IS THE HIGH-RISK TRANCHE. Run on staging first.
--
-- Prerequisites:
--   - Sprint 2, 3, 5 already applied
--   - Per-user invariant holds: balance.balance == SUM(active lot remaining)
--     (verified by the V1 query in sprint-5)
--   - Backup:
--       pg_dump $DATABASE_URL --format=custom --file=pre_sprint6.dump
--
-- Run in phases, one at a time. Each phase is a transaction; verify before
-- proceeding to the next.
--
-- After this completes, deploy the matching code cutover (separate commit):
--   - Remove GROUP_FALLBACK_CLASS_TYPES from BOOKING_RULES.ts
--   - Remove fallback branch in createBooking.action.ts
--   - Reduce CREDIT_LABEL maps to {pass, session}
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── PHASE 0 — Audit before consolidation ────────────────────────────────────

-- A. Which credit_type values are currently in use across all tables?
SELECT 'credit_balances'     AS tbl, credit_type::text AS type, COUNT(*) FROM credit_balances     GROUP BY credit_type
UNION ALL SELECT 'credit_lots',         credit_type::text, COUNT(*) FROM credit_lots         GROUP BY credit_type
UNION ALL SELECT 'credit_transactions', credit_type::text, COUNT(*) FROM credit_transactions GROUP BY credit_type
UNION ALL SELECT 'credit_packages',     credit_type::text, COUNT(*) FROM credit_packages     GROUP BY credit_type
UNION ALL SELECT 'credit_purchases',    credit_type::text, COUNT(*) FROM credit_purchases    GROUP BY credit_type
UNION ALL SELECT 'class_templates',     credit_type::text, COUNT(*) FROM class_templates     GROUP BY credit_type
UNION ALL SELECT 'bookings',            credit_type::text, COUNT(*) FROM bookings            GROUP BY credit_type
UNION ALL SELECT 'membership_plans',    credit_type::text, COUNT(*) FROM membership_plans    GROUP BY credit_type
UNION ALL SELECT 'user_memberships',    credit_type::text, COUNT(*) FROM user_memberships    GROUP BY credit_type
UNION ALL SELECT 'credit_adjustments',  credit_type::text, COUNT(*) FROM credit_adjustments  GROUP BY credit_type
ORDER BY tbl, type;

-- B. Users with multiple wallets (will be merged into one pass wallet)
SELECT user_id, ARRAY_AGG(credit_type ORDER BY credit_type) AS types, COUNT(*) AS wallets
FROM credit_balances
WHERE credit_type IN ('mat','reformer','group') AND balance > 0
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY wallets DESC, user_id
LIMIT 20;

-- C. Session-package class_type values (to be archived in description before drop)
SELECT id, name, credit_type, category, class_type, credits_amount, price_cents
FROM credit_packages
WHERE class_type IS NOT NULL
ORDER BY category, class_type;

-- D. Current private/duo class template costs (will be set to mat=3, reformer=5)
SELECT id, class_type, name, credit_cost, credit_type
FROM class_templates
WHERE class_type IN ('mat_private','mat_duo','reformer_private','reformer_duo')
ORDER BY class_type;


-- ─── PHASE 1 — Add 'pass' enum value ─────────────────────────────────────────
-- Postgres requires this as a separate transaction. After running, CLOSE the
-- psql session and reopen before running Phase 2 (the enum cache needs to
-- refresh).

ALTER TYPE credit_type ADD VALUE IF NOT EXISTS 'pass';

-- *** EXIT psql HERE (\q) and reopen before continuing. ***


-- ─── PHASE 2 — Re-label mat/reformer/group → pass ────────────────────────────

BEGIN;

UPDATE credit_lots         SET credit_type = 'pass' WHERE credit_type IN ('mat','reformer','group');
UPDATE credit_transactions SET credit_type = 'pass' WHERE credit_type IN ('mat','reformer','group');
UPDATE class_templates     SET credit_type = 'pass' WHERE credit_type IN ('mat','reformer','group');
UPDATE credit_packages     SET credit_type = 'pass' WHERE credit_type IN ('mat','reformer','group');
UPDATE membership_plans    SET credit_type = 'pass' WHERE credit_type IN ('mat','reformer','group');
UPDATE user_memberships    SET credit_type = 'pass' WHERE credit_type IN ('mat','reformer','group');
UPDATE credit_adjustments  SET credit_type = 'pass' WHERE credit_type IN ('mat','reformer','group');
UPDATE credit_purchases    SET credit_type = 'pass' WHERE credit_type IN ('mat','reformer','group');
UPDATE bookings            SET credit_type = 'pass' WHERE credit_type IN ('mat','reformer','group');

-- credit_balances needs special handling: multiple old rows per user must
-- be merged into a single 'pass' row. We SUM the balances and MAX the
-- expires_at so no one loses validity.
WITH merged AS (
  SELECT
    user_id,
    'pass'::credit_type                AS credit_type,
    SUM(balance)                       AS balance,
    MAX(expires_at)                    AS expires_at,
    MIN(created_at)                    AS created_at,
    MAX(updated_at)                    AS updated_at
  FROM credit_balances
  WHERE credit_type IN ('mat','reformer','group','pass')
  GROUP BY user_id
)
INSERT INTO credit_balances (user_id, credit_type, balance, expires_at, created_at, updated_at)
SELECT user_id, credit_type, balance, expires_at, created_at, updated_at
FROM merged
ON CONFLICT (user_id, credit_type)
DO UPDATE SET
  balance    = EXCLUDED.balance,
  expires_at = EXCLUDED.expires_at,
  updated_at = NOW();

-- Remove the old per-type rows (mat/reformer/group). Their balances were
-- merged into the 'pass' row above.
DELETE FROM credit_balances
WHERE credit_type IN ('mat','reformer','group');

-- Verify: per-user balance == sum of active lots (now all under 'pass')
WITH check_query AS (
  SELECT
    cb.user_id,
    cb.balance,
    COALESCE(SUM(cl.remaining_amount) FILTER (
      WHERE cl.status = 'active' AND cl.expires_at > NOW()
    ), 0) AS active_lot_sum
  FROM credit_balances cb
  LEFT JOIN credit_lots cl
    ON cl.user_id = cb.user_id AND cl.credit_type = cb.credit_type
  WHERE cb.credit_type = 'pass' AND cb.balance > 0
  GROUP BY cb.user_id, cb.balance
)
SELECT COUNT(*) AS drift_rows
FROM check_query
WHERE balance <> active_lot_sum;
-- Expected: 0. If non-zero, ROLLBACK and investigate.

COMMIT;


-- ─── PHASE 3 — Pre-flight: nothing references mat/reformer/group anymore ────

SELECT 'credit_lots'         AS tbl, COUNT(*) FROM credit_lots         WHERE credit_type::text IN ('mat','reformer','group')
UNION ALL SELECT 'credit_balances',     COUNT(*) FROM credit_balances     WHERE credit_type::text IN ('mat','reformer','group')
UNION ALL SELECT 'credit_transactions', COUNT(*) FROM credit_transactions WHERE credit_type::text IN ('mat','reformer','group')
UNION ALL SELECT 'class_templates',     COUNT(*) FROM class_templates     WHERE credit_type::text IN ('mat','reformer','group')
UNION ALL SELECT 'credit_packages',     COUNT(*) FROM credit_packages     WHERE credit_type::text IN ('mat','reformer','group')
UNION ALL SELECT 'bookings',            COUNT(*) FROM bookings            WHERE credit_type::text IN ('mat','reformer','group')
UNION ALL SELECT 'membership_plans',    COUNT(*) FROM membership_plans    WHERE credit_type::text IN ('mat','reformer','group')
UNION ALL SELECT 'user_memberships',    COUNT(*) FROM user_memberships    WHERE credit_type::text IN ('mat','reformer','group')
UNION ALL SELECT 'credit_adjustments',  COUNT(*) FROM credit_adjustments  WHERE credit_type::text IN ('mat','reformer','group')
UNION ALL SELECT 'credit_purchases',    COUNT(*) FROM credit_purchases    WHERE credit_type::text IN ('mat','reformer','group');
-- ALL ROWS MUST RETURN 0. If anything is non-zero, STOP and investigate.


-- ─── PHASE 4 — Rebuild credit_type enum (pass + session only) ───────────────

BEGIN;

ALTER TYPE credit_type RENAME TO credit_type_old;
CREATE TYPE credit_type AS ENUM ('pass', 'session');

ALTER TABLE credit_lots         ALTER COLUMN credit_type TYPE credit_type USING credit_type::text::credit_type;
ALTER TABLE credit_balances     ALTER COLUMN credit_type TYPE credit_type USING credit_type::text::credit_type;
ALTER TABLE credit_transactions ALTER COLUMN credit_type TYPE credit_type USING credit_type::text::credit_type;
ALTER TABLE class_templates     ALTER COLUMN credit_type TYPE credit_type USING credit_type::text::credit_type;
ALTER TABLE credit_packages     ALTER COLUMN credit_type TYPE credit_type USING credit_type::text::credit_type;
ALTER TABLE bookings            ALTER COLUMN credit_type TYPE credit_type USING credit_type::text::credit_type;
ALTER TABLE membership_plans    ALTER COLUMN credit_type TYPE credit_type USING credit_type::text::credit_type;
ALTER TABLE user_memberships    ALTER COLUMN credit_type TYPE credit_type USING credit_type::text::credit_type;
ALTER TABLE credit_adjustments  ALTER COLUMN credit_type TYPE credit_type USING credit_type::text::credit_type;
ALTER TABLE credit_purchases    ALTER COLUMN credit_type TYPE credit_type USING credit_type::text::credit_type;

DROP TYPE credit_type_old;

COMMIT;

-- Confirm the enum has the two expected values
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'credit_type'::regtype;
-- Expected: pass, session


-- ─── PHASE 5 — Update session class costs (mat=3, reformer=5) ───────────────
-- These are template-level values (not historical bookings). Historical
-- bookings keep their `credits_spent` snapshot from booking time.

BEGIN;

UPDATE class_templates
SET credit_cost = 3, credit_type = 'session'
WHERE class_type IN ('mat_private','mat_duo');

UPDATE class_templates
SET credit_cost = 5, credit_type = 'session'
WHERE class_type IN ('reformer_private','reformer_duo');

-- Verify the new costs
SELECT class_type, name, credit_cost, credit_type
FROM class_templates
WHERE class_type IN ('mat_private','mat_duo','reformer_private','reformer_duo')
ORDER BY class_type;

COMMIT;


-- ─── PHASE 6 — Drop credit_packages.class_type ───────────────────────────────
-- The class_type column was a marketing label ('mat'/'reformer') on session
-- packages. It was never used as a booking filter (session lots are a single
-- wallet). Archive the value into the description column before dropping.

BEGIN;

UPDATE credit_packages
SET description = COALESCE(description, '') ||
                  CASE WHEN class_type IS NOT NULL
                       THEN E'\n[migrated 2026-05-18] previous class_type: ' || class_type
                       ELSE '' END
WHERE class_type IS NOT NULL;

ALTER TABLE credit_packages DROP COLUMN class_type;

COMMIT;


-- ─── PHASE 7 — Final verification ────────────────────────────────────────────

-- V1. credit_type enum reduced to two values
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'credit_type'::regtype ORDER BY enumlabel;
-- Expected exactly: pass, session

-- V2. Per-user invariant still holds
WITH check_query AS (
  SELECT
    cb.user_id,
    cb.credit_type,
    cb.balance,
    COALESCE(SUM(cl.remaining_amount) FILTER (
      WHERE cl.status = 'active' AND cl.expires_at > NOW()
    ), 0) AS active_lot_sum
  FROM credit_balances cb
  LEFT JOIN credit_lots cl
    ON cl.user_id = cb.user_id AND cl.credit_type = cb.credit_type
  WHERE cb.balance > 0
  GROUP BY cb.user_id, cb.credit_type, cb.balance
)
SELECT COUNT(*) AS drift_rows FROM check_query WHERE balance <> active_lot_sum;
-- Expected: 0

-- V3. class_type column is gone
SELECT column_name FROM information_schema.columns
WHERE table_name = 'credit_packages' AND column_name = 'class_type';
-- Expected: 0 rows

-- V4. Session class costs updated
SELECT class_type, credit_cost FROM class_templates
WHERE class_type IN ('mat_private','mat_duo','reformer_private','reformer_duo')
ORDER BY class_type;
-- Expected:
--   mat_duo          | 3
--   mat_private      | 3
--   reformer_duo     | 5
--   reformer_private | 5

-- V5. Total credits in the system (sanity check — should match pre-migration)
SELECT
  (SELECT SUM(balance) FROM credit_balances WHERE balance > 0)                           AS total_balance,
  (SELECT SUM(remaining_amount) FROM credit_lots WHERE status='active')                  AS total_lot_remaining,
  (SELECT COUNT(DISTINCT user_id) FROM credit_balances WHERE balance > 0)                AS users_with_credits;

-- ═══════════════════════════════════════════════════════════════════════════
-- END Sprint 6 consolidation. Deploy the matching code cutover that removes
-- GROUP_FALLBACK_CLASS_TYPES and reduces CREDIT_LABEL maps.
-- ═══════════════════════════════════════════════════════════════════════════
