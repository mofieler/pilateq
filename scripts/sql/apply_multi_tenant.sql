-- =============================================================================
-- PilatesOS — Multi-tenant bootstrap (idempotent VPS version)
-- =============================================================================
-- Combines migrations 0014 + 0015 + 0016 plus a membership backfill.
-- Run inside the Postgres container, e.g.:
--   psql "$DATABASE_URL" -f /tmp/apply_multi_tenant.sql
-- Or copy-paste the whole block into a psql session.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0014: Multi-tenant memberships and tenant indexes
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  CREATE TYPE "studio_membership_role" AS ENUM ('owner', 'admin', 'instructor', 'student');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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

ALTER TABLE "instructors" DROP CONSTRAINT IF EXISTS "instructors_user_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "instructors_user_id_idx" ON "instructors" USING btree ("studio_id", "user_id");

CREATE INDEX IF NOT EXISTS "bookings_studio_status_idx" ON "bookings" USING btree ("studio_id", "status");
CREATE INDEX IF NOT EXISTS "credit_purchases_studio_status_idx" ON "credit_purchases" USING btree ("studio_id", "payment_status");
CREATE INDEX IF NOT EXISTS "credit_transactions_studio_user_idx" ON "credit_transactions" USING btree ("studio_id", "user_id");
CREATE INDEX IF NOT EXISTS "credit_transactions_studio_type_idx" ON "credit_transactions" USING btree ("studio_id", "type");
CREATE INDEX IF NOT EXISTS "user_memberships_studio_status_idx" ON "user_memberships" USING btree ("studio_id", "status");
CREATE INDEX IF NOT EXISTS "class_sessions_studio_starts_at_idx" ON "class_sessions" USING btree ("studio_id", "starts_at");

-- Seed studio memberships from the legacy users.studio_id column.
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

-- -----------------------------------------------------------------------------
-- 0015: Row Level Security (RLS) tenant isolation
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_current_studio(studio_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.current_studio_id', studio_uuid::text, true);
END;
$$;

ALTER TABLE "class_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "instructors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_packages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waitlist_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "duo_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "welcome_journey_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION current_studio_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nullif(current_setting('app.current_studio_id', true), '')::uuid;
$$;

-- Drop and recreate policies so this script can be re-run safely.
DROP POLICY IF EXISTS tenant_isolation ON "class_templates";
CREATE POLICY tenant_isolation ON "class_templates"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

DROP POLICY IF EXISTS tenant_isolation ON "class_sessions";
CREATE POLICY tenant_isolation ON "class_sessions"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

DROP POLICY IF EXISTS tenant_isolation ON "bookings";
CREATE POLICY tenant_isolation ON "bookings"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

DROP POLICY IF EXISTS tenant_isolation ON "instructors";
CREATE POLICY tenant_isolation ON "instructors"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

DROP POLICY IF EXISTS tenant_isolation ON "credit_packages";
CREATE POLICY tenant_isolation ON "credit_packages"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

DROP POLICY IF EXISTS tenant_isolation ON "credit_purchases";
CREATE POLICY tenant_isolation ON "credit_purchases"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

DROP POLICY IF EXISTS tenant_isolation ON "credit_transactions";
CREATE POLICY tenant_isolation ON "credit_transactions"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

DROP POLICY IF EXISTS tenant_isolation ON "user_memberships";
CREATE POLICY tenant_isolation ON "user_memberships"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

DROP POLICY IF EXISTS tenant_isolation ON "membership_plans";
CREATE POLICY tenant_isolation ON "membership_plans"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

DROP POLICY IF EXISTS tenant_isolation ON "waitlist_entries";
CREATE POLICY tenant_isolation ON "waitlist_entries"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

DROP POLICY IF EXISTS tenant_isolation ON "duo_invites";
CREATE POLICY tenant_isolation ON "duo_invites"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

DROP POLICY IF EXISTS tenant_isolation ON "welcome_journey_requests";
CREATE POLICY tenant_isolation ON "welcome_journey_requests"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

DROP POLICY IF EXISTS tenant_isolation ON "studio_memberships";
CREATE POLICY tenant_isolation ON "studio_memberships"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

DROP POLICY IF EXISTS tenant_isolation ON "studio_invites";
CREATE POLICY tenant_isolation ON "studio_invites"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

DROP POLICY IF EXISTS tenant_isolation ON "audit_logs";
CREATE POLICY tenant_isolation ON "audit_logs"
  FOR ALL TO public
  USING (
    studio_id = current_studio_id()
    OR (current_studio_id() IS NULL AND studio_id IS NULL)
  )
  WITH CHECK (
    studio_id = current_studio_id()
    OR (current_studio_id() IS NULL AND studio_id IS NULL)
  );

-- -----------------------------------------------------------------------------
-- 0016: Multi-tenant polish (indexes + triggers)
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "studio_memberships_studio_role_status_idx"
  ON "studio_memberships" USING btree ("studio_id", "role", "status");

CREATE INDEX IF NOT EXISTS "studio_memberships_user_status_idx"
  ON "studio_memberships" USING btree ("user_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "studio_invites_pending_unique_idx"
  ON "studio_invites" USING btree ("studio_id", lower("email"))
  WHERE "used_at" IS NULL;

CREATE INDEX IF NOT EXISTS "studio_invites_studio_used_at_idx"
  ON "studio_invites" USING btree ("studio_id", "used_at");

CREATE OR REPLACE FUNCTION studios_lower_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.slug = lower(NEW.slug);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS studios_lower_slug_trigger ON "studios";
CREATE TRIGGER studios_lower_slug_trigger
  BEFORE INSERT OR UPDATE OF slug ON "studios"
  FOR EACH ROW
  EXECUTE FUNCTION studios_lower_slug();

CREATE OR REPLACE FUNCTION studios_lower_custom_domain()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.custom_domain IS NOT NULL THEN
    NEW.custom_domain = lower(NEW.custom_domain);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS studios_lower_custom_domain_trigger ON "studios";
CREATE TRIGGER studios_lower_custom_domain_trigger
  BEFORE INSERT OR UPDATE OF custom_domain ON "studios"
  FOR EACH ROW
  EXECUTE FUNCTION studios_lower_custom_domain();

CREATE OR REPLACE FUNCTION studio_invites_lower_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email = lower(NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS studio_invites_lower_email_trigger ON "studio_invites";
CREATE TRIGGER studio_invites_lower_email_trigger
  BEFORE INSERT OR UPDATE OF email ON "studio_invites"
  FOR EACH ROW
  EXECUTE FUNCTION studio_invites_lower_email();

UPDATE "studios" SET "slug" = lower("slug") WHERE "slug" <> lower("slug");
UPDATE "studios" SET "custom_domain" = lower("custom_domain") WHERE "custom_domain" IS NOT NULL AND "custom_domain" <> lower("custom_domain");
UPDATE "studio_invites" SET "email" = lower("email") WHERE "email" <> lower("email");

-- -----------------------------------------------------------------------------
-- Idempotent backfill: ensure every non-deleted user has an active membership
-- -----------------------------------------------------------------------------

INSERT INTO "studio_memberships" ("user_id", "studio_id", "role", "status")
SELECT
  u."id",
  u."studio_id",
  (CASE u."role"::text
    WHEN 'admin' THEN 'owner'
    WHEN 'instructor' THEN 'instructor'
    ELSE 'student'
  END)::studio_membership_role,
  'active'::membership_status
FROM "users" u
WHERE u."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "studio_memberships" m
    WHERE m."user_id" = u."id" AND m."studio_id" = u."studio_id"
  )
ON CONFLICT ("user_id", "studio_id") DO NOTHING;
