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