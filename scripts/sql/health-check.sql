-- ============================================================================
-- PILATES OS — Post-Migration Health Check
-- Run: psql "$DATABASE_URL" -f scripts/sql/health-check.sql
-- ============================================================================

\echo '=== PILATES OS DB HEALTH CHECK ==='
\echo ''

-- 1. Tabellen
\echo '--- TABLES ---'
SELECT 
    schemaname, 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'users', 'accounts', 'sessions', 'verification_tokens',
    'instructors', 'class_templates', 'class_sessions',
    'bookings', 'waitlist_entries',
    'credit_packages', 'credit_balances', 'credit_lots', 'credit_transactions',
    'credit_purchases', 'credit_adjustments',
    'membership_plans', 'user_memberships',
    'promo_codes', 'promo_usages',
    'calendar_connections', 'external_calendar_blocks',
    'invoice_reminders', 'duo_invites',
    'cancellation_mercy_uses', 'welcome_journey_requests',
    'rate_limits', 'user_stats', 'audit_logs', '__drizzle_migrations'
  )
ORDER BY tablename;

\echo ''
\echo '--- ENUMS ---'
SELECT typname AS enum_name, 
       array_agg(enumlabel ORDER BY enumsortorder) AS values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('credit_lot_status', 'membership_status', 'audit_action')
GROUP BY typname;

\echo ''
\echo '--- NEW COLUMNS (version, membership_id, adjustment_id) ---'
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'users' AND column_name = 'version')
    OR (table_name = 'bookings' AND column_name = 'version')
    OR (table_name = 'class_sessions' AND column_name = 'version')
    OR (table_name = 'credit_balances' AND column_name = 'version')
    OR (table_name = 'credit_lots' AND column_name IN ('membership_id', 'adjustment_id'))
  )
ORDER BY table_name, column_name;

\echo ''
\echo '--- CHECK CONSTRAINTS ---'
SELECT conrelid::regclass AS table_name, conname AS constraint_name
FROM pg_constraint
WHERE contype = 'c'
  AND conrelid::regclass::text IN (
    'credit_packages', 'credit_balances', 'credit_purchases', 'credit_lots',
    'membership_plans', 'user_memberships', 'bookings',
    'class_templates', 'class_sessions', 'promo_codes', 'rate_limits',
    'user_stats', 'users'
  )
ORDER BY table_name, constraint_name;

\echo ''
\echo '--- UNIQUE CONSTRAINTS ---'
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef LIKE '%UNIQUE%'
  AND tablename IN ('credit_packages', 'credit_purchases')
ORDER BY tablename;

\echo ''
\echo '--- TRIGGERS ---'
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    proname AS function_name,
    CASE tgtype & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
    CASE 
        WHEN tgtype & 4 = 4 THEN 'INSERT'
        WHEN tgtype & 8 = 8 THEN 'DELETE'
        WHEN tgtype & 16 = 16 THEN 'UPDATE'
        ELSE 'OTHER'
    END AS event
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE NOT tgisinternal
  AND tgrelid::regclass::text IN (
    'user_stats', 'bookings', 'waitlist_entries', 'credit_lots',
    'credit_transactions', 'credit_purchases', 'credit_adjustments',
    'user_memberships', 'bookings'
  )
ORDER BY tgrelid::regclass::text, tgname;

\echo ''
\echo '--- TRIGGER FUNCTIONS ---'
SELECT proname AS function_name
FROM pg_proc
WHERE proname IN (
    'sync_user_stats_to_users',
    'update_session_counters',
    'update_credit_balance_cache',
    'audit_log_trigger'
);

\echo ''
\echo '--- MIGRATION JOURNAL ---'
SELECT hash, created_at FROM __drizzle_migrations ORDER BY id;

\echo ''
\echo '--- USER STATS MIGRATION ---'
SELECT 
    (SELECT COUNT(*) FROM user_stats) AS user_stats_count,
    (SELECT COUNT(*) FROM users WHERE total_classes_attended > 0 OR current_streak > 0 OR longest_streak > 0) AS users_with_gamification,
    CASE 
        WHEN (SELECT COUNT(*) FROM user_stats) = (SELECT COUNT(*) FROM users WHERE total_classes_attended > 0 OR current_streak > 0 OR longest_streak > 0)
        THEN 'OK' ELSE 'MISMATCH'
    END AS status;

\echo ''
\echo '--- VERSION COLUMNS POPULATED ---'
SELECT 
    'users' AS table_name, COUNT(*) FILTER (WHERE version = 0) AS version_zero_count, COUNT(*) AS total
FROM users
UNION ALL
SELECT 'bookings', COUNT(*) FILTER (WHERE version = 0), COUNT(*) FROM bookings
UNION ALL
SELECT 'class_sessions', COUNT(*) FILTER (WHERE version = 0), COUNT(*) FROM class_sessions
UNION ALL
SELECT 'credit_balances', COUNT(*) FILTER (WHERE version = 0), COUNT(*) FROM credit_balances;

\echo ''
\echo '--- SESSION COUNTER SYNC CHECK (sample: drifted counters) ---'
SELECT 
    cs.id AS session_id,
    cs.booked_count AS cached_booked,
    (SELECT COUNT(*) FROM bookings b WHERE b.session_id = cs.id AND b.status IN ('confirmed', 'attended', 'waitlisted')) AS actual_booked,
    cs.waitlist_count AS cached_waitlist,
    (SELECT COUNT(*) FROM waitlist_entries w WHERE w.session_id = cs.id AND w.status = 'waiting') AS actual_waitlist
FROM class_sessions cs
WHERE cs.booked_count != COALESCE((SELECT COUNT(*) FROM bookings b WHERE b.session_id = cs.id AND b.status IN ('confirmed', 'attended', 'waitlisted')), 0)
   OR cs.waitlist_count != COALESCE((SELECT COUNT(*) FROM waitlist_entries w WHERE w.session_id = cs.id AND w.status = 'waiting'), 0)
LIMIT 10;

\echo ''
\echo '--- CREDIT BALANCE CACHE CHECK (sample: drifted balances) ---'
WITH lot_sums AS (
    SELECT 
        user_id, credit_type,
        COALESCE(SUM(remaining_amount), 0) AS actual_balance,
        MAX(expires_at) AS actual_expires
    FROM credit_lots
    WHERE status = 'active' AND expires_at > NOW() AND remaining_amount > 0
    GROUP BY user_id, credit_type
)
SELECT 
    cb.user_id,
    cb.credit_type,
    cb.balance AS cached_balance,
    ls.actual_balance AS actual_balance,
    cb.expires_at AS cached_expires,
    ls.actual_expires AS actual_expires
FROM credit_balances cb
LEFT JOIN lot_sums ls ON cb.user_id = ls.user_id AND cb.credit_type = ls.credit_type
WHERE cb.balance != COALESCE(ls.actual_balance, 0)
   OR (cb.expires_at IS DISTINCT FROM ls.actual_expires)
LIMIT 10;

\echo ''
\echo '=== HEALTH CHECK COMPLETE ==='
