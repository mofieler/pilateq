-- ============================================================================
-- MIGRATION: Welcome Journey System (Production VPS)
-- ============================================================================
-- Run this AFTER 0018_production_schema_sync.sql has already been applied.
-- This script is idempotent — safe to run multiple times.

-- ─── 1. CREATE welcome_journey_requests table ───────────────────────────────

CREATE TABLE IF NOT EXISTS "welcome_journey_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "user_message" text,
  "offered_session_ids" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Trigger to auto-update updated_at (matches Drizzle $onUpdate behavior)
CREATE OR REPLACE FUNCTION update_welcome_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS welcome_request_updated_at_trigger ON "welcome_journey_requests";
CREATE TRIGGER welcome_request_updated_at_trigger
  BEFORE UPDATE ON "welcome_journey_requests"
  FOR EACH ROW
  EXECUTE FUNCTION update_welcome_request_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "welcome_requests_user_id_idx" ON "welcome_journey_requests"("user_id");
CREATE INDEX IF NOT EXISTS "welcome_requests_status_idx" ON "welcome_journey_requests"("status");

-- ─── 2. EXISTING USERS: Mark as welcomed? ───────────────────────────────────
-- ⚠️ DECISION POINT:
-- If your studio ALREADY has active students before this feature launched,
-- they should NOT be forced into the Welcome Journey flow.
-- Uncomment ONE of the following options:

-- OPTION A: Mark ALL existing users as welcomed (recommended for live studios)
-- UPDATE "users" SET "welcome_completed_at" = NOW() WHERE "welcome_completed_at" IS NULL;

-- OPTION B: Mark only users who have at least 1 past attended booking as welcomed
-- UPDATE "users" SET "welcome_completed_at" = NOW()
-- WHERE "welcome_completed_at" IS NULL
--   AND EXISTS (
--     SELECT 1 FROM "bookings"
--     WHERE "bookings"."user_id" = "users"."id"
--       AND "bookings"."status" = 'attended'
--   );

-- OPTION C: Leave as-is (all existing users must complete Welcome Journey)
-- No action needed. Only choose this if the studio has ZERO real students yet.

-- ─── 3. VERIFY Welcome Journey credit package exists ────────────────────────
-- The system expects ONE package named exactly 'Welcome Journey' with category='session'.
-- If missing, the /credits page will show empty for unwelcomed users.

-- Uncomment to insert if missing (adjust price/credits as needed):
-- INSERT INTO "credit_packages" (
--   "id", "name", "description", "credits_amount", "credit_type",
--   "category", "price_cents", "currency", "validity_days", "validity_weeks", "is_active", "sort_order"
-- ) VALUES (
--   gen_random_uuid(),
--   'Welcome Journey',
--   'Your first private introduction session',
--   1,
--   'private_session',
--   'session',
--   4500,
--   'eur',
--   365,
--   52,
--   true,
--   0
-- )
-- ON CONFLICT ("name") DO NOTHING;
