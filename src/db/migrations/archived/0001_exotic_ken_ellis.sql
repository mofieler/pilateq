CREATE TYPE "public"."credit_lot_status" AS ENUM('active', 'exhausted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'paused', 'cancelled', 'expired');--> statement-breakpoint
ALTER TABLE "credit_lots" DROP CONSTRAINT "credit_lots_status_valid";--> statement-breakpoint
ALTER TABLE "promo_codes" DROP CONSTRAINT "promo_codes_package_id_credit_packages_id_fk";
--> statement-breakpoint
ALTER TABLE "credit_lots" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."credit_lot_status";--> statement-breakpoint
ALTER TABLE "credit_lots" ALTER COLUMN "status" SET DATA TYPE "public"."credit_lot_status" USING "status"::"public"."credit_lot_status";--> statement-breakpoint
ALTER TABLE "user_memberships" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."membership_status";--> statement-breakpoint
ALTER TABLE "user_memberships" ALTER COLUMN "status" SET DATA TYPE "public"."membership_status" USING "status"::"public"."membership_status";--> statement-breakpoint
ALTER TABLE "credit_lots" ADD COLUMN "membership_id" uuid;--> statement-breakpoint
ALTER TABLE "credit_lots" ADD COLUMN "adjustment_id" uuid;--> statement-breakpoint
ALTER TABLE "credit_lots" ADD CONSTRAINT "credit_lots_membership_id_user_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."user_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_lots" ADD CONSTRAINT "credit_lots_adjustment_id_credit_adjustments_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."credit_adjustments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_package_id_credit_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."credit_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_lots_purchase_idx" ON "credit_lots" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "credit_lots_membership_idx" ON "credit_lots" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "credit_lots_adjustment_idx" ON "credit_lots" USING btree ("adjustment_id");--> statement-breakpoint
CREATE INDEX "welcome_journey_requests_user_id_idx" ON "welcome_journey_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "welcome_journey_requests_status_idx" ON "welcome_journey_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "welcome_journey_requests_status_expires_idx" ON "welcome_journey_requests" USING btree ("status","expires_at");--> statement-breakpoint
ALTER TABLE "credit_packages" ADD CONSTRAINT "credit_packages_stripe_price_id_unique" UNIQUE("stripe_price_id");--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id");--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_ends_after_starts" CHECK ("class_sessions"."ends_at" > "class_sessions"."starts_at");--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_booked_count_nonneg" CHECK ("class_sessions"."booked_count" >= 0);--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_waitlist_count_nonneg" CHECK ("class_sessions"."waitlist_count" >= 0);--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_capacity_positive" CHECK ("class_sessions"."max_capacity" > 0);--> statement-breakpoint
ALTER TABLE "class_templates" ADD CONSTRAINT "class_templates_duration_positive" CHECK ("class_templates"."duration_minutes" > 0);--> statement-breakpoint
ALTER TABLE "class_templates" ADD CONSTRAINT "class_templates_capacity_positive" CHECK ("class_templates"."max_capacity" > 0);--> statement-breakpoint
ALTER TABLE "class_templates" ADD CONSTRAINT "class_templates_credit_cost_positive" CHECK ("class_templates"."credit_cost" > 0);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_credits_spent_positive" CHECK ("bookings"."credits_spent" > 0);--> statement-breakpoint
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_balance_nonneg" CHECK ("credit_balances"."balance" >= 0);--> statement-breakpoint
ALTER TABLE "credit_lots" ADD CONSTRAINT "credit_lots_single_provenance" CHECK (
      ("credit_lots"."purchase_id" IS NOT NULL)::int +
      ("credit_lots"."membership_id" IS NOT NULL)::int +
      ("credit_lots"."adjustment_id" IS NOT NULL)::int <= 1
    );--> statement-breakpoint
ALTER TABLE "credit_packages" ADD CONSTRAINT "credit_packages_price_nonneg" CHECK ("credit_packages"."price_cents" >= 0);--> statement-breakpoint
ALTER TABLE "credit_packages" ADD CONSTRAINT "credit_packages_credits_positive" CHECK ("credit_packages"."credits_amount" > 0);--> statement-breakpoint
ALTER TABLE "credit_packages" ADD CONSTRAINT "credit_packages_validity_days_positive" CHECK ("credit_packages"."validity_days" > 0);--> statement-breakpoint
ALTER TABLE "credit_packages" ADD CONSTRAINT "credit_packages_validity_weeks_positive" CHECK ("credit_packages"."validity_weeks" > 0);--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_price_nonneg" CHECK ("credit_purchases"."price_cents" >= 0);--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_credits_positive" CHECK ("credit_purchases"."credits_amount" > 0);--> statement-breakpoint
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_weekly_credits_positive" CHECK ("membership_plans"."weekly_credits" > 0);--> statement-breakpoint
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_duration_weeks_positive" CHECK ("membership_plans"."duration_weeks" > 0);--> statement-breakpoint
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_price_nonneg" CHECK ("membership_plans"."price_cents" >= 0);--> statement-breakpoint
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_weekly_credits_positive" CHECK ("user_memberships"."weekly_credits" > 0);--> statement-breakpoint
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_ends_after_starts" CHECK ("user_memberships"."ends_at" > "user_memberships"."started_at");--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_value_nonneg" CHECK ("promo_codes"."value" >= 0);--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_current_uses_nonneg" CHECK ("promo_codes"."current_uses" >= 0);--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_max_uses_per_user_positive" CHECK ("promo_codes"."max_uses_per_user" > 0);--> statement-breakpoint
ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_attempts_nonneg" CHECK ("rate_limits"."attempts" >= 0);--> statement-breakpoint
ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_backoff_tier_nonneg" CHECK ("rate_limits"."backoff_tier" >= 0);