-- Add waiver columns to users table (MVP-5 liability waiver)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "has_signed_waiver" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "waiver_signed_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "waiver_version" varchar(50);
