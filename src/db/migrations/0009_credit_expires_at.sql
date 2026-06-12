-- =============================================================================
-- PilatesOS — Migration 0009: Add expires_at to credit_transactions
-- =============================================================================
-- Adds an optional expiry timestamp to the single credit ledger.
-- NULL means the credits never expire, which is the safe backfill value for
-- all existing rows. Balance queries exclude rows whose expires_at is in the
-- past; the ledger rows themselves are never deleted or mutated.
-- =============================================================================

ALTER TABLE "credit_transactions" ADD COLUMN "expires_at" TIMESTAMP WITH TIME ZONE;

-- Index for efficient balance queries that filter out expired credits.
CREATE INDEX IF NOT EXISTS "credit_transactions_expires_at_idx"
  ON "credit_transactions" ("expires_at");
