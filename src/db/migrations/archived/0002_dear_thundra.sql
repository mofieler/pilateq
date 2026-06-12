CREATE TYPE "public"."audit_action" AS ENUM('INSERT', 'UPDATE', 'DELETE');--> statement-breakpoint
CREATE TABLE "user_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"total_classes_attended" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"streak_last_updated_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_stats_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_stats_version_nonneg" CHECK ("user_stats"."version" >= 0),
	CONSTRAINT "user_stats_total_classes_nonneg" CHECK ("user_stats"."total_classes_attended" >= 0),
	CONSTRAINT "user_stats_current_streak_nonneg" CHECK ("user_stats"."current_streak" >= 0),
	CONSTRAINT "user_stats_longest_streak_nonneg" CHECK ("user_stats"."longest_streak" >= 0)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" varchar(64) NOT NULL,
	"record_id" varchar(64) NOT NULL,
	"action" varchar(10) NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"changed_columns" jsonb,
	"changed_by" uuid,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_stats_user_id_idx" ON "user_stats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_stats_streak_idx" ON "user_stats" USING btree ("current_streak");--> statement-breakpoint
CREATE INDEX "audit_logs_table_record_idx" ON "audit_logs" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_changed_by_idx" ON "audit_logs" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "audit_logs_table_created_at_idx" ON "audit_logs" USING btree ("table_name","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_version_nonneg" CHECK ("class_sessions"."version" >= 0);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_version_nonneg" CHECK ("bookings"."version" >= 0);--> statement-breakpoint
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_version_nonneg" CHECK ("credit_balances"."version" >= 0);