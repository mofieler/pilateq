-- Calendar sync — Google Calendar bidirectional integration
-- New tables: calendar_connections, external_calendar_blocks
-- class_sessions extension: google_calendar_* columns
-- Note: only the calendar-related parts are kept here; the rest of the diff
-- (credit_purchases, credit_packages, credit_adjustments, profile_completed)
-- was already applied via manual migrations 0003_fix_credit_enum.sql through
-- 0012_add_invoice_and_adjustments.sql. Keeping those statements would cause
-- "already exists" failures.

CREATE TABLE "calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(32) DEFAULT 'google' NOT NULL,
	"google_account_email" varchar(255) NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"selected_calendar_id" text,
	"selected_calendar_name" varchar(255),
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_sync_error" text,
	"last_pull_sync_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_calendar_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"instructor_id" uuid,
	"google_event_id" text NOT NULL,
	"summary" varchar(500),
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_sessions" ADD COLUMN "google_calendar_event_id" text;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD COLUMN "google_calendar_id" text;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD COLUMN "google_calendar_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD COLUMN "google_calendar_sync_error" text;--> statement-breakpoint
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_blocks" ADD CONSTRAINT "external_calendar_blocks_connection_id_calendar_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."calendar_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_blocks" ADD CONSTRAINT "external_calendar_blocks_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_connections_user_unique" ON "calendar_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "calendar_connections_sync_enabled_idx" ON "calendar_connections" USING btree ("sync_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "external_blocks_event_unique" ON "external_calendar_blocks" USING btree ("connection_id","google_event_id");--> statement-breakpoint
CREATE INDEX "external_blocks_time_idx" ON "external_calendar_blocks" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "external_blocks_instructor_idx" ON "external_calendar_blocks" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX "class_sessions_sync_error_idx" ON "class_sessions" USING btree ("google_calendar_sync_error");
