-- =============================================================================
-- PilatesOS — Migration 0001: Application audit_logs table (MVP-9)
-- =============================================================================
-- Replaces the trigger-style audit_logs table from the initial schema with an
-- application-level audit trail. Existing audit_log rows are dropped because
-- the old table was never populated by application code.
-- =============================================================================

DROP TABLE IF EXISTS "audit_logs" CASCADE;

CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	"action" varchar(128) NOT NULL,
	"resource" varchar(128) NOT NULL,
	"resource_id" uuid,
	"details" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"severity" varchar(16) NOT NULL,
	"category" varchar(32) NOT NULL,
	"success" boolean NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_severity_check" CHECK ("severity" IN ('low', 'medium', 'high', 'critical')),
	CONSTRAINT "audit_logs_category_check" CHECK ("category" IN ('auth', 'financial', 'admin', 'user_action', 'system'))
);

CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs" USING btree ("user_id", "created_at");
CREATE INDEX "audit_logs_category_created_at_idx" ON "audit_logs" USING btree ("category", "created_at");
CREATE INDEX "audit_logs_studio_id_idx" ON "audit_logs" USING btree ("studio_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");
