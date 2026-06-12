-- ═══════════════════════════════════════════════════════════════════════════
-- SPRINT 3 — credit_lots Table (FIFO Lot Ledger)
-- ═══════════════════════════════════════════════════════════════════════════
-- Execute on VPS terminal in this order.
--
-- Prerequisites:
--   - Sprint 2 migration already applied (cancellation_mercy_uses table exists)
--   - Backup:
--       pg_dump $DATABASE_URL --format=custom --file=pre_sprint3.dump
--
-- Run:
--   psql $DATABASE_URL -f sprint-3-credit-lots-vps.sql
--
-- Rollback (if needed):
--   DROP TABLE IF EXISTS credit_lots;
--
-- This migration is ADDITIVE. After running, the app continues to operate
-- identically because credit_lots is empty and no code reads from it yet.
-- Sprint 5 backfills existing credit_balances rows into credit_lots, and
-- Sprint 4 switches the debit path to FIFO over lots.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── PHASE 0 — Audit: state of credits before lot migration ──────────────────

-- A. Active balances by credit type
SELECT credit_type, COUNT(*) AS rows, SUM(balance) AS total_credits
FROM credit_balances
WHERE balance > 0
GROUP BY credit_type
ORDER BY total_credits DESC NULLS LAST;

-- B. How many users hold multiple wallets (mat + reformer + group + session)?
SELECT
  COUNT(*) FILTER (WHERE wallet_count > 1) AS users_with_multiple_wallets,
  COUNT(*)                                  AS users_with_any_balance,
  MAX(wallet_count)                         AS max_wallets_per_user
FROM (
  SELECT user_id, COUNT(DISTINCT credit_type) AS wallet_count
  FROM credit_balances
  WHERE balance > 0
  GROUP BY user_id
) sub;

-- C. Balances with non-null expires_at (will become lots with that expiry)
SELECT
  credit_type,
  COUNT(*)                                          AS rows,
  COUNT(*) FILTER (WHERE expires_at IS NULL)        AS no_expiry,
  COUNT(*) FILTER (WHERE expires_at IS NOT NULL)    AS with_expiry,
  MIN(expires_at)                                   AS earliest_expiry,
  MAX(expires_at)                                   AS latest_expiry
FROM credit_balances
WHERE balance > 0
GROUP BY credit_type;

-- D. Active credit packages (their validity_weeks drive future lot expiry)
SELECT id, name, credit_type, category, credits_amount, price_cents,
       validity_weeks, validity_days, is_active
FROM credit_packages
WHERE is_active = TRUE
ORDER BY credit_type, category, sort_order;


-- ─── PHASE 1 — Schema change (additive, non-breaking) ────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS credit_lots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  credit_type       credit_type NOT NULL,
  original_amount   INTEGER NOT NULL,
  remaining_amount  INTEGER NOT NULL,
  purchase_id       UUID REFERENCES credit_purchases(id) ON DELETE SET NULL,
  acquired_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT credit_lots_remaining_nonneg CHECK (remaining_amount >= 0),
  CONSTRAINT credit_lots_remaining_lte_original CHECK (remaining_amount <= original_amount),
  CONSTRAINT credit_lots_status_valid CHECK (status IN ('active','exhausted','expired'))
);

-- FIFO query: WHERE user_id AND credit_type AND status='active' AND expires_at > NOW()
--             ORDER BY expires_at ASC FOR UPDATE
CREATE INDEX IF NOT EXISTS credit_lots_fifo_idx
  ON credit_lots (user_id, credit_type, status, expires_at);

-- Cron expiry sweep: WHERE status='active' AND expires_at <= NOW()
CREATE INDEX IF NOT EXISTS credit_lots_expiry_sweep_idx
  ON credit_lots (status, expires_at);

CREATE INDEX IF NOT EXISTS credit_lots_user_idx
  ON credit_lots (user_id);

COMMENT ON TABLE credit_lots IS
  'Per-deposit credit ledger. FIFO-consumed by expires_at. Replaces the legacy single-row expires_at on credit_balances.';

COMMIT;


-- ─── PHASE 2 — Verification ──────────────────────────────────────────────────

-- V1. Table exists, is empty, and has the three expected indexes
SELECT
  (SELECT COUNT(*) FROM credit_lots)                              AS row_count,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename='credit_lots') AS index_count;
-- Expected: row_count = 0, index_count >= 4 (PK + 3 indexes)

-- V2. FK constraints intact
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name   AS references_table,
  rc.delete_rule
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.table_name = 'credit_lots'
ORDER BY tc.constraint_type, kcu.column_name;
-- Expected:
--   PRIMARY KEY on id
--   FK user_id → users.id, DELETE RESTRICT
--   FK purchase_id → credit_purchases.id, DELETE SET NULL
--   CHECK constraints on remaining_amount + status

-- V3. Confirm the FIFO index exists with the correct column order
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'credit_lots'
ORDER BY indexname;


-- ═══════════════════════════════════════════════════════════════════════════
-- END Sprint 3 schema migration. Backfill data with Sprint 5 script.
-- Sprint 4 (code) will start writing into credit_lots in parallel with
-- credit_balances via the dual-write path in credit.service.addCredits().
-- ═══════════════════════════════════════════════════════════════════════════
