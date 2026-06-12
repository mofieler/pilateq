-- PilatesOS — Add credits_granted_at to credit_purchases
-- Tracks whether credits have already been granted for a purchase,
-- preventing double-granting when an admin marks a pending/overdue
-- purchase as paid.

ALTER TABLE "credit_purchases"
  ADD COLUMN IF NOT EXISTS "credits_granted_at" timestamp with time zone;
