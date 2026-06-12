-- ============================================================================
-- FIX: Trigger update_credit_balance_cache() - credit_type Typ-Korrektur
-- ============================================================================
-- Problem: v_credit_type war als TEXT deklariert, aber credit_lots.credit_type
--          ist ein PostgreSQL Enum. Der Vergleich "credit_type = v_credit_type"
--          failed mit: "operator does not exist: credit_type = text"
-- Fix:     v_credit_type auf den Enum-Typ "credit_type" ändern.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_credit_balance_cache()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_credit_type credit_type;  -- FIXED: war TEXT, ist jetzt der Enum-Typ
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

-- Trigger existiert bereits, muss nur die Funktion neu laden
-- (wurde oben mit CREATE OR REPLACE bereits erledigt)
