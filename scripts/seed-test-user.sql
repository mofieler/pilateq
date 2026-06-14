-- =============================================================================
-- Seed a test admin user for single-tenant / self-hosted deployments.
-- =============================================================================
-- Password (bcrypt): Test1234!
-- Email: admin@example.com
-- Role: admin
--
-- Run from inside the VPS, against the app database:
--   docker exec -i <postgres-container-name> psql -U postgres -d postgres -f - < scripts/seed-test-user.sql
--
-- Or open a DB terminal and paste the DO block.
-- =============================================================================

DO $$
DECLARE
  v_studio_id uuid;
  v_test_email text := 'admin@example.com';
  -- bcrypt hash for "Test1234!" (cost factor 12)
  v_test_password_hash text := '$2b$12$LL/egBxce5mIMOuZyK0Gy.ENJoJnKdYz2ysWJy1JWoMztdIRQJozK';
BEGIN
  -- 1) Ensure a default studio exists.
  SELECT id INTO v_studio_id
  FROM public.studios
  WHERE slug = 'default'
  LIMIT 1;

  IF v_studio_id IS NULL THEN
    INSERT INTO public.studios (slug, name, status, timezone, default_locale)
    VALUES ('default', 'PilatesOS Studio', 'active', 'Europe/Berlin', 'de')
    RETURNING id INTO v_studio_id;
  END IF;

  -- 2) Ensure the studio_settings row exists (empty JSONB is fine now that the
  --    loader merges defaults).
  INSERT INTO public.studio_settings (studio_id, config_json)
  VALUES (v_studio_id, '{}'::jsonb)
  ON CONFLICT (studio_id) DO NOTHING;

  -- 3) Upsert the test admin user. Email is pre-verified so login works
  --    immediately without email verification.
  INSERT INTO public.users (
    email,
    name,
    password_hash,
    role,
    studio_id,
    email_verified,
    profile_completed
  ) VALUES (
    v_test_email,
    'Test Admin',
    v_test_password_hash,
    'admin',
    v_studio_id,
    NOW(),
    true
  )
  ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    studio_id = EXCLUDED.studio_id,
    email_verified = EXCLUDED.email_verified,
    profile_completed = EXCLUDED.profile_completed,
    updated_at = NOW();
END $$;
