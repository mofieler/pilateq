-- =============================================================================
-- PilatesOS — Migration 0015: Row Level Security (RLS) tenant isolation
-- =============================================================================
-- Enables RLS on tenant-scoped tables and creates a helper function that the
-- application uses to push the current studio_id into the Postgres transaction
-- configuration. Each policy restricts rows to the studio set via
-- set_current_studio().
--
-- Excluded tables:
--   * users          — shared across studios; auth must resolve by email
--                      globally and tenant filtering happens in the app layer
--                      (studio_memberships).
--   * studios        — needed to resolve the tenant from a hostname BEFORE the
--                      tenant context can be set.
--   * studio_settings — tightly coupled to studios and read during studio
--                       resolution; left to app-layer checks.
--   * Auth.js tables (accounts, sessions, verification_tokens) — authentication
--     data, not tenant business records.
--
-- NOTE: RLS is enabled but FORCE ROW LEVEL SECURITY is NOT turned on. The
-- application database role must therefore NOT be the table owner if RLS is to
-- be enforced automatically. When the app is ready to rely on RLS everywhere,
-- run ALTER TABLE ... FORCE ROW LEVEL SECURITY on each table below.
-- =============================================================================

-- Set the transaction-scoped studio_id used by RLS policies.
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

-- Enable RLS on tenant-scoped tables.
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

-- Helper to avoid repeating the same USING/WITH CHECK expression.
-- Returns the uuid currently stored in app.current_studio_id, or NULL when the
-- setting has not been set (empty string) so that policies fail closed instead
-- of raising a uuid cast error.
CREATE OR REPLACE FUNCTION current_studio_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nullif(current_setting('app.current_studio_id', true), '')::uuid;
$$;

-- Tenant-isolation policies. One FOR ALL policy per table keeps the policy
-- surface small and guarantees that SELECT/INSERT/UPDATE/DELETE all see the
-- same scope.

CREATE POLICY tenant_isolation ON "class_templates"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

CREATE POLICY tenant_isolation ON "class_sessions"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

CREATE POLICY tenant_isolation ON "bookings"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

CREATE POLICY tenant_isolation ON "instructors"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

CREATE POLICY tenant_isolation ON "credit_packages"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

CREATE POLICY tenant_isolation ON "credit_purchases"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

CREATE POLICY tenant_isolation ON "credit_transactions"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

CREATE POLICY tenant_isolation ON "user_memberships"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

CREATE POLICY tenant_isolation ON "membership_plans"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

CREATE POLICY tenant_isolation ON "waitlist_entries"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

CREATE POLICY tenant_isolation ON "duo_invites"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

CREATE POLICY tenant_isolation ON "welcome_journey_requests"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

CREATE POLICY tenant_isolation ON "studio_memberships"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

CREATE POLICY tenant_isolation ON "studio_invites"
  FOR ALL TO public
  USING (studio_id = current_studio_id())
  WITH CHECK (studio_id = current_studio_id());

-- audit_logs.studio_id is nullable (system-level events may not have a studio).
-- The policy still scopes tenant-visible rows to the current studio; system
-- events with NULL studio_id are only visible when no tenant context is set.
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
