CREATE TABLE "class_pass_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"provider_key" varchar(63) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"checked_in_at" timestamp with time zone,
	"notes" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_pass_checkins" ADD CONSTRAINT "class_pass_checkins_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_pass_checkins" ADD CONSTRAINT "class_pass_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_pass_checkins" ADD CONSTRAINT "class_pass_checkins_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_pass_checkins_studio_id_idx" ON "class_pass_checkins" USING btree ("studio_id");--> statement-breakpoint
CREATE INDEX "class_pass_checkins_user_id_idx" ON "class_pass_checkins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "class_pass_checkins_session_id_idx" ON "class_pass_checkins" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "class_pass_checkins_provider_idx" ON "class_pass_checkins" USING btree ("provider_key");--> statement-breakpoint
CREATE INDEX "class_pass_checkins_status_idx" ON "class_pass_checkins" USING btree ("status");