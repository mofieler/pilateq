-- PilatesOS — Enforce unique invoice numbers on credit_purchases
--
-- Prevents duplicate invoice numbers from concurrent purchases or
-- copy-pasted invoice generation logic. NULL values are still allowed
-- and do not violate the unique index.
--
-- NOTE: If this migration fails, existing duplicate non-NULL invoice numbers
-- must be deduplicated before the constraint can be applied.

CREATE UNIQUE INDEX IF NOT EXISTS "credit_purchases_invoice_number_unique_idx"
  ON "credit_purchases" ("invoice_number");
