-- =============================================================================
-- Migration: Superadmin role + studio-claim invites + seed the first superadmin
-- =============================================================================
-- This single file is idempotent and contains everything needed for the
-- Superadmin & Studio Invite System:
--   1. Adds 'superadmin' to the user_role enum.
--   2. Creates the studio_claim_invites table with indexes and foreign keys.
--   3. Creates the hidden platform studio (slug = 'platform').
--   4. Creates/updates the initial superadmin user.
--
-- After running this migration, log in at:
--   https://pilateq.de/login
-- with:
--   Email: moritzfieler@icloud.com
--   Password: superuser@Mo
--
-- Change the password immediately via:
--   /superadmin -> "Change superadmin password"
-- =============================================================================

-- 1. Enum -----------------------------------------------------------------------------------
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'superadmin';

-- 2. studio_claim_invites table -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "studio_claim_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "email" varchar(255),
  "studio_slug" varchar(63),
  "notes" text,
  "invited_by_user_id" uuid NOT NULL,
  "used_by_user_id" uuid,
  "used_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "studio_claim_invites_token_hash_idx"
  ON "studio_claim_invites" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "studio_claim_invites_email_idx"
  ON "studio_claim_invites" USING btree ("email");
CREATE INDEX IF NOT EXISTS "studio_claim_invites_invited_by_idx"
  ON "studio_claim_invites" USING btree ("invited_by_user_id");
CREATE INDEX IF NOT EXISTS "studio_claim_invites_expires_at_idx"
  ON "studio_claim_invites" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "studio_claim_invites_used_at_idx"
  ON "studio_claim_invites" USING btree ("used_at");

-- Foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'studio_claim_invites_invited_by_user_id_users_id_fk'
      AND table_name = 'studio_claim_invites'
  ) THEN
    ALTER TABLE "studio_claim_invites"
      ADD CONSTRAINT "studio_claim_invites_invited_by_user_id_users_id_fk"
      FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'studio_claim_invites_used_by_user_id_users_id_fk'
      AND table_name = 'studio_claim_invites'
  ) THEN
    ALTER TABLE "studio_claim_invites"
      ADD CONSTRAINT "studio_claim_invites_used_by_user_id_users_id_fk"
      FOREIGN KEY ("used_by_user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

-- 3. Platform studio ------------------------------------------------------------------------
INSERT INTO "studios" (
  "slug",
  "name",
  "status",
  "timezone",
  "default_locale"
)
VALUES (
  'platform',
  'Platform',
  'suspended',
  'Europe/Berlin',
  'en'
)
ON CONFLICT ("slug") DO NOTHING;

-- 4. Superadmin user ------------------------------------------------------------------------
-- Hashed with bcrypt(cost=12) for plaintext password: superuser@Mo
INSERT INTO "users" (
  "email",
  "name",
  "password_hash",
  "role",
  "studio_id",
  "email_verified",
  "profile_completed",
  "created_at",
  "updated_at"
)
VALUES (
  'moritzfieler@icloud.com',
  'Moritz Fieler',
  '$2b$12$z2k.Da3k9gCe3d7Q5UVHde1jLHTxRLVPeFUFQUq04rsJoIZ9IdHV.',
  'superadmin',
  (SELECT "id" FROM "studios" WHERE "slug" = 'platform' LIMIT 1),
  NOW(),
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "role" = 'superadmin',
  "password_hash" = EXCLUDED."password_hash",
  "name" = EXCLUDED."name",
  "studio_id" = EXCLUDED."studio_id",
  "email_verified" = NOW(),
  "profile_completed" = TRUE,
  "updated_at" = NOW();
