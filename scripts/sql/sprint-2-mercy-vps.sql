-- ═══════════════════════════════════════════════════════════════════════════
-- SPRINT 2 — Mercy System Migration (3 per calendar month)
-- ═══════════════════════════════════════════════════════════════════════════
-- Execute on VPS terminal in this order.
--
-- Prerequisites:
--   - Postgres 18 (mindestens v15)
--   - DATABASE_URL is set
--   - Take a backup first:
--       pg_dump $DATABASE_URL --format=custom --file=pre_sprint2.dump
--
-- Run:
--   psql $DATABASE_URL -f sprint-2-mercy-vps.sql
--
-- Rollback (if needed):
--   DROP TABLE IF EXISTS cancellation_mercy_uses;
--   COMMENT ON COLUMN users.first_mercy_used IS NULL;
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── PHASE 0 — Audit: what does the database currently hold? ─────────────────

-- A. How many users have already used the legacy lifetime mercy flag?
SELECT
  COUNT(*) FILTER (WHERE first_mercy_used = TRUE)  AS users_lifetime_mercy_used,
  COUNT(*)                                          AS users_total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE first_mercy_used = TRUE) / NULLIF(COUNT(*), 0), 1)
                                                    AS pct_used
FROM users
WHERE deleted_at IS NULL;

-- B. Last 20 bookings where mercy was applied (historical reference)
SELECT b.id, b.user_id, u.email, b.cancelled_at, b.mercy_applied, b.credits_spent
FROM bookings b
JOIN users u ON u.id = b.user_id
WHERE b.mercy_applied = TRUE
ORDER BY b.cancelled_at DESC
LIMIT 20;

-- C. Distribution: how many <24h cancellations per user in the last 90 days?
SELECT
  user_id,
  COUNT(*) AS late_cancels_last_90d,
  COUNT(*) FILTER (WHERE mercy_applied = TRUE)     AS with_mercy,
  COUNT(*) FILTER (WHERE mercy_applied = FALSE)    AS without_mercy
FROM bookings
WHERE status = 'cancelled'
  AND cancelled_at >= NOW() - INTERVAL '90 days'
  AND cancellation_type = 'user_cancelled'
GROUP BY user_id
HAVING COUNT(*) > 0
ORDER BY late_cancels_last_90d DESC
LIMIT 30;


-- ─── PHASE 1 — Schema change (additive, non-breaking) ────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS cancellation_mercy_uses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  booking_id  UUID REFERENCES bookings(id) ON DELETE SET NULL,
  used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index supports the per-calendar-month count query:
--   WHERE user_id AND date_trunc('month', used_at) = date_trunc('month', NOW())
CREATE INDEX IF NOT EXISTS mercy_uses_user_month_idx
  ON cancellation_mercy_uses (user_id, used_at);

COMMENT ON TABLE cancellation_mercy_uses IS
  'Per-user audit ledger of late-cancellation mercy uses. Limit 3 per calendar month (MERCY_USES_PER_MONTH constant in code).';

COMMENT ON COLUMN users.first_mercy_used IS
  'DEPRECATED 2026-05-18 — replaced by cancellation_mercy_uses table (monthly 3x mercy). Read by no code after the application deploy that ships Sprint 2. Kept here for audit retention.';

COMMIT;


-- ─── PHASE 2 — NO data migration needed ──────────────────────────────────────
--
-- The legacy `users.first_mercy_used` (lifetime one-shot) is NOT semantically
-- compatible with the new system (monthly 3x). A user with
-- first_mercy_used=TRUE starts the next calendar month with the full 3-quota.
-- This is the lenient migration — it respects the fresh reset principle of the
-- new system.
--
-- If you instead want a "grace penalty" (e.g. user who already used lifetime
-- mercy gets only 2 of 3 in the first month), run this optional script:
--
--   INSERT INTO cancellation_mercy_uses (user_id, booking_id, used_at)
--   SELECT id, NULL, date_trunc('month', NOW())
--   FROM users
--   WHERE first_mercy_used = TRUE AND deleted_at IS NULL;
--
-- Recommendation: DO NOT run. Fresh start is fairer.


-- ─── PHASE 3 — Verification ──────────────────────────────────────────────────

-- V1. Table exists and is empty
SELECT
  COUNT(*)                           AS row_count,
  (SELECT COUNT(*) FROM pg_indexes
   WHERE tablename = 'cancellation_mercy_uses')  AS index_count
FROM cancellation_mercy_uses;
-- Expected: row_count = 0, index_count >= 2 (PK + user_month_idx)

-- V2. FK constraints intact
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name   AS references_table,
  ccu.column_name  AS references_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.table_name = 'cancellation_mercy_uses'
ORDER BY tc.constraint_type, kcu.column_name;
-- Expected:
--   PRIMARY KEY on id
--   FK user_id → users.id, DELETE RESTRICT
--   FK booking_id → bookings.id, DELETE SET NULL

-- V3. Smoke test: insert + count + cleanup
-- Replace the placeholder with a real user UUID from your DB before running.
-- BEGIN;
--   INSERT INTO cancellation_mercy_uses (user_id) VALUES ('<test-user-uuid>') RETURNING *;
--   SELECT COUNT(*) FROM cancellation_mercy_uses
--     WHERE user_id = '<test-user-uuid>'
--     AND date_trunc('month', used_at) = date_trunc('month', NOW());
-- ROLLBACK;  -- NO commit for smoke test


-- ─── PHASE 4 — Post-deploy monitoring ────────────────────────────────────────
--
-- After app deploy: verify mercy uses are being recorded.
--
-- Current-month mercy uses per user:
--   SELECT user_id, COUNT(*) FROM cancellation_mercy_uses
--   WHERE date_trunc('month', used_at) = date_trunc('month', NOW())
--   GROUP BY user_id ORDER BY COUNT(*) DESC;
--
-- Users who have exhausted their 3 mercy uses this month:
--   SELECT user_id, COUNT(*) AS uses FROM cancellation_mercy_uses
--   WHERE date_trunc('month', used_at) = date_trunc('month', NOW())
--   GROUP BY user_id HAVING COUNT(*) >= 3;

-- ═══════════════════════════════════════════════════════════════════════════
-- END Sprint 2 migration. Next tranche: Sprint 3 (credit_lots).
-- ═══════════════════════════════════════════════════════════════════════════
