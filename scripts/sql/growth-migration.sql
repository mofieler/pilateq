-- ============================================================================
-- PILATES OS — Growth & Scalability Migration (Part 2)
-- Run directly on VPS: psql "$DATABASE_URL" -f scripts/sql/growth-migration.sql
--
-- Prerequisites: Part 1 (schema-improvements-migration.sql) already executed.
-- This script applies what drizzle-kit CANNOT generate: triggers, data syncs.
-- ============================================================================

-- ============================================================================
-- 0. ENSURE MIGRATION 0002 IS MARKED AS APPLIED (so future drizzle-kit works)
-- ============================================================================

CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash TEXT NOT NULL UNIQUE,
    created_at BIGINT
);

INSERT INTO __drizzle_migrations (hash, created_at)
VALUES ('0002_dear_thundra', 1780655341360)
ON CONFLICT (hash) DO NOTHING;

-- ============================================================================
-- 1. SCHEMA FROM 0002_dear_thundra.sql (if not already applied by drizzle-kit)
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action') THEN
        CREATE TYPE audit_action AS ENUM('INSERT', 'UPDATE', 'DELETE');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_classes_attended INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    streak_last_updated_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_stats_user_id_unique UNIQUE (user_id),
    CONSTRAINT user_stats_version_nonneg CHECK (version >= 0),
    CONSTRAINT user_stats_total_classes_nonneg CHECK (total_classes_attended >= 0),
    CONSTRAINT user_stats_current_streak_nonneg CHECK (current_streak >= 0),
    CONSTRAINT user_stats_longest_streak_nonneg CHECK (longest_streak >= 0)
);

CREATE INDEX IF NOT EXISTS user_stats_user_id_idx ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS user_stats_streak_idx ON user_stats(current_streak);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(64) NOT NULL,
    record_id VARCHAR(64) NOT NULL,
    action VARCHAR(10) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_columns JSONB,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_table_record_idx ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_changed_by_idx ON audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS audit_logs_table_created_at_idx ON audit_logs(table_name, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);

-- Add version columns if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE credit_balances ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

-- Add version CHECK constraints
DO $$ BEGIN ALTER TABLE class_sessions ADD CONSTRAINT class_sessions_version_nonneg CHECK (version >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE bookings ADD CONSTRAINT bookings_version_nonneg CHECK (version >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE credit_balances ADD CONSTRAINT credit_balances_version_nonneg CHECK (version >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD CONSTRAINT users_version_nonneg CHECK (version >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. MIGRATE EXISTING GAMIFICATION DATA (users → user_stats)
-- ============================================================================

INSERT INTO user_stats (user_id, total_classes_attended, current_streak, longest_streak, streak_last_updated_at)
SELECT id, total_classes_attended, current_streak, longest_streak, streak_last_updated_at
FROM users
WHERE NOT EXISTS (SELECT 1 FROM user_stats WHERE user_stats.user_id = users.id)
ON CONFLICT (user_id) DO UPDATE SET
    total_classes_attended = EXCLUDED.total_classes_attended,
    current_streak = EXCLUDED.current_streak,
    longest_streak = EXCLUDED.longest_streak,
    streak_last_updated_at = EXCLUDED.streak_last_updated_at;

-- ============================================================================
-- 3. TRIGGER: user_stats → users synchronisieren (backward-compatible)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_user_stats_to_users()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users SET
        total_classes_attended = NEW.total_classes_attended,
        current_streak = NEW.current_streak,
        longest_streak = NEW.longest_streak,
        streak_last_updated_at = NEW.streak_last_updated_at,
        updated_at = NEW.updated_at
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_stats_sync_trigger ON user_stats;
CREATE TRIGGER user_stats_sync_trigger
    AFTER INSERT OR UPDATE ON user_stats
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_stats_to_users();

-- ============================================================================
-- 4. TRIGGER: class_sessions Counter aus Source-of-Truth berechnen
-- ============================================================================

CREATE OR REPLACE FUNCTION update_session_counters()
RETURNS TRIGGER AS $$
DECLARE
    v_session_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_session_id := OLD.session_id;
    ELSE
        v_session_id := NEW.session_id;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.session_id IS DISTINCT FROM NEW.session_id THEN
        UPDATE class_sessions SET
            booked_count = COALESCE((SELECT COUNT(*) FROM bookings WHERE session_id = OLD.session_id AND status IN ('confirmed', 'attended', 'waitlisted')), 0),
            waitlist_count = COALESCE((SELECT COUNT(*) FROM waitlist_entries WHERE session_id = OLD.session_id AND status = 'waiting'), 0),
            updated_at = NOW()
        WHERE id = OLD.session_id;
        v_session_id := NEW.session_id;
    END IF;

    UPDATE class_sessions SET
        booked_count = COALESCE((SELECT COUNT(*) FROM bookings WHERE session_id = v_session_id AND status IN ('confirmed', 'attended', 'waitlisted')), 0),
        waitlist_count = COALESCE((SELECT COUNT(*) FROM waitlist_entries WHERE session_id = v_session_id AND status = 'waiting'), 0),
        updated_at = NOW()
    WHERE id = v_session_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bookings_counter_trigger ON bookings;
CREATE TRIGGER bookings_counter_trigger
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_session_counters();

DROP TRIGGER IF EXISTS waitlist_counter_trigger ON waitlist_entries;
CREATE TRIGGER waitlist_counter_trigger
    AFTER INSERT OR UPDATE OR DELETE ON waitlist_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_session_counters();

-- ============================================================================
-- 5. TRIGGER: credit_balances Cache aus credit_lots berechnen
-- ============================================================================

CREATE OR REPLACE FUNCTION update_credit_balance_cache()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_credit_type credit_type;
    v_new_balance INTEGER;
    v_new_expires_at TIMESTAMPTZ;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_user_id := OLD.user_id;
        v_credit_type := OLD.credit_type;
    ELSE
        v_user_id := NEW.user_id;
        v_credit_type := NEW.credit_type;
    END IF;

    SELECT COALESCE(SUM(remaining_amount), 0),
           MAX(expires_at)
    INTO v_new_balance, v_new_expires_at
    FROM credit_lots
    WHERE user_id = v_user_id
      AND credit_type = v_credit_type
      AND status = 'active'
      AND expires_at > NOW()
      AND remaining_amount > 0;

    INSERT INTO credit_balances (user_id, credit_type, balance, expires_at, version, updated_at)
    VALUES (v_user_id, v_credit_type, v_new_balance, v_new_expires_at, 1, NOW())
    ON CONFLICT (user_id, credit_type) DO UPDATE SET
        balance = EXCLUDED.balance,
        expires_at = EXCLUDED.expires_at,
        version = credit_balances.version + 1,
        updated_at = NOW();

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS credit_lots_balance_trigger ON credit_lots;
CREATE TRIGGER credit_lots_balance_trigger
    AFTER INSERT OR UPDATE OR DELETE ON credit_lots
    FOR EACH ROW
    EXECUTE FUNCTION update_credit_balance_cache();

-- ============================================================================
-- 6. TRIGGER: Audit-Log für kritische Tabellen
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_old JSONB;
    v_new JSONB;
    v_changed JSONB := '[]'::JSONB;
    v_key TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_new := to_jsonb(NEW);
        INSERT INTO audit_logs (table_name, record_id, action, new_values, created_at)
        VALUES (TG_TABLE_NAME, v_new->>'id', 'INSERT', v_new, NOW());
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
        INSERT INTO audit_logs (table_name, record_id, action, old_values, created_at)
        VALUES (TG_TABLE_NAME, v_old->>'id', 'DELETE', v_old, NOW());
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);

        FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
            IF v_key NOT IN ('id', 'created_at', 'updated_at', 'version') THEN
                IF (v_old->v_key) IS DISTINCT FROM (v_new->v_key) THEN
                    v_changed := v_changed || to_jsonb(v_key);
                END IF;
            END IF;
        END LOOP;

        INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, changed_columns, created_at)
        VALUES (TG_TABLE_NAME, v_new->>'id', 'UPDATE',
            v_old - '{created_at,updated_at,version}'::text[],
            v_new - '{created_at,updated_at,version}'::text[],
            v_changed, NOW()
        );
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_credit_transactions ON credit_transactions;
CREATE TRIGGER audit_credit_transactions
    AFTER INSERT OR UPDATE OR DELETE ON credit_transactions
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS audit_credit_purchases ON credit_purchases;
CREATE TRIGGER audit_credit_purchases
    AFTER INSERT OR UPDATE OR DELETE ON credit_purchases
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS audit_credit_adjustments ON credit_adjustments;
CREATE TRIGGER audit_credit_adjustments
    AFTER INSERT OR UPDATE OR DELETE ON credit_adjustments
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS audit_user_memberships ON user_memberships;
CREATE TRIGGER audit_user_memberships
    AFTER INSERT OR UPDATE OR DELETE ON user_memberships
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS audit_bookings ON bookings;
CREATE TRIGGER audit_bookings
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================================================
-- 7. INITIAL SYNC: alle Session-Counter aktualisieren
-- ============================================================================

UPDATE class_sessions cs SET
    booked_count = COALESCE((SELECT COUNT(*) FROM bookings b WHERE b.session_id = cs.id AND b.status IN ('confirmed', 'attended', 'waitlisted')), 0),
    waitlist_count = COALESCE((SELECT COUNT(*) FROM waitlist_entries w WHERE w.session_id = cs.id AND w.status = 'waiting'), 0);

-- ============================================================================
-- 8. INITIAL SYNC: Credit-Balance-Cache aus Lots berechnen
-- ============================================================================

INSERT INTO credit_balances (user_id, credit_type, balance, expires_at, version, updated_at)
SELECT
    user_id,
    credit_type,
    COALESCE(SUM(remaining_amount), 0),
    MAX(expires_at),
    1,
    NOW()
FROM credit_lots
WHERE status = 'active' AND expires_at > NOW() AND remaining_amount > 0
GROUP BY user_id, credit_type
ON CONFLICT (user_id, credit_type) DO UPDATE SET
    balance = EXCLUDED.balance,
    expires_at = EXCLUDED.expires_at,
    version = credit_balances.version + 1,
    updated_at = NOW();

-- ============================================================================
-- FERTIG
-- ============================================================================
