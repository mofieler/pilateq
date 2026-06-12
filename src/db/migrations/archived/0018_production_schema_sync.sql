-- Migration: Production schema sync
-- Adds columns and indexes that exist on the production VPS but were never
-- captured in a migration file. All statements use IF NOT EXISTS / DROP IF EXISTS
-- so this is safe to run on both fresh and existing databases.

-- ─── 1. users.welcome_completed_at ────────────────────────────────────────────

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "welcome_completed_at" timestamp with time zone;

-- ─── 2. class_templates.is_welcome_journey ────────────────────────────────────

ALTER TABLE "class_templates"
  ADD COLUMN IF NOT EXISTS "is_welcome_journey" boolean DEFAULT FALSE NOT NULL;

-- ─── 3. credit_purchases stripe_session unique index ──────────────────────────

-- The non-unique index may already exist; we drop it and replace with unique.
DROP INDEX IF EXISTS "credit_purchases_stripe_session_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "credit_purchases_stripe_session_unique_idx"
  ON "credit_purchases" USING btree ("stripe_session_id")
  WHERE "stripe_session_id" IS NOT NULL;

-- ─── 4. user_memberships cron sweep index ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS "user_memberships_grant_sweep_idx"
  ON "user_memberships" USING btree ("status", "next_credit_grant_at");

-- ─── 5. Performance indexes (speed audit) ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS "credit_purchases_user_method_status_idx"
  ON "credit_purchases" USING btree ("user_id", "payment_method", "payment_status");

CREATE INDEX IF NOT EXISTS "credit_purchases_created_at_idx"
  ON "credit_purchases" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "bookings_session_status_idx"
  ON "bookings" USING btree ("session_id", "status");

CREATE INDEX IF NOT EXISTS "bookings_status_created_at_idx"
  ON "bookings" USING btree ("status", "created_at");

CREATE INDEX IF NOT EXISTS "bookings_booked_at_idx"
  ON "bookings" USING btree ("booked_at");

CREATE INDEX IF NOT EXISTS "class_sessions_instructor_time_idx"
  ON "class_sessions" USING btree ("instructor_id", "status", "starts_at", "ends_at");

CREATE INDEX IF NOT EXISTS "class_sessions_template_id_idx"
  ON "class_sessions" USING btree ("template_id");
