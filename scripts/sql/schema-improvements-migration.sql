-- ============================================================================
-- PILATES OS — Schema-Improvement Migration
-- Ausführbar direkt auf der VPS-PostgreSQL (psql oder Admin-Tool)
-- Idempotent: Mehrfaches Ausführen ist sicher (wirft keine Fehler)
-- ============================================================================

-- ============================================================================
-- 1. NEUE ENUMS ERSTELLEN
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_lot_status') THEN
        CREATE TYPE credit_lot_status AS ENUM ('active', 'exhausted', 'expired');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status') THEN
        CREATE TYPE membership_status AS ENUM ('active', 'paused', 'cancelled', 'expired');
    END IF;
END $$;

-- ============================================================================
-- 2. BESTEHENDE STATUS-SPALTEN AUF ENUMS ÄNDERN
-- ============================================================================
-- Prüfe zuerst, ob ungültige Werte in creditLots existieren
DO $$
DECLARE
    bad_rows INTEGER;
BEGIN
    SELECT COUNT(*) INTO bad_rows FROM credit_lots
    WHERE status NOT IN ('active', 'exhausted', 'expired');
    
    IF bad_rows > 0 THEN
        RAISE NOTICE 'WARNUNG: % credit_lots Zeilen haben ungültige Status-Werte. Bereinige zuerst!', bad_rows;
        -- Fallback: Setze unbekannte Werte auf 'active'
        UPDATE credit_lots SET status = 'active'
        WHERE status NOT IN ('active', 'exhausted', 'expired');
    END IF;
END $$;

DO $$
BEGIN
    -- Nur ändern, wenn noch nicht enum
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'credit_lots' AND column_name = 'status'
        AND data_type = 'character varying'
    ) THEN
        ALTER TABLE credit_lots
        ALTER COLUMN status TYPE credit_lot_status
        USING status::credit_lot_status;
    END IF;
END $$;

-- Prüfe zuerst, ob ungültige Werte in userMemberships existieren
DO $$
DECLARE
    bad_rows INTEGER;
BEGIN
    SELECT COUNT(*) INTO bad_rows FROM user_memberships
    WHERE status NOT IN ('active', 'paused', 'cancelled', 'expired');
    
    IF bad_rows > 0 THEN
        RAISE NOTICE 'WARNUNG: % user_memberships Zeilen haben ungültige Status-Werte. Bereinige zuerst!', bad_rows;
        UPDATE user_memberships SET status = 'active'
        WHERE status NOT IN ('active', 'paused', 'cancelled', 'expired');
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_memberships' AND column_name = 'status'
        AND data_type = 'character varying'
    ) THEN
        ALTER TABLE user_memberships
        ALTER COLUMN status TYPE membership_status
        USING status::membership_status;
    END IF;
END $$;

-- ============================================================================
-- 3. NEUE SPALTEN IN credit_lots (Provenance-Erweiterung)
-- ============================================================================

ALTER TABLE credit_lots
ADD COLUMN IF NOT EXISTS membership_id UUID REFERENCES user_memberships(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS adjustment_id UUID REFERENCES credit_adjustments(id) ON DELETE SET NULL;

-- ============================================================================
-- 4. UNIQUE-CONSTRAINTS FÜR EXTERNE IDs
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'credit_packages_stripe_price_id_unique'
    ) THEN
        ALTER TABLE credit_packages ADD CONSTRAINT credit_packages_stripe_price_id_unique UNIQUE (stripe_price_id);
    END IF;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'credit_purchases_stripe_payment_intent_id_unique'
    ) THEN
        ALTER TABLE credit_purchases ADD CONSTRAINT credit_purchases_stripe_payment_intent_id_unique UNIQUE (stripe_payment_intent_id);
    END IF;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN
    NULL;
END $$;

-- ============================================================================
-- 5. FK-VERHALTEN KORRIGIEREN
-- ============================================================================
-- promoCodes.packageId: cascade -> set null (PromoCodes dürfen nicht gelöscht werden)

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'promo_codes_package_id_credit_packages_id_fk'
    ) THEN
        ALTER TABLE promo_codes DROP CONSTRAINT promo_codes_package_id_credit_packages_id_fk;
    END IF;
END $$;

DO $$
BEGIN
    ALTER TABLE promo_codes
    ADD CONSTRAINT promo_codes_package_id_credit_packages_id_fk
    FOREIGN KEY (package_id) REFERENCES credit_packages(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================================================
-- 6. CHECK-CONSTRAINTS (mit NOT VALID + VALIDATE für Sicherheit)
-- ============================================================================

-- credit_packages
ALTER TABLE credit_packages DROP CONSTRAINT IF EXISTS credit_packages_price_nonneg;
ALTER TABLE credit_packages ADD CONSTRAINT credit_packages_price_nonneg CHECK (price_cents >= 0) NOT VALID;
ALTER TABLE credit_packages VALIDATE CONSTRAINT credit_packages_price_nonneg;

ALTER TABLE credit_packages DROP CONSTRAINT IF EXISTS credit_packages_credits_positive;
ALTER TABLE credit_packages ADD CONSTRAINT credit_packages_credits_positive CHECK (credits_amount > 0) NOT VALID;
ALTER TABLE credit_packages VALIDATE CONSTRAINT credit_packages_credits_positive;

ALTER TABLE credit_packages DROP CONSTRAINT IF EXISTS credit_packages_validity_days_positive;
ALTER TABLE credit_packages ADD CONSTRAINT credit_packages_validity_days_positive CHECK (validity_days > 0) NOT VALID;
ALTER TABLE credit_packages VALIDATE CONSTRAINT credit_packages_validity_days_positive;

ALTER TABLE credit_packages DROP CONSTRAINT IF EXISTS credit_packages_validity_weeks_positive;
ALTER TABLE credit_packages ADD CONSTRAINT credit_packages_validity_weeks_positive CHECK (validity_weeks > 0) NOT VALID;
ALTER TABLE credit_packages VALIDATE CONSTRAINT credit_packages_validity_weeks_positive;

-- credit_balances
ALTER TABLE credit_balances DROP CONSTRAINT IF EXISTS credit_balances_balance_nonneg;
ALTER TABLE credit_balances ADD CONSTRAINT credit_balances_balance_nonneg CHECK (balance >= 0) NOT VALID;
ALTER TABLE credit_balances VALIDATE CONSTRAINT credit_balances_balance_nonneg;

-- credit_purchases
ALTER TABLE credit_purchases DROP CONSTRAINT IF EXISTS credit_purchases_price_nonneg;
ALTER TABLE credit_purchases ADD CONSTRAINT credit_purchases_price_nonneg CHECK (price_cents >= 0) NOT VALID;
ALTER TABLE credit_purchases VALIDATE CONSTRAINT credit_purchases_price_nonneg;

ALTER TABLE credit_purchases DROP CONSTRAINT IF EXISTS credit_purchases_credits_positive;
ALTER TABLE credit_purchases ADD CONSTRAINT credit_purchases_credits_positive CHECK (credits_amount > 0) NOT VALID;
ALTER TABLE credit_purchases VALIDATE CONSTRAINT credit_purchases_credits_positive;

-- credit_lots
ALTER TABLE credit_lots DROP CONSTRAINT IF EXISTS credit_lots_remaining_nonneg;
ALTER TABLE credit_lots ADD CONSTRAINT credit_lots_remaining_nonneg CHECK (remaining_amount >= 0) NOT VALID;
ALTER TABLE credit_lots VALIDATE CONSTRAINT credit_lots_remaining_nonneg;

ALTER TABLE credit_lots DROP CONSTRAINT IF EXISTS credit_lots_remaining_lte_original;
ALTER TABLE credit_lots ADD CONSTRAINT credit_lots_remaining_lte_original CHECK (remaining_amount <= original_amount) NOT VALID;
ALTER TABLE credit_lots VALIDATE CONSTRAINT credit_lots_remaining_lte_original;

ALTER TABLE credit_lots DROP CONSTRAINT IF EXISTS credit_lots_single_provenance;
ALTER TABLE credit_lots ADD CONSTRAINT credit_lots_single_provenance CHECK (
    (purchase_id IS NOT NULL)::int +
    (membership_id IS NOT NULL)::int +
    (adjustment_id IS NOT NULL)::int <= 1
) NOT VALID;
ALTER TABLE credit_lots VALIDATE CONSTRAINT credit_lots_single_provenance;

-- membership_plans
ALTER TABLE membership_plans DROP CONSTRAINT IF EXISTS membership_plans_weekly_credits_positive;
ALTER TABLE membership_plans ADD CONSTRAINT membership_plans_weekly_credits_positive CHECK (weekly_credits > 0) NOT VALID;
ALTER TABLE membership_plans VALIDATE CONSTRAINT membership_plans_weekly_credits_positive;

ALTER TABLE membership_plans DROP CONSTRAINT IF EXISTS membership_plans_duration_weeks_positive;
ALTER TABLE membership_plans ADD CONSTRAINT membership_plans_duration_weeks_positive CHECK (duration_weeks > 0) NOT VALID;
ALTER TABLE membership_plans VALIDATE CONSTRAINT membership_plans_duration_weeks_positive;

ALTER TABLE membership_plans DROP CONSTRAINT IF EXISTS membership_plans_price_nonneg;
ALTER TABLE membership_plans ADD CONSTRAINT membership_plans_price_nonneg CHECK (price_cents >= 0) NOT VALID;
ALTER TABLE membership_plans VALIDATE CONSTRAINT membership_plans_price_nonneg;

-- user_memberships
ALTER TABLE user_memberships DROP CONSTRAINT IF EXISTS user_memberships_weekly_credits_positive;
ALTER TABLE user_memberships ADD CONSTRAINT user_memberships_weekly_credits_positive CHECK (weekly_credits > 0) NOT VALID;
ALTER TABLE user_memberships VALIDATE CONSTRAINT user_memberships_weekly_credits_positive;

ALTER TABLE user_memberships DROP CONSTRAINT IF EXISTS user_memberships_ends_after_starts;
ALTER TABLE user_memberships ADD CONSTRAINT user_memberships_ends_after_starts CHECK (ends_at > started_at) NOT VALID;
ALTER TABLE user_memberships VALIDATE CONSTRAINT user_memberships_ends_after_starts;

-- bookings
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_credits_spent_positive;
ALTER TABLE bookings ADD CONSTRAINT bookings_credits_spent_positive CHECK (credits_spent > 0) NOT VALID;
ALTER TABLE bookings VALIDATE CONSTRAINT bookings_credits_spent_positive;

-- class_templates
ALTER TABLE class_templates DROP CONSTRAINT IF EXISTS class_templates_duration_positive;
ALTER TABLE class_templates ADD CONSTRAINT class_templates_duration_positive CHECK (duration_minutes > 0) NOT VALID;
ALTER TABLE class_templates VALIDATE CONSTRAINT class_templates_duration_positive;

ALTER TABLE class_templates DROP CONSTRAINT IF EXISTS class_templates_capacity_positive;
ALTER TABLE class_templates ADD CONSTRAINT class_templates_capacity_positive CHECK (max_capacity > 0) NOT VALID;
ALTER TABLE class_templates VALIDATE CONSTRAINT class_templates_capacity_positive;

ALTER TABLE class_templates DROP CONSTRAINT IF EXISTS class_templates_credit_cost_positive;
ALTER TABLE class_templates ADD CONSTRAINT class_templates_credit_cost_positive CHECK (credit_cost > 0) NOT VALID;
ALTER TABLE class_templates VALIDATE CONSTRAINT class_templates_credit_cost_positive;

-- class_sessions
ALTER TABLE class_sessions DROP CONSTRAINT IF EXISTS class_sessions_ends_after_starts;
ALTER TABLE class_sessions ADD CONSTRAINT class_sessions_ends_after_starts CHECK (ends_at > starts_at) NOT VALID;
ALTER TABLE class_sessions VALIDATE CONSTRAINT class_sessions_ends_after_starts;

ALTER TABLE class_sessions DROP CONSTRAINT IF EXISTS class_sessions_booked_count_nonneg;
ALTER TABLE class_sessions ADD CONSTRAINT class_sessions_booked_count_nonneg CHECK (booked_count >= 0) NOT VALID;
ALTER TABLE class_sessions VALIDATE CONSTRAINT class_sessions_booked_count_nonneg;

ALTER TABLE class_sessions DROP CONSTRAINT IF EXISTS class_sessions_waitlist_count_nonneg;
ALTER TABLE class_sessions ADD CONSTRAINT class_sessions_waitlist_count_nonneg CHECK (waitlist_count >= 0) NOT VALID;
ALTER TABLE class_sessions VALIDATE CONSTRAINT class_sessions_waitlist_count_nonneg;

ALTER TABLE class_sessions DROP CONSTRAINT IF EXISTS class_sessions_capacity_positive;
ALTER TABLE class_sessions ADD CONSTRAINT class_sessions_capacity_positive CHECK (max_capacity > 0) NOT VALID;
ALTER TABLE class_sessions VALIDATE CONSTRAINT class_sessions_capacity_positive;

-- promo_codes
ALTER TABLE promo_codes DROP CONSTRAINT IF EXISTS promo_codes_value_nonneg;
ALTER TABLE promo_codes ADD CONSTRAINT promo_codes_value_nonneg CHECK (value >= 0) NOT VALID;
ALTER TABLE promo_codes VALIDATE CONSTRAINT promo_codes_value_nonneg;

ALTER TABLE promo_codes DROP CONSTRAINT IF EXISTS promo_codes_current_uses_nonneg;
ALTER TABLE promo_codes ADD CONSTRAINT promo_codes_current_uses_nonneg CHECK (current_uses >= 0) NOT VALID;
ALTER TABLE promo_codes VALIDATE CONSTRAINT promo_codes_current_uses_nonneg;

ALTER TABLE promo_codes DROP CONSTRAINT IF EXISTS promo_codes_max_uses_per_user_positive;
ALTER TABLE promo_codes ADD CONSTRAINT promo_codes_max_uses_per_user_positive CHECK (max_uses_per_user > 0) NOT VALID;
ALTER TABLE promo_codes VALIDATE CONSTRAINT promo_codes_max_uses_per_user_positive;

-- rate_limits
ALTER TABLE rate_limits DROP CONSTRAINT IF EXISTS rate_limits_attempts_nonneg;
ALTER TABLE rate_limits ADD CONSTRAINT rate_limits_attempts_nonneg CHECK (attempts >= 0) NOT VALID;
ALTER TABLE rate_limits VALIDATE CONSTRAINT rate_limits_attempts_nonneg;

ALTER TABLE rate_limits DROP CONSTRAINT IF EXISTS rate_limits_backoff_tier_nonneg;
ALTER TABLE rate_limits ADD CONSTRAINT rate_limits_backoff_tier_nonneg CHECK (backoff_tier >= 0) NOT VALID;
ALTER TABLE rate_limits VALIDATE CONSTRAINT rate_limits_backoff_tier_nonneg;

-- ============================================================================
-- 7. NEUE INDIZES
-- ============================================================================

CREATE INDEX IF NOT EXISTS credit_lots_purchase_idx ON credit_lots(purchase_id);
CREATE INDEX IF NOT EXISTS credit_lots_membership_idx ON credit_lots(membership_id);
CREATE INDEX IF NOT EXISTS credit_lots_adjustment_idx ON credit_lots(adjustment_id);

CREATE INDEX IF NOT EXISTS welcome_journey_requests_user_id_idx ON welcome_journey_requests(user_id);
CREATE INDEX IF NOT EXISTS welcome_journey_requests_status_idx ON welcome_journey_requests(status);
CREATE INDEX IF NOT EXISTS welcome_journey_requests_status_expires_idx ON welcome_journey_requests(status, expires_at);

-- ============================================================================
-- 8. DRIZZLE MIGRATION JOURNAL AKTUALISIEREN (optional)
-- ============================================================================
-- Wenn du später mit drizzle-kit weiterarbeiten willst, führe nach dem SQL:
--   npx drizzle-kit generate
-- aus, damit die Journal-Snapshot auf den neuen Stand gebracht wird.
-- Die obigen SQL-Befehle sind die "ground truth" für die DB.

-- ============================================================================
-- FERTIG
-- ============================================================================
