-- =============================================================================
-- PilatesOS — Initial Schema Migration
-- =============================================================================
-- Generated from src/db/schema/*.ts
-- For fresh PostgreSQL databases (v18+; minimum v15)
--
-- Order: ENUMs → Base tables → Dependent tables → FKs → Indexes → CHECKs → Seeds
-- =============================================================================

-- ─── ENUMs ───────────────────────────────────────────────────────────────────

CREATE TYPE "public"."user_role" AS ENUM('student', 'instructor', 'admin');
CREATE TYPE "public"."studio_status" AS ENUM('onboarding', 'active', 'suspended', 'paused');
CREATE TYPE "public"."class_type" AS ENUM('reformer_group', 'reformer_private', 'reformer_duo', 'mat_group', 'mat_private', 'mat_duo', 'chair', 'online', 'sound_healing', 'yoga');
CREATE TYPE "public"."session_type" AS ENUM('group', 'private');
CREATE TYPE "public"."intensity_level" AS ENUM('low', 'medium', 'high', 'varied');
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled', 'attended', 'no_show', 'waitlisted');
CREATE TYPE "public"."cancellation_type" AS ENUM('user_cancelled', 'instructor_cancelled', 'admin_cancelled');
CREATE TYPE "public"."credit_type" AS ENUM('pass', 'mat_pass', 'reformer_pass', 'session');
CREATE TYPE "public"."credit_transaction_type" AS ENUM('purchase', 'debit', 'refund', 'adjustment', 'membership_grant', 'expiry');
CREATE TYPE "public"."stripe_transaction_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');
CREATE TYPE "public"."waitlist_status" AS ENUM('waiting', 'offered', 'confirmed', 'expired', 'cancelled');
CREATE TYPE "public"."guest_pass_status" AS ENUM('active', 'redeemed', 'expired');
CREATE TYPE "public"."duo_invite_status" AS ENUM('pending', 'accepted', 'expired', 'cancelled');
CREATE TYPE "public"."invoice_reminder_type" AS ENUM('overdue_reminder', 'custom_send');
CREATE TYPE "public"."payment_method" AS ENUM('stripe', 'pay_at_studio', 'bank_transfer', 'cash', 'sound_healing_credits');
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'cancelled', 'overdue', 'refunded');
CREATE TYPE "public"."credit_pack_category" AS ENUM('credit', 'session');
CREATE TYPE "public"."vod_status" AS ENUM('processing', 'published', 'unlisted', 'archived');
CREATE TYPE "public"."vod_difficulty" AS ENUM('beginner', 'intermediate', 'advanced');
CREATE TYPE "public"."badge_trigger_type" AS ENUM('classes_attended', 'streak', 'purchases', 'special');
CREATE TYPE "public"."membership_status" AS ENUM('active', 'paused', 'cancelled', 'expired');
CREATE TYPE "public"."session_subtype" AS ENUM('private', 'duo');
CREATE TYPE "public"."audit_action" AS ENUM('INSERT', 'UPDATE', 'DELETE');

-- ─── Base tables (no FK dependencies) ────────────────────────────────────────

CREATE TABLE "studios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(63) NOT NULL UNIQUE,
	"name" varchar(120) NOT NULL,
	"status" "studio_status" DEFAULT 'onboarding' NOT NULL,
	"timezone" varchar(80) DEFAULT 'Europe/Berlin' NOT NULL,
	"default_locale" varchar(5) DEFAULT 'en' NOT NULL,
	"plan_tier" varchar(40) DEFAULT 'starter' NOT NULL,
	"custom_domain" varchar(255) UNIQUE,
	"is_custom_domain_verified" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "studio_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL UNIQUE REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"config_json" jsonb NOT NULL DEFAULT '{}',
	"encrypted_credentials" jsonb DEFAULT '{}',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"name" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"phone" varchar(50),
	"avatar_url" varchar(500),
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"studio_id" uuid REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"email_verified" timestamp with time zone,
	"image" varchar(500),
	"first_mercy_used" boolean DEFAULT false NOT NULL,
	"profile_completed" boolean DEFAULT false NOT NULL,
	"total_classes_attended" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"streak_last_updated_at" timestamp with time zone,
	"welcome_completed_at" timestamp with time zone,
	"has_signed_waiver" boolean DEFAULT false NOT NULL,
	"waiver_signed_at" timestamp with time zone,
	"waiver_version" varchar(50),
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
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

CREATE TABLE "sessions" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	"expires" timestamp with time zone NOT NULL
);

CREATE TABLE "verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);

CREATE TABLE "rate_limits" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"backoff_tier" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limits_attempts_nonneg" CHECK ("rate_limits"."attempts" >= 0),
	CONSTRAINT "rate_limits_backoff_tier_nonneg" CHECK ("rate_limits"."backoff_tier" >= 0)
);

-- ─── Instructor & Classes ────────────────────────────────────────────────────

CREATE TABLE "instructors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"user_id" uuid NOT NULL UNIQUE REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	"bio" text,
	"spotify_playlist_url" varchar(500),
	"intensity_level" "intensity_level" DEFAULT 'medium',
	"specialties" jsonb DEFAULT '[]'::jsonb,
	"vibe_tags" jsonb DEFAULT '[]'::jsonb,
	"avatar_url" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "class_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"name" varchar(255) NOT NULL,
	"description" text,
	"class_type" "class_type" NOT NULL,
	"duration_minutes" integer NOT NULL,
	"max_capacity" integer NOT NULL,
	"credit_cost" integer NOT NULL,
	"credit_type" "credit_type" NOT NULL,
	"instructor_id" uuid REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action,
	"vibe_tags" jsonb DEFAULT '[]'::jsonb,
	"location" varchar(255),
	"is_welcome_journey" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_templates_duration_positive" CHECK ("class_templates"."duration_minutes" > 0),
	CONSTRAINT "class_templates_capacity_positive" CHECK ("class_templates"."max_capacity" > 0),
	CONSTRAINT "class_templates_credit_cost_positive" CHECK ("class_templates"."credit_cost" > 0)
);

CREATE TABLE "class_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"template_id" uuid REFERENCES "public"."class_templates"("id") ON DELETE set null ON UPDATE no action,
	"instructor_id" uuid REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"max_capacity" integer NOT NULL,
	"booked_count" integer DEFAULT 0 NOT NULL,
	"waitlist_count" integer DEFAULT 0 NOT NULL,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"cancellation_reason" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	"rescheduled_at" timestamp with time zone,
	"google_calendar_event_id" text,
	"google_calendar_id" text,
	"google_calendar_synced_at" timestamp with time zone,
	"google_calendar_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "class_sessions_ends_after_starts" CHECK ("class_sessions"."ends_at" > "class_sessions"."starts_at"),
	CONSTRAINT "class_sessions_booked_count_nonneg" CHECK ("class_sessions"."booked_count" >= 0),
	CONSTRAINT "class_sessions_waitlist_count_nonneg" CHECK ("class_sessions"."waitlist_count" >= 0),
	CONSTRAINT "class_sessions_capacity_positive" CHECK ("class_sessions"."max_capacity" > 0),
	CONSTRAINT "class_sessions_version_nonneg" CHECK ("class_sessions"."version" >= 0)
);

-- ─── Bookings & Waitlist ─────────────────────────────────────────────────────

CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	"session_id" uuid REFERENCES "public"."class_sessions"("id") ON DELETE set null ON UPDATE no action,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"cancellation_type" "cancellation_type",
	"mercy_applied" boolean DEFAULT false NOT NULL,
	"credits_spent" integer NOT NULL,
	"credit_type" "credit_type" NOT NULL,
	"access_provider" varchar(40),
	"access_grant" jsonb,
	"booked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_credits_spent_positive" CHECK ("bookings"."credits_spent" > 0),
	CONSTRAINT "bookings_version_nonneg" CHECK ("bookings"."version" >= 0)
);

CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	"session_id" uuid NOT NULL REFERENCES "public"."class_sessions"("id") ON DELETE restrict ON UPDATE no action,
	"position" integer NOT NULL,
	"status" "waitlist_status" DEFAULT 'waiting' NOT NULL,
	"offered_at" timestamp with time zone,
	"offer_expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── Credits & Billing ───────────────────────────────────────────────────────

CREATE TABLE "credit_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"name" varchar(255) NOT NULL,
	"description" text,
	"credits_amount" integer NOT NULL,
	"credit_type" "credit_type" NOT NULL,
	"category" "credit_pack_category" DEFAULT 'credit' NOT NULL,
	"price_cents" integer NOT NULL,
	"discount_price_cents" integer,
	"currency" varchar(3) DEFAULT 'eur' NOT NULL,
	"validity_days" integer DEFAULT 365 NOT NULL,
	"stripe_price_id" varchar(255) UNIQUE,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_packages_price_nonneg" CHECK ("credit_packages"."price_cents" >= 0),
	CONSTRAINT "credit_packages_credits_positive" CHECK ("credit_packages"."credits_amount" > 0)
);

CREATE TABLE "credit_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	"package_id" uuid REFERENCES "public"."credit_packages"("id") ON DELETE restrict ON UPDATE no action,
	"credits_amount" integer NOT NULL,
	"credit_type" "credit_type" NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'eur' NOT NULL,
	"payment_method" "payment_method" DEFAULT 'pay_at_studio' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"stripe_session_id" varchar(255),
	"stripe_payment_intent_id" varchar(255) UNIQUE,
	"payment_due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"paid_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	"processing_fee_cents" integer DEFAULT 0,
	"admin_notes" text,
	"invoice_number" varchar(50),
	"invoice_issued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_purchases_price_nonneg" CHECK ("credit_purchases"."price_cents" >= 0),
	CONSTRAINT "credit_purchases_credits_positive" CHECK ("credit_purchases"."credits_amount" > 0)
);

CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	"type" "credit_transaction_type" NOT NULL,
	"credit_type" "credit_type" NOT NULL,
	"amount" integer NOT NULL,
	"description" text,
	"booking_id" uuid REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action,
	"purchase_id" uuid REFERENCES "public"."credit_purchases"("id") ON DELETE set null ON UPDATE no action,
	"membership_id" uuid REFERENCES "public"."user_memberships"("id") ON DELETE set null ON UPDATE no action,
	"processed_by" uuid REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "membership_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"name" varchar(255) NOT NULL,
	"description" text,
	"credit_type" "credit_type" NOT NULL,
	"session_subtype" "session_subtype",
	"weekly_credits" integer NOT NULL,
	"duration_weeks" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'eur' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_plans_weekly_credits_positive" CHECK ("membership_plans"."weekly_credits" > 0),
	CONSTRAINT "membership_plans_duration_weeks_positive" CHECK ("membership_plans"."duration_weeks" > 0),
	CONSTRAINT "membership_plans_price_nonneg" CHECK ("membership_plans"."price_cents" >= 0)
);

CREATE TABLE "user_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	"plan_id" uuid NOT NULL REFERENCES "public"."membership_plans"("id") ON DELETE restrict ON UPDATE no action,
	"credit_type" "credit_type" NOT NULL,
	"session_subtype" "session_subtype",
	"weekly_credits" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"last_credit_grant_at" timestamp with time zone,
	"next_credit_grant_at" timestamp with time zone NOT NULL,
	"self_purchased" boolean DEFAULT false NOT NULL,
	"accepted_terms_at" timestamp with time zone,
	"accepted_withdrawal_waiver_at" timestamp with time zone,
	"purchase_ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_memberships_weekly_credits_positive" CHECK ("user_memberships"."weekly_credits" > 0),
	CONSTRAINT "user_memberships_ends_after_starts" CHECK ("user_memberships"."ends_at" > "user_memberships"."started_at")
);

-- ─── Promos ──────────────────────────────────────────────────────────────────

CREATE TABLE "promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"code" varchar(50) NOT NULL UNIQUE,
	"type" varchar(20) NOT NULL,
	"value" integer NOT NULL,
	"max_uses" integer,
	"current_uses" integer DEFAULT 0 NOT NULL,
	"max_uses_per_user" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone,
	"package_id" uuid REFERENCES "public"."credit_packages"("id") ON DELETE set null ON UPDATE no action,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_value_nonneg" CHECK ("promo_codes"."value" >= 0),
	CONSTRAINT "promo_codes_current_uses_nonneg" CHECK ("promo_codes"."current_uses" >= 0),
	CONSTRAINT "promo_codes_max_uses_per_user_positive" CHECK ("promo_codes"."max_uses_per_user" > 0)
);

-- Deferred FK: credit_purchases references promo_codes, which is defined later in this migration.
ALTER TABLE "credit_purchases" ADD COLUMN "promo_code_id" uuid REFERENCES "public"."promo_codes"("id") ON DELETE set null ON UPDATE no action;

CREATE TABLE "promo_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"promo_id" uuid NOT NULL REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	"purchase_id" uuid NOT NULL REFERENCES "public"."credit_purchases"("id") ON DELETE cascade ON UPDATE no action,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── Calendar ─────────────────────────────────────────────────────────────────

CREATE TABLE "calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
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

CREATE TABLE "external_calendar_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"connection_id" uuid NOT NULL REFERENCES "public"."calendar_connections"("id") ON DELETE cascade ON UPDATE no action,
	"instructor_id" uuid REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action,
	"google_event_id" text NOT NULL,
	"summary" varchar(500),
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── Invoice Reminders ────────────────────────────────────────────────────────

CREATE TABLE "invoice_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"purchase_id" uuid NOT NULL REFERENCES "public"."credit_purchases"("id") ON DELETE restrict ON UPDATE no action,
	"sent_by_admin_id" uuid REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	"recipient_email" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"custom_message" text,
	"reminder_type" "invoice_reminder_type" NOT NULL,
	"delivery_status" varchar(20) DEFAULT 'sent' NOT NULL,
	"resend_message_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── Duo Invites ──────────────────────────────────────────────────────────────

CREATE TABLE "duo_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"organizer_booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action,
	"organizer_user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	"session_id" uuid NOT NULL REFERENCES "public"."class_sessions"("id") ON DELETE restrict ON UPDATE no action,
	"token" varchar(64) NOT NULL,
	"status" "duo_invite_status" DEFAULT 'pending' NOT NULL,
	"partner_booking_id" uuid REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action,
	"partner_user_id" uuid REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── Cancellation Mercy ───────────────────────────────────────────────────────

CREATE TABLE "cancellation_mercy_uses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	"booking_id" uuid REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── Welcome Journey ──────────────────────────────────────────────────────────

CREATE TABLE "welcome_journey_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"user_message" text,
	"offered_session_ids" jsonb DEFAULT '[]'::jsonb,
	"preferred_slots" jsonb DEFAULT '[]'::jsonb,
	"expires_at" timestamp with time zone,
	"warning_email_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── Class Pass Check-ins ─────────────────────────────────────────────────────

CREATE TABLE "class_pass_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	"session_id" uuid NOT NULL REFERENCES "public"."class_sessions"("id") ON DELETE restrict ON UPDATE no action,
	"provider_key" varchar(63) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"checked_in_at" timestamp with time zone,
	"notes" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────

CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"table_name" varchar(64) NOT NULL,
	"record_id" varchar(64) NOT NULL,
	"action" varchar(10) NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"changed_columns" jsonb,
	"changed_by" uuid REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Studios
CREATE UNIQUE INDEX "studios_slug_idx" ON "studios" USING btree ("slug");
CREATE INDEX "studios_status_idx" ON "studios" USING btree ("status");
CREATE UNIQUE INDEX "studios_custom_domain_idx" ON "studios" USING btree ("custom_domain");

-- Studio Settings
CREATE UNIQUE INDEX "studio_settings_studio_id_idx" ON "studio_settings" USING btree ("studio_id");

-- Users
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");
CREATE INDEX "users_studio_id_idx" ON "users" USING btree ("studio_id");
CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at");

-- Auth
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");

-- Instructors
CREATE INDEX "instructors_studio_id_idx" ON "instructors" USING btree ("studio_id");
CREATE UNIQUE INDEX "instructors_user_id_idx" ON "instructors" USING btree ("user_id");
CREATE INDEX "instructors_is_active_idx" ON "instructors" USING btree ("is_active");
CREATE INDEX "instructors_studio_active_idx" ON "instructors" USING btree ("studio_id", "is_active");

-- Class Templates
CREATE INDEX "class_templates_studio_id_idx" ON "class_templates" USING btree ("studio_id");
CREATE INDEX "class_templates_type_idx" ON "class_templates" USING btree ("class_type");
CREATE INDEX "class_templates_is_active_idx" ON "class_templates" USING btree ("is_active");
CREATE INDEX "class_templates_instructor_idx" ON "class_templates" USING btree ("instructor_id");
CREATE INDEX "class_templates_studio_active_idx" ON "class_templates" USING btree ("studio_id", "is_active");

-- Class Sessions
CREATE INDEX "class_sessions_studio_id_idx" ON "class_sessions" USING btree ("studio_id");
CREATE INDEX "class_sessions_starts_at_idx" ON "class_sessions" USING btree ("starts_at");
CREATE INDEX "class_sessions_status_idx" ON "class_sessions" USING btree ("status");
CREATE INDEX "class_sessions_studio_status_idx" ON "class_sessions" USING btree ("studio_id", "status");
CREATE INDEX "class_sessions_instructor_idx" ON "class_sessions" USING btree ("instructor_id");
CREATE INDEX "class_sessions_schedule_idx" ON "class_sessions" USING btree ("starts_at", "status");
CREATE INDEX "class_sessions_sync_error_idx" ON "class_sessions" USING btree ("google_calendar_sync_error");
CREATE INDEX "class_sessions_instructor_time_idx" ON "class_sessions" USING btree ("instructor_id", "status", "starts_at", "ends_at");
CREATE INDEX "class_sessions_template_id_idx" ON "class_sessions" USING btree ("template_id");

-- Bookings
CREATE UNIQUE INDEX "bookings_studio_user_session_unique_idx" ON "bookings" USING btree ("studio_id", "user_id", "session_id");
CREATE INDEX "bookings_studio_id_idx" ON "bookings" USING btree ("studio_id");
CREATE INDEX "bookings_user_id_idx" ON "bookings" USING btree ("user_id");
CREATE INDEX "bookings_session_id_idx" ON "bookings" USING btree ("session_id");
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");
CREATE INDEX "bookings_user_status_idx" ON "bookings" USING btree ("user_id", "status");
CREATE INDEX "bookings_session_status_idx" ON "bookings" USING btree ("session_id", "status");
CREATE INDEX "bookings_status_created_at_idx" ON "bookings" USING btree ("status", "created_at");
CREATE INDEX "bookings_booked_at_idx" ON "bookings" USING btree ("booked_at");
CREATE INDEX "bookings_access_provider_idx" ON "bookings" USING btree ("access_provider");

-- Waitlist
CREATE UNIQUE INDEX "waitlist_studio_user_session_unique_idx" ON "waitlist_entries" USING btree ("studio_id", "user_id", "session_id");
CREATE INDEX "waitlist_studio_id_idx" ON "waitlist_entries" USING btree ("studio_id");
CREATE INDEX "waitlist_session_position_idx" ON "waitlist_entries" USING btree ("session_id", "position");
CREATE INDEX "waitlist_status_idx" ON "waitlist_entries" USING btree ("status");
CREATE INDEX "waitlist_promotion_idx" ON "waitlist_entries" USING btree ("session_id", "status", "position");

-- Credit Packages
CREATE INDEX "credit_packages_studio_id_idx" ON "credit_packages" USING btree ("studio_id");
CREATE INDEX "credit_packages_is_active_idx" ON "credit_packages" USING btree ("is_active");
CREATE INDEX "credit_packages_credit_type_idx" ON "credit_packages" USING btree ("credit_type");
CREATE INDEX "credit_packages_studio_active_idx" ON "credit_packages" USING btree ("studio_id", "is_active");

-- Credit Purchases
CREATE INDEX "credit_purchases_studio_id_idx" ON "credit_purchases" USING btree ("studio_id");
CREATE INDEX "credit_purchases_user_id_idx" ON "credit_purchases" USING btree ("user_id");
CREATE INDEX "credit_purchases_package_id_idx" ON "credit_purchases" USING btree ("package_id");
CREATE INDEX "credit_purchases_status_idx" ON "credit_purchases" USING btree ("payment_status");
CREATE INDEX "credit_purchases_method_idx" ON "credit_purchases" USING btree ("payment_method");
CREATE UNIQUE INDEX "credit_purchases_stripe_session_unique_idx" ON "credit_purchases" USING btree ("stripe_session_id") WHERE "stripe_session_id" IS NOT NULL;
CREATE INDEX "credit_purchases_invoice_number_idx" ON "credit_purchases" USING btree ("invoice_number");
CREATE INDEX "credit_purchases_user_method_status_idx" ON "credit_purchases" USING btree ("user_id", "payment_method", "payment_status");
CREATE INDEX "credit_purchases_created_at_idx" ON "credit_purchases" USING btree ("created_at");

-- Credit Transactions
CREATE INDEX "credit_transactions_studio_id_idx" ON "credit_transactions" USING btree ("studio_id");
CREATE INDEX "credit_transactions_user_id_idx" ON "credit_transactions" USING btree ("user_id");
CREATE INDEX "credit_transactions_type_idx" ON "credit_transactions" USING btree ("type");
CREATE INDEX "credit_transactions_booking_id_idx" ON "credit_transactions" USING btree ("booking_id");
CREATE INDEX "credit_transactions_purchase_id_idx" ON "credit_transactions" USING btree ("purchase_id");
CREATE INDEX "credit_transactions_user_credit_type_idx" ON "credit_transactions" USING btree ("user_id", "credit_type");
CREATE INDEX "credit_transactions_user_created_at_idx" ON "credit_transactions" USING btree ("user_id", "created_at");

-- Membership Plans
CREATE INDEX "membership_plans_studio_id_idx" ON "membership_plans" USING btree ("studio_id");
CREATE INDEX "membership_plans_is_active_idx" ON "membership_plans" USING btree ("is_active");
CREATE INDEX "membership_plans_studio_active_idx" ON "membership_plans" USING btree ("studio_id", "is_active");

-- User Memberships
CREATE INDEX "user_memberships_studio_id_idx" ON "user_memberships" USING btree ("studio_id");
CREATE INDEX "user_memberships_user_id_idx" ON "user_memberships" USING btree ("user_id");
CREATE INDEX "user_memberships_plan_id_idx" ON "user_memberships" USING btree ("plan_id");
CREATE INDEX "user_memberships_grant_sweep_idx" ON "user_memberships" USING btree ("status", "next_credit_grant_at");

-- Promo Codes
CREATE INDEX "promo_codes_studio_id_idx" ON "promo_codes" USING btree ("studio_id");
CREATE INDEX "promo_codes_code_idx" ON "promo_codes" USING btree ("code");
CREATE INDEX "promo_codes_is_active_idx" ON "promo_codes" USING btree ("is_active");
CREATE UNIQUE INDEX "promo_codes_studio_code_idx" ON "promo_codes" USING btree ("studio_id", "code");
CREATE INDEX "promo_codes_package_idx" ON "promo_codes" USING btree ("package_id");

-- Promo Usages
CREATE INDEX "promo_usages_studio_id_idx" ON "promo_usages" USING btree ("studio_id");
CREATE INDEX "promo_usages_promo_id_idx" ON "promo_usages" USING btree ("promo_id");
CREATE INDEX "promo_usages_user_id_idx" ON "promo_usages" USING btree ("user_id");
CREATE INDEX "promo_usages_purchase_id_idx" ON "promo_usages" USING btree ("purchase_id");

-- Calendar
CREATE UNIQUE INDEX "calendar_connections_studio_user_unique" ON "calendar_connections" USING btree ("studio_id", "user_id");
CREATE INDEX "calendar_connections_sync_enabled_idx" ON "calendar_connections" USING btree ("sync_enabled");
CREATE UNIQUE INDEX "external_blocks_event_unique" ON "external_calendar_blocks" USING btree ("studio_id", "connection_id", "google_event_id");
CREATE INDEX "external_blocks_time_idx" ON "external_calendar_blocks" USING btree ("starts_at", "ends_at");
CREATE INDEX "external_blocks_instructor_idx" ON "external_calendar_blocks" USING btree ("instructor_id");

-- Invoice Reminders
CREATE INDEX "invoice_reminders_studio_id_idx" ON "invoice_reminders" USING btree ("studio_id");
CREATE INDEX "invoice_reminders_purchase_id_idx" ON "invoice_reminders" USING btree ("purchase_id");
CREATE INDEX "invoice_reminders_sent_by_admin_idx" ON "invoice_reminders" USING btree ("sent_by_admin_id");
CREATE INDEX "invoice_reminders_purchase_created_at_idx" ON "invoice_reminders" USING btree ("purchase_id", "created_at");

-- Duo Invites
CREATE INDEX "duo_invites_studio_id_idx" ON "duo_invites" USING btree ("studio_id");
CREATE UNIQUE INDEX "duo_invites_token_unique_idx" ON "duo_invites" USING btree ("token");
CREATE INDEX "duo_invites_organizer_booking_idx" ON "duo_invites" USING btree ("organizer_booking_id");
CREATE INDEX "duo_invites_session_idx" ON "duo_invites" USING btree ("session_id");
CREATE INDEX "duo_invites_status_expires_idx" ON "duo_invites" USING btree ("status", "expires_at");

-- Cancellation Mercy
CREATE INDEX "mercy_uses_studio_id_idx" ON "cancellation_mercy_uses" USING btree ("studio_id");
CREATE INDEX "mercy_uses_user_month_idx" ON "cancellation_mercy_uses" USING btree ("studio_id", "user_id", "used_at");

-- Welcome Journey
CREATE INDEX "welcome_journey_requests_studio_id_idx" ON "welcome_journey_requests" USING btree ("studio_id");
CREATE INDEX "welcome_journey_requests_user_id_idx" ON "welcome_journey_requests" USING btree ("user_id");
CREATE INDEX "welcome_journey_requests_status_idx" ON "welcome_journey_requests" USING btree ("status");
CREATE INDEX "welcome_journey_requests_status_expires_idx" ON "welcome_journey_requests" USING btree ("status", "expires_at");

-- Class Pass Checkins
CREATE INDEX "class_pass_checkins_studio_id_idx" ON "class_pass_checkins" USING btree ("studio_id");
CREATE INDEX "class_pass_checkins_user_id_idx" ON "class_pass_checkins" USING btree ("user_id");
CREATE INDEX "class_pass_checkins_session_id_idx" ON "class_pass_checkins" USING btree ("session_id");
CREATE INDEX "class_pass_checkins_provider_idx" ON "class_pass_checkins" USING btree ("provider_key");
CREATE INDEX "class_pass_checkins_status_idx" ON "class_pass_checkins" USING btree ("status");

-- Audit Logs
CREATE INDEX "audit_logs_table_record_idx" ON "audit_logs" USING btree ("table_name", "record_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");
CREATE INDEX "audit_logs_changed_by_idx" ON "audit_logs" USING btree ("changed_by");
CREATE INDEX "audit_logs_studio_idx" ON "audit_logs" USING btree ("studio_id");
CREATE INDEX "audit_logs_table_created_at_idx" ON "audit_logs" USING btree ("studio_id", "table_name", "created_at");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");

-- =============================================================================
-- Seed data: default studio for single-tenant deployments
-- =============================================================================

INSERT INTO "studios" ("slug", "name", "status", "timezone", "default_locale")
VALUES ('default', 'PilatesOS Studio', 'active', 'Europe/Berlin', 'de')
ON CONFLICT DO NOTHING;
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
-- PilatesOS — Add credits_granted_at to credit_purchases
-- Tracks whether credits have already been granted for a purchase,
-- preventing double-granting when an admin marks a pending/overdue
-- purchase as paid.

ALTER TABLE "credit_purchases"
  ADD COLUMN IF NOT EXISTS "credits_granted_at" timestamp with time zone;
-- PilatesOS — Enforce unique invoice numbers on credit_purchases
--
-- Prevents duplicate invoice numbers from concurrent purchases or
-- copy-pasted invoice generation logic. NULL values are still allowed
-- and do not violate the unique index.
--
-- NOTE: If this migration fails, existing duplicate non-NULL invoice numbers
-- must be deduplicated before the constraint can be applied.

CREATE UNIQUE INDEX IF NOT EXISTS "credit_purchases_invoice_number_unique_idx"
  ON "credit_purchases" ("invoice_number");
-- Migration: add studios.created_by_user_id for onboarding ownership verification
-- Prevents onboarding completion from escalating an arbitrary authenticated user
-- to admin of an existing studio row.

ALTER TABLE studios
  ADD COLUMN created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX studios_created_by_user_id_idx ON studios(created_by_user_id);
-- =============================================================================
-- PilatesOS — Migration 0008: Enforce NOT NULL on studio_id
-- =============================================================================
-- This migration enforces tenant isolation at the schema level for users and
-- credit_packages. It does NOT silently backfill NULL values; if any row lacks
-- a studio_id the migration fails loudly so operators can fix the data first.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "studio_id" IS NULL) THEN
    RAISE EXCEPTION 'users.studio_id contains NULL values; backfill before applying NOT NULL constraint';
  END IF;

  IF EXISTS (SELECT 1 FROM "credit_packages" WHERE "studio_id" IS NULL) THEN
    RAISE EXCEPTION 'credit_packages.studio_id contains NULL values; backfill before applying NOT NULL constraint';
  END IF;
END $$;

ALTER TABLE "users" ALTER COLUMN "studio_id" SET NOT NULL;
ALTER TABLE "credit_packages" ALTER COLUMN "studio_id" SET NOT NULL;
-- =============================================================================
-- PilatesOS — Migration 0009: Add expires_at to credit_transactions
-- =============================================================================
-- Adds an optional expiry timestamp to the single credit ledger.
-- NULL means the credits never expire, which is the safe backfill value for
-- all existing rows. Balance queries exclude rows whose expires_at is in the
-- past; the ledger rows themselves are never deleted or mutated.
-- =============================================================================

ALTER TABLE "credit_transactions" ADD COLUMN "expires_at" TIMESTAMP WITH TIME ZONE;

-- Index for efficient balance queries that filter out expired credits.
CREATE INDEX IF NOT EXISTS "credit_transactions_expires_at_idx"
  ON "credit_transactions" ("expires_at");
-- =============================================================================
-- PilatesOS — Migration 0010: Add idempotency key to credit_purchases
-- =============================================================================
-- Prevents duplicate pay-at-studio invoices when a client submits the same
-- purchase more than once (network retry, double-click, etc.). The client
-- generates a UUID before the first request and sends it in the body; the
-- server returns the existing pending purchase if the key is already present.
-- NULL values are allowed and do not conflict with the unique index.
-- =============================================================================

ALTER TABLE "credit_purchases" ADD COLUMN "idempotency_key" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "credit_purchases_idempotency_key_idx"
  ON "credit_purchases" ("idempotency_key");

-- =============================================================================
-- Drizzle migration journal (so drizzle-kit migrate skips these on next run)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS "drizzle";

CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
);

-- Hashes are SHA-256 of the corresponding .sql migration file contents.
-- created_at values match the "when" field in meta/_journal.json.
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES
    ('b527f1b5524c9998e688b4f5633846e789e8e7df0524678f5381ed86212fbb04', 1780419807312),
    ('30a4a90f374288ee638558fde65d583f727b22337a3de8f5ef935a5eb6a83c9f', 1780651626151),
    ('8f673f90120b2498dc2cc109e0198bbc64ef308c86de87cc51abd06d25d74319', 1780655341360),
    ('002d72a4c4029be76fd7a62d3220628f47b02c03a31254d15da0c49ca664420c', 1781073308454),
    ('07320938506a65ee843fc47f1e2b1c574a6bc15738522e77662b1794daecde81', 1781244612800),
    ('ee9c47b13eb45fd061d9b03bfecdf271daebab7e46dddab9c6cd4f70c074d3ad', 1781778234148),
    ('a728653f67ff7d0580579949d930c3843d5f424026b7cd78f00669318391871b', 1781778234150),
    ('e46f4fdb50bcf5564fb5c3943d530b0cc62d181a878cc0ebe49f3a5f2b175d9d', 1781778234151),
    ('ca7c6906cce999c484a3416518919f52aca84f2ab5e44e9bc5154158c261ddad', 1781778234152)
ON CONFLICT DO NOTHING;
