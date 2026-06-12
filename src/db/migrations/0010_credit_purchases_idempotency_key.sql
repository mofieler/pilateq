-- =============================================================================
-- PilatesOS — Migration 0010: Add idempotency key to credit_purchases
-- =============================================================================
-- Prevents duplicate pay-at-studio invoices when a client submits the same
-- purchase more than once (network retry, double-click, etc.). The client
-- generates a UUID before the first request and sends it in the body; the
-- server returns the existing pending purchase if the key is already present.
-- NULL values are allowed and do not conflict with the unique index.
-- =============================================================================

ALTER TABLE "credit_purchases" ADD COLUMN "idempotency_key" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "credit_purchases_idempotency_key_idx"
  ON "credit_purchases" ("idempotency_key");
