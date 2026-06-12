-- Migration: cancellation_mercy_uses
-- Replaces the lifetime users.first_mercy_used flag with a per-user, per-month
-- audit ledger. Allows MERCY_USES_PER_MONTH = 3 late-cancellations per
-- calendar month with full refund.
--
-- The legacy users.first_mercy_used column is kept (commented as deprecated) to
-- preserve historical data; nothing in the code reads from it after this
-- migration. A later migration can drop it once audit retention has passed.

CREATE TABLE IF NOT EXISTS cancellation_mercy_uses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  booking_id  UUID REFERENCES bookings(id) ON DELETE SET NULL,
  used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index supports the per-calendar-month count query:
--   WHERE user_id = $1 AND date_trunc('month', used_at) = date_trunc('month', NOW())
CREATE INDEX IF NOT EXISTS mercy_uses_user_month_idx
  ON cancellation_mercy_uses (user_id, used_at);

COMMENT ON TABLE cancellation_mercy_uses IS
  'Per-user audit ledger of late-cancellation mercy uses. Limit 3 per calendar month (MERCY_USES_PER_MONTH).';

COMMENT ON COLUMN users.first_mercy_used IS
  'DEPRECATED 2026-05-18 — replaced by cancellation_mercy_uses table (monthly 3x mercy). Read by no code after this date; kept for audit until further notice.';
