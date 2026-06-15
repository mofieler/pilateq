-- =============================================================================
-- PilatesOS — Migration 0016: Multi-tenant polish (indexes + triggers)
-- =============================================================================
-- Adds composite indexes used by the membership/invite hot paths and DB-level
-- triggers to keep hostname/email lookups case-insensitive.
-- =============================================================================

-- Composite index for owner-count / role-scoped membership queries.
CREATE INDEX IF NOT EXISTS "studio_memberships_studio_role_status_idx"
  ON "studio_memberships" USING btree ("studio_id", "role", "status");

-- Composite index for "all active memberships of a user" lookups.
CREATE INDEX IF NOT EXISTS "studio_memberships_user_status_idx"
  ON "studio_memberships" USING btree ("user_id", "status");

-- Partial unique index: at most one pending invite per studio + email (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS "studio_invites_pending_unique_idx"
  ON "studio_invites" USING btree ("studio_id", lower("email"))
  WHERE "used_at" IS NULL;

-- Index for pending-invite listings per studio.
CREATE INDEX IF NOT EXISTS "studio_invites_studio_used_at_idx"
  ON "studio_invites" USING btree ("studio_id", "used_at");

-- Function + trigger: keep studio slugs lower-case.
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

-- Function + trigger: keep custom domains lower-case.
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

-- Function + trigger: keep invite emails lower-case.
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

-- Back-fill lowercase values for existing rows so the triggers and partial
-- index don't collide with legacy mixed-case data.
UPDATE "studios" SET "slug" = lower("slug") WHERE "slug" <> lower("slug");
UPDATE "studios" SET "custom_domain" = lower("custom_domain") WHERE "custom_domain" IS NOT NULL AND "custom_domain" <> lower("custom_domain");
UPDATE "studio_invites" SET "email" = lower("email") WHERE "email" <> lower("email");
