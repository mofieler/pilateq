-- =============================================================================
-- Fix script for the partially-applied PilatesOS schema.
-- Run this after init-schema.sql to create tables that failed due to the
-- credit_purchases -> promo_codes FK ordering bug.
-- =============================================================================

-- ─── credit_purchases ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "credit_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	"package_id" uuid REFERENCES "public"."credit_packages"("id") ON DELETE restrict ON UPDATE no action,
	"promo_code_id" uuid REFERENCES "public"."promo_codes"("id") ON DELETE set null ON UPDATE no action,
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

ALTER TABLE "credit_purchases"
  ADD COLUMN IF NOT EXISTS "credits_granted_at" timestamp with time zone;

ALTER TABLE "credit_purchases"
  ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "credit_purchases_invoice_number_unique_idx"
  ON "credit_purchases" ("invoice_number");

CREATE INDEX IF NOT EXISTS "credit_purchases_studio_id_idx" ON "credit_purchases" USING btree ("studio_id");
CREATE INDEX IF NOT EXISTS "credit_purchases_user_id_idx" ON "credit_purchases" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "credit_purchases_package_id_idx" ON "credit_purchases" USING btree ("package_id");
CREATE INDEX IF NOT EXISTS "credit_purchases_status_idx" ON "credit_purchases" USING btree ("payment_status");
CREATE INDEX IF NOT EXISTS "credit_purchases_method_idx" ON "credit_purchases" USING btree ("payment_method");
CREATE UNIQUE INDEX IF NOT EXISTS "credit_purchases_stripe_session_unique_idx" ON "credit_purchases" USING btree ("stripe_session_id") WHERE "stripe_session_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "credit_purchases_invoice_number_idx" ON "credit_purchases" USING btree ("invoice_number");
CREATE INDEX IF NOT EXISTS "credit_purchases_user_method_status_idx" ON "credit_purchases" USING btree ("user_id", "payment_method", "payment_status");
CREATE INDEX IF NOT EXISTS "credit_purchases_created_at_idx" ON "credit_purchases" USING btree ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "credit_purchases_idempotency_key_idx"
  ON "credit_purchases" ("idempotency_key");

-- ─── credit_transactions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "credit_transactions" (
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

ALTER TABLE "credit_transactions"
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS "credit_transactions_studio_id_idx" ON "credit_transactions" USING btree ("studio_id");
CREATE INDEX IF NOT EXISTS "credit_transactions_user_id_idx" ON "credit_transactions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "credit_transactions_type_idx" ON "credit_transactions" USING btree ("type");
CREATE INDEX IF NOT EXISTS "credit_transactions_booking_id_idx" ON "credit_transactions" USING btree ("booking_id");
CREATE INDEX IF NOT EXISTS "credit_transactions_purchase_id_idx" ON "credit_transactions" USING btree ("purchase_id");
CREATE INDEX IF NOT EXISTS "credit_transactions_user_credit_type_idx" ON "credit_transactions" USING btree ("user_id", "credit_type");
CREATE INDEX IF NOT EXISTS "credit_transactions_user_created_at_idx" ON "credit_transactions" USING btree ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "credit_transactions_expires_at_idx"
  ON "credit_transactions" ("expires_at");

-- ─── promo_usages ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "promo_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action,
	"promo_id" uuid NOT NULL REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	"purchase_id" uuid NOT NULL REFERENCES "public"."credit_purchases"("id") ON DELETE cascade ON UPDATE no action,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "promo_usages_studio_id_idx" ON "promo_usages" USING btree ("studio_id");
CREATE INDEX IF NOT EXISTS "promo_usages_promo_id_idx" ON "promo_usages" USING btree ("promo_id");
CREATE INDEX IF NOT EXISTS "promo_usages_user_id_idx" ON "promo_usages" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "promo_usages_purchase_id_idx" ON "promo_usages" USING btree ("purchase_id");

-- ─── invoice_reminders ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "invoice_reminders" (
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

CREATE INDEX IF NOT EXISTS "invoice_reminders_studio_id_idx" ON "invoice_reminders" USING btree ("studio_id");
CREATE INDEX IF NOT EXISTS "invoice_reminders_purchase_id_idx" ON "invoice_reminders" USING btree ("purchase_id");
CREATE INDEX IF NOT EXISTS "invoice_reminders_sent_by_admin_idx" ON "invoice_reminders" USING btree ("sent_by_admin_id");
CREATE INDEX IF NOT EXISTS "invoice_reminders_purchase_created_at_idx" ON "invoice_reminders" USING btree ("purchase_id", "created_at");
