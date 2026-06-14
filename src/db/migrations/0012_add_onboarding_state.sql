-- Add per-user onboarding tracking columns.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_step" varchar(50);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_skipped" boolean DEFAULT false NOT NULL;
