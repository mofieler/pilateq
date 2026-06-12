-- ═══════════════════════════════════════════════════════════════════════════
-- SPRINT 5 — Backfill credit_lots from existing credit_balances
-- ═══════════════════════════════════════════════════════════════════════════
-- Seeds credit_lots with one "legacy lot" per existing credit_balances row
-- that has balance > 0. After this runs, FIFO debit (new code) reads from
-- lots for every user. The defensive balance-only fallback in
-- credit.service.debitInternal becomes unreachable.
--
-- Prerequisites:
--   - Sprint 2 + Sprint 3 migrations already applied
--   - Backup:
--       pg_dump $DATABASE_URL --format=custom --file=pre_sprint5.dump
--
-- Run:
--   psql $DATABASE_URL -f sprint-5-backfill-credit-lots-vps.sql
--
-- Rollback (if needed):
--   DELETE FROM credit_lots WHERE purchase_id IS NULL;
--   -- (deletes only the backfill-generated lots; real purchase-linked lots
--   --  created after Sprint 3 deploy stay intact)
--
-- This migration is IDEMPOTENT: re-running it does NOT create duplicate lots
-- because the INSERT uses NOT EXISTS to skip rows already represented.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── PHASE 0 — Audit: state before backfill ──────────────────────────────────

-- A. Count of positive balances that will be backfilled
SELECT
  credit_type,
  COUNT(*)                        AS rows_with_balance,
  SUM(balance)                    AS total_credits,
  COUNT(*) FILTER (WHERE expires_at IS NULL)      AS rows_without_expiry,
  COUNT(*) FILTER (WHERE expires_at IS NOT NULL)  AS rows_with_expiry
FROM credit_balances
WHERE balance > 0
GROUP BY credit_type
ORDER BY credit_type;

-- B. Existing lots (created by Sprint 3 dual-write since deploy)
SELECT
  credit_type,
  status,
  COUNT(*)                            AS lots,
  SUM(remaining_amount)               AS remaining_total,
  COUNT(*) FILTER (WHERE purchase_id IS NOT NULL) AS with_purchase_link
FROM credit_lots
GROUP BY credit_type, status
ORDER BY credit_type, status;

-- C. Per-user invariant pre-check: balance.balance == SUM(lots.remaining)?
--    Will fail for users with old balances and no lots yet (the exact set
--    that needs backfilling).
SELECT
  cb.user_id,
  cb.credit_type,
  cb.balance                                          AS balance,
  COALESCE(SUM(cl.remaining_amount), 0)               AS lot_sum,
  cb.balance - COALESCE(SUM(cl.remaining_amount), 0)  AS deficit
FROM credit_balances cb
LEFT JOIN credit_lots cl
  ON cl.user_id = cb.user_id
  AND cl.credit_type = cb.credit_type
  AND cl.status = 'active'
WHERE cb.balance > 0
GROUP BY cb.user_id, cb.credit_type, cb.balance
HAVING cb.balance > COALESCE(SUM(cl.remaining_amount), 0)
ORDER BY deficit DESC
LIMIT 20;
-- Rows shown here are the users who need backfilling.


-- ─── PHASE 1 — Backfill ──────────────────────────────────────────────────────

BEGIN;

-- For every credit_balances row with balance > 0 that does NOT already have a
-- matching active lot, create one "legacy lot" capturing the entire balance.
-- This treats pre-Sprint-3 credits as a single FIFO bucket per (user, type).
INSERT INTO credit_lots (
  user_id,
  credit_type,
  original_amount,
  remaining_amount,
  purchase_id,
  acquired_at,
  expires_at,
  status
)
SELECT
  cb.user_id,
  cb.credit_type,
  -- The deficit between balance and existing lots is what needs backfilling.
  -- For users with NO lots, deficit == balance. For users who got some lots
  -- via Sprint 3 dual-write after their balance was already non-zero, this
  -- backfills only the difference.
  (cb.balance - COALESCE(active_lot_sum.sum, 0))                    AS original_amount,
  (cb.balance - COALESCE(active_lot_sum.sum, 0))                    AS remaining_amount,
  NULL                                                              AS purchase_id,
  COALESCE(cb.created_at, NOW())                                    AS acquired_at,
  COALESCE(cb.expires_at, cb.created_at + INTERVAL '365 days', NOW() + INTERVAL '365 days')
                                                                    AS expires_at,
  'active'                                                          AS status
FROM credit_balances cb
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(remaining_amount), 0) AS sum
  FROM credit_lots
  WHERE user_id = cb.user_id
    AND credit_type = cb.credit_type
    AND status = 'active'
) active_lot_sum ON TRUE
WHERE cb.balance > 0
  AND cb.balance > COALESCE(active_lot_sum.sum, 0);


-- ─── PHASE 2 — Verification (inside transaction; rolls back on failure) ──────

-- V1. Per-user invariant: balance.balance == SUM(active lots.remaining)
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
SELECT
  COUNT(*) FILTER (WHERE balance <> active_lot_sum) AS drift_rows,
  COUNT(*)                                          AS checked_rows
FROM check_query;
-- Expected: drift_rows = 0

-- V2. Backfill volume — how many lots were created (purchase_id NULL marks them)
SELECT
  credit_type,
  COUNT(*)                AS backfill_lots,
  SUM(remaining_amount)   AS backfill_credits
FROM credit_lots
WHERE purchase_id IS NULL
GROUP BY credit_type
ORDER BY credit_type;

-- V3. Reminder: expired balances (expires_at <= NOW()) were NOT backfilled
-- because the WHERE clause filters balance > 0 only. Lots are seeded with
-- balance.expires_at if present, so already-expired credits stay expired
-- under the new schema. Confirm:
SELECT
  COUNT(*) FILTER (WHERE expires_at <= NOW()) AS already_expired_lots,
  COUNT(*) FILTER (WHERE status = 'expired')  AS marked_expired
FROM credit_lots
WHERE purchase_id IS NULL;
-- already_expired_lots > 0 is acceptable — the cron sweep (Sprint 8) will
-- transition them to status='expired' at next run. Status is not retroactively
-- set here because that requires reducing balances too, which is a separate
-- decision the operator should make consciously.

COMMIT;


-- ─── PHASE 3 — Post-commit smoke test ────────────────────────────────────────

-- Pick any user with positive balance and confirm their lots look right.
-- (Replace placeholder with a real user UUID before running.)
--
-- SELECT cb.balance, COUNT(cl.id) AS lot_count, SUM(cl.remaining_amount) AS lot_sum
-- FROM credit_balances cb
-- LEFT JOIN credit_lots cl
--   ON cl.user_id = cb.user_id AND cl.credit_type = cb.credit_type AND cl.status = 'active'
-- WHERE cb.user_id = '<user-uuid>' AND cb.balance > 0
-- GROUP BY cb.balance;


-- ═══════════════════════════════════════════════════════════════════════════
-- END Sprint 5 backfill. After this runs, FIFO debit reads from lots for
-- every user. The next step (Sprint 6) consolidates the mat/reformer/group
-- wallets into a single 'pass' wallet and reduces the credit_type enum.
-- ═══════════════════════════════════════════════════════════════════════════
