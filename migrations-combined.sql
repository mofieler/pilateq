
-- Migration: src\db\migrations\0000_silky_the_hunter.sql
CREATE TYPE "public"."badge_trigger_type" AS ENUM('classes_attended', 'streak', 'purchases', 'special');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled', 'attended', 'no_show', 'waitlisted');--> statement-breakpoint
CREATE TYPE "public"."cancellation_type" AS ENUM('user_cancelled', 'instructor_cancelled', 'admin_cancelled');--> statement-breakpoint
CREATE TYPE "public"."class_type" AS ENUM('private', 'duo', 'group', 'reformer', 'mat', 'online');--> statement-breakpoint
CREATE TYPE "public"."credit_transaction_type" AS ENUM('purchase', 'debit', 'refund', 'manual_adjustment', 'expiry');--> statement-breakpoint
CREATE TYPE "public"."credit_type" AS ENUM('standard', 'premium', 'vip');--> statement-breakpoint
CREATE TYPE "public"."guest_pass_status" AS ENUM('active', 'redeemed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."intensity_level" AS ENUM('low', 'medium', 'high', 'varied');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."stripe_transaction_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'instructor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."vod_difficulty" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."vod_status" AS ENUM('processing', 'published', 'unlisted', 'archived');--> statement-breakpoint
CREATE TYPE "public"."waitlist_status" AS ENUM('waiting', 'offered', 'confirmed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"phone" varchar(50),
	"avatar_url" varchar(500),
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"email_verified" timestamp with time zone,
	"image" varchar(500),
	"has_signed_waiver" boolean DEFAULT false NOT NULL,
	"first_mercy_used" boolean DEFAULT false NOT NULL,
	"total_classes_attended" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"streak_last_updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "instructors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bio" text,
	"spotify_playlist_url" varchar(500),
	"intensity_level" "intensity_level" DEFAULT 'medium',
	"specialties" jsonb DEFAULT '[]'::jsonb,
	"vibe_tags" jsonb DEFAULT '[]'::jsonb,
	"avatar_url" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instructors_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructors" ADD CONSTRAINT "instructors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "instructors_user_id_idx" ON "instructors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "instructors_is_active_idx" ON "instructors" USING btree ("is_active");

-- Migration: src\db\migrations\0001_fearless_warhawk.sql
CREATE TABLE "class_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid,
	"instructor_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"max_capacity" integer NOT NULL,
	"booked_count" integer DEFAULT 0 NOT NULL,
	"waitlist_count" integer DEFAULT 0 NOT NULL,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"cancellation_reason" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"class_type" "class_type" NOT NULL,
	"duration_minutes" integer NOT NULL,
	"max_capacity" integer NOT NULL,
	"credit_cost" integer NOT NULL,
	"credit_type" "credit_type" DEFAULT 'standard' NOT NULL,
	"instructor_id" uuid,
	"vibe_tags" jsonb DEFAULT '[]'::jsonb,
	"location" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"cancellation_type" "cancellation_type",
	"mercy_applied" boolean DEFAULT false NOT NULL,
	"credits_spent" integer NOT NULL,
	"credit_type" "credit_type" NOT NULL,
	"booked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"status" "waitlist_status" DEFAULT 'waiting' NOT NULL,
	"offered_at" timestamp with time zone,
	"offer_expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"credit_type" "credit_type" NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"credits_amount" integer NOT NULL,
	"credit_type" "credit_type" NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'eur' NOT NULL,
	"validity_days" integer DEFAULT 365 NOT NULL,
	"stripe_price_id" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"booking_id" uuid,
	"package_id" uuid,
	"type" "credit_transaction_type" NOT NULL,
	"credit_type" "credit_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"description" text,
	"processed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_template_id_class_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."class_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_templates" ADD CONSTRAINT "class_templates_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_package_id_credit_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."credit_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_sessions_starts_at_idx" ON "class_sessions" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "class_sessions_status_idx" ON "class_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "class_sessions_instructor_idx" ON "class_sessions" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX "class_sessions_schedule_idx" ON "class_sessions" USING btree ("starts_at","status");--> statement-breakpoint
CREATE INDEX "class_templates_type_idx" ON "class_templates" USING btree ("class_type");--> statement-breakpoint
CREATE INDEX "class_templates_is_active_idx" ON "class_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "class_templates_instructor_idx" ON "class_templates" USING btree ("instructor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_user_session_unique_idx" ON "bookings" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE INDEX "bookings_user_id_idx" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookings_session_id_idx" ON "bookings" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_user_status_idx" ON "bookings" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_user_session_unique_idx" ON "waitlist_entries" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE INDEX "waitlist_session_position_idx" ON "waitlist_entries" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "waitlist_status_idx" ON "waitlist_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "waitlist_promotion_idx" ON "waitlist_entries" USING btree ("session_id","status","position");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_balances_user_type_unique_idx" ON "credit_balances" USING btree ("user_id","credit_type");--> statement-breakpoint
CREATE INDEX "credit_balances_user_id_idx" ON "credit_balances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_balances_expires_at_idx" ON "credit_balances" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "credit_packages_is_active_idx" ON "credit_packages" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "credit_packages_credit_type_idx" ON "credit_packages" USING btree ("credit_type");--> statement-breakpoint
CREATE INDEX "credit_transactions_user_id_idx" ON "credit_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_transactions_booking_id_idx" ON "credit_transactions" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "credit_transactions_type_idx" ON "credit_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "credit_transactions_user_created_at_idx" ON "credit_transactions" USING btree ("user_id","created_at");

-- Migration: src\db\migrations\0002_charming_hulk.sql
CREATE TYPE "public"."session_type" AS ENUM('group', 'private');--> statement-breakpoint
CREATE TABLE "credit_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"credits_amount" integer NOT NULL,
	"credit_type" "credit_type" NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'eur' NOT NULL,
	"payment_method" varchar(20) DEFAULT 'pay_at_studio' NOT NULL,
	"payment_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"stripe_session_id" varchar(255),
	"stripe_payment_intent_id" varchar(255),
	"payment_due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"paid_by_user_id" uuid,
	"admin_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_templates" ALTER COLUMN "class_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."class_type";--> statement-breakpoint
CREATE TYPE "public"."class_type" AS ENUM('mat', 'reformer', 'private');--> statement-breakpoint
ALTER TABLE "class_templates" ALTER COLUMN "class_type" SET DATA TYPE "public"."class_type" USING "class_type"::"public"."class_type";--> statement-breakpoint
ALTER TABLE "class_templates" ALTER COLUMN "credit_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "credit_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "credit_balances" ALTER COLUMN "credit_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "credit_packages" ALTER COLUMN "credit_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "credit_purchases" ALTER COLUMN "credit_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "credit_transactions" ALTER COLUMN "credit_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."credit_type";--> statement-breakpoint
CREATE TYPE "public"."credit_type" AS ENUM('mat_group', 'reformer_group', 'private_session');--> statement-breakpoint
ALTER TABLE "class_templates" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";--> statement-breakpoint
ALTER TABLE "credit_balances" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";--> statement-breakpoint
ALTER TABLE "credit_packages" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";--> statement-breakpoint
ALTER TABLE "credit_purchases" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";--> statement-breakpoint
ALTER TABLE "credit_transactions" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";--> statement-breakpoint
ALTER TABLE "class_templates" ALTER COLUMN "credit_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_package_id_credit_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."credit_packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_paid_by_user_id_users_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_purchases_user_id_idx" ON "credit_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_purchases_package_id_idx" ON "credit_purchases" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "credit_purchases_status_idx" ON "credit_purchases" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "credit_purchases_method_idx" ON "credit_purchases" USING btree ("payment_method");--> statement-breakpoint
CREATE INDEX "credit_purchases_due_date_idx" ON "credit_purchases" USING btree ("payment_due_date");--> statement-breakpoint
CREATE INDEX "credit_purchases_stripe_session_idx" ON "credit_purchases" USING btree ("stripe_session_id");

-- Migration: src\db\migrations\0003_fix_credit_enum.sql
-- Force update credit_type enum to ensure new values are applied
ALTER TABLE "credit_packages" ALTER COLUMN "credit_type" SET DATA TYPE text;
ALTER TABLE "credit_balances" ALTER COLUMN "credit_type" SET DATA TYPE text;
ALTER TABLE "bookings" ALTER COLUMN "credit_type" SET DATA TYPE text;
ALTER TABLE "class_templates" ALTER COLUMN "credit_type" SET DATA TYPE text;
ALTER TABLE "credit_purchases" ALTER COLUMN "credit_type" SET DATA TYPE text;
ALTER TABLE "credit_transactions" ALTER COLUMN "credit_type" SET DATA TYPE text;
DROP TYPE IF EXISTS "public"."credit_type";
CREATE TYPE "public"."credit_type" AS ENUM('mat_group', 'reformer_group', 'private_session');
ALTER TABLE "credit_packages" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
ALTER TABLE "credit_balances" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
ALTER TABLE "bookings" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
ALTER TABLE "class_templates" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
ALTER TABLE "credit_purchases" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
ALTER TABLE "credit_transactions" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";


-- Migration: src\db\migrations\0004_force_enum_update.sql
-- Force update the credit_type enum by dropping and recreating it
-- This ensures the new enum values are properly applied
DROP TYPE IF EXISTS "public"."credit_type" CASCADE;
CREATE TYPE "public"."credit_type" AS ENUM('mat_group', 'reformer_group', 'private_session');

-- Update all tables to use the new enum
ALTER TABLE "credit_packages" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
ALTER TABLE "credit_balances" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
ALTER TABLE "bookings" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
ALTER TABLE "class_templates" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
ALTER TABLE "credit_purchases" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";
ALTER TABLE "credit_transactions" ALTER COLUMN "credit_type" TYPE "public"."credit_type" USING 'mat_group'::"public"."credit_type";


