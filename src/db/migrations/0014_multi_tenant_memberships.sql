-- =============================================================================
-- PilatesOS — Migration 0014: Multi-tenant memberships and tenant indexes
-- =============================================================================
-- Introduces the studio_memberships and studio_invites tables required for
-- true multi-tenancy, relaxes the instructors.user_id unique constraint to be
-- scoped per studio, and adds missing studio_id-leading composite indexes on
-- tenant-heavy tables.
-- =============================================================================

-- New role enum for studio memberships (idempotent for re-runs).
DO $$
BEGIN
  CREATE TYPE "studio_membership_role" AS ENUM ('owner', 'admin', 'instructor', 'student');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Many-to-many bridge between users and studios.
CREATE TABLE IF NOT EXISTS "studio_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"role" "studio_membership_role" DEFAULT 'student' NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"invited_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	"joined_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "studio_memberships_user_studio_unique_idx" ON "studio_memberships" USING btree ("user_id", "studio_id");
CREATE INDEX IF NOT EXISTS "studio_memberships_studio_id_idx" ON "studio_memberships" USING btree ("studio_id");
CREATE INDEX IF NOT EXISTS "studio_memberships_user_id_idx" ON "studio_memberships" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "studio_memberships_role_idx" ON "studio_memberships" USING btree ("role");
CREATE INDEX IF NOT EXISTS "studio_memberships_status_idx" ON "studio_memberships" USING btree ("status");

-- Token-based invitations to join a studio.
CREATE TABLE IF NOT EXISTS "studio_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"email" varchar(255) NOT NULL,
	"role" "studio_membership_role" DEFAULT 'student' NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"invited_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "studio_invites_token_hash_unique_idx" ON "studio_invites" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "studio_invites_studio_id_idx" ON "studio_invites" USING btree ("studio_id");
CREATE INDEX IF NOT EXISTS "studio_invites_token_hash_idx" ON "studio_invites" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "studio_invites_email_idx" ON "studio_invites" USING btree ("email");
CREATE INDEX IF NOT EXISTS "studio_invites_expires_at_idx" ON "studio_invites" USING btree ("expires_at");

-- Instructors can now belong to the same user record across multiple studios.
ALTER TABLE "instructors" DROP CONSTRAINT IF EXISTS "instructors_user_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "instructors_user_id_idx" ON "instructors" USING btree ("studio_id", "user_id");

-- Missing studio_id-leading composite indexes for tenant-heavy tables.
CREATE INDEX IF NOT EXISTS "bookings_studio_status_idx" ON "bookings" USING btree ("studio_id", "status");
CREATE INDEX IF NOT EXISTS "credit_purchases_studio_status_idx" ON "credit_purchases" USING btree ("studio_id", "payment_status");
CREATE INDEX IF NOT EXISTS "credit_transactions_studio_user_idx" ON "credit_transactions" USING btree ("studio_id", "user_id");
CREATE INDEX IF NOT EXISTS "credit_transactions_studio_type_idx" ON "credit_transactions" USING btree ("studio_id", "type");
CREATE INDEX IF NOT EXISTS "user_memberships_studio_status_idx" ON "user_memberships" USING btree ("studio_id", "status");
CREATE INDEX IF NOT EXISTS "class_sessions_studio_starts_at_idx" ON "class_sessions" USING btree ("studio_id", "starts_at");

-- Seed studio memberships from the legacy users.studio_id column so existing
-- users keep access after the credentials authorize() switch to membership checks.
-- Admins become owners; instructors stay instructors; everyone else becomes a student.
INSERT INTO "studio_memberships" ("user_id", "studio_id", "role", "status")
SELECT
  "id",
  "studio_id",
  (CASE "role"::text
    WHEN 'admin' THEN 'owner'
    WHEN 'instructor' THEN 'instructor'
    ELSE 'student'
  END)::studio_membership_role,
  'active'::membership_status
FROM "users"
WHERE "deleted_at" IS NULL
ON CONFLICT ("user_id", "studio_id") DO NOTHING;
