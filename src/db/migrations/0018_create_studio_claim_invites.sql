-- Invitation tokens for claiming/creating a studio.
-- Only platform superadmins can create these; the public /start page requires one.
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

-- Unique constraint on the token hash so lookups are fast and safe.
CREATE UNIQUE INDEX IF NOT EXISTS "studio_claim_invites_token_hash_idx" ON "studio_claim_invites" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "studio_claim_invites_email_idx" ON "studio_claim_invites" USING btree ("email");
CREATE INDEX IF NOT EXISTS "studio_claim_invites_invited_by_idx" ON "studio_claim_invites" USING btree ("invited_by_user_id");
CREATE INDEX IF NOT EXISTS "studio_claim_invites_expires_at_idx" ON "studio_claim_invites" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "studio_claim_invites_used_at_idx" ON "studio_claim_invites" USING btree ("used_at");

-- Foreign keys (added separately to keep CREATE TABLE idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'studio_claim_invites_invited_by_user_id_users_id_fk'
    AND table_name = 'studio_claim_invites'
  ) THEN
    ALTER TABLE "studio_claim_invites"
      ADD CONSTRAINT "studio_claim_invites_invited_by_user_id_users_id_fk"
      FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'studio_claim_invites_used_by_user_id_users_id_fk'
    AND table_name = 'studio_claim_invites'
  ) THEN
    ALTER TABLE "studio_claim_invites"
      ADD CONSTRAINT "studio_claim_invites_used_by_user_id_users_id_fk"
      FOREIGN KEY ("used_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
