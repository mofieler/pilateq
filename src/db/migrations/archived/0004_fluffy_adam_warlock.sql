CREATE TYPE "public"."studio_status" AS ENUM('onboarding', 'active', 'suspended', 'paused');--> statement-breakpoint
CREATE TABLE "studios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(63) NOT NULL,
	"name" varchar(120) NOT NULL,
	"status" "studio_status" DEFAULT 'onboarding' NOT NULL,
	"timezone" varchar(80) DEFAULT 'Europe/Berlin' NOT NULL,
	"default_locale" varchar(5) DEFAULT 'en' NOT NULL,
	"plan_tier" varchar(40) DEFAULT 'starter' NOT NULL,
	"custom_domain" varchar(255),
	"is_custom_domain_verified" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "studios_slug_unique" UNIQUE("slug"),
	CONSTRAINT "studios_custom_domain_unique" UNIQUE("custom_domain")
);
--> statement-breakpoint
CREATE TABLE "studio_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"encrypted_credentials" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "studio_settings_studio_id_unique" UNIQUE("studio_id")
);
--> statement-breakpoint

-- Backfill: create the default studio from environment-driven settings and
-- assign all existing users to it. This keeps the current single-tenant
-- deployment working after the multi-tenant schema is introduced.
INSERT INTO "public"."studios" ("id", "slug", "name", "status", "timezone", "default_locale", "plan_tier")
VALUES (
  gen_random_uuid(),
  'default',
  COALESCE(NULLIF(current_setting('app.studio_name', true), ''), 'Default Studio'),
  'active',
  COALESCE(NULLIF(current_setting('app.studio_timezone', true), ''), 'Europe/Berlin'),
  'en',
  'starter'
)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "studio_id" uuid;--> statement-breakpoint
UPDATE "users" SET "studio_id" = (SELECT "id" FROM "public"."studios" WHERE "slug" = 'default') WHERE "studio_id" IS NULL;--> statement-breakpoint

ALTER TABLE "studio_settings" ADD CONSTRAINT "studio_settings_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "studio_settings_studio_id_idx" ON "studio_settings" USING btree ("studio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "studios_slug_idx" ON "studios" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "studios_status_idx" ON "studios" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "studios_custom_domain_idx" ON "studios" USING btree ("custom_domain");--> statement-breakpoint
CREATE INDEX "users_studio_id_idx" ON "users" USING btree ("studio_id");--> statement-breakpoint

-- The application enforces studio scoping; keep the column nullable during
-- the transition and enforce NOT NULL once all auth flows attach studio_id.
-- ALTER TABLE "users" ALTER COLUMN "studio_id" SET NOT NULL;
