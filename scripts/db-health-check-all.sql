-- ═══════════════════════════════════════════════════════════════════════════════
-- PILATES OS — COMPREHENSIVE DATABASE HEALTH CHECK
-- Run this after any deployment to verify schema + data integrity
-- ═══════════════════════════════════════════════════════════════════════════════

\echo ''
\echo '╔═══════════════════════════════════════════════════════════════════════════════╗'
\echo '║                    PILATES OS — DB HEALTH CHECK REPORT                        ║'
\echo '╚═══════════════════════════════════════════════════════════════════════════════╝'
\echo ''

-- ─── 1. VERIFY CORE TABLES EXIST ──────────────────────────────────────────────
\echo '─── 1. CORE TABLES ─────────────────────────────────────────────────────────────'

SELECT 
  schemaname,
  tablename,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables t 
    WHERE t.table_schema = schemaname AND t.table_name = tablename
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END AS status
FROM (VALUES 
  ('public','users'),
  ('public','credit_packages'),
  ('public','credit_purchases'),
  ('public','credit_lots'),
  ('public','class_sessions'),
  ('public','class_templates'),
  ('public','bookings'),
  ('public','instructors'),
  ('public','membership_plans'),
  ('public','welcome_journey_requests')
) AS v(schemaname, tablename);

-- ─── 2. VERIFY USERS TABLE COLUMNS (for avatar feature) ───────────────────────
\echo ''
\echo '─── 2. USERS TABLE COLUMNS (Avatar Support) ────────────────────────────────────'

SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name IN ('id', 'email', 'name', 'avatar_url', 'image', 'role', 'phone', 'welcome_completed_at', 'profile_completed')
ORDER BY ordinal_position;

-- ─── 3. VERIFY CREDIT_LOTS HAS WARNING COLUMNS (production fix) ───────────────
\echo ''
\echo '─── 3. CREDIT_LOTS WARNING COLUMNS (Production Outage Fix) ─────────────────────'

SELECT 
  column_name,
  data_type,
  column_default,
  CASE 
    WHEN column_name IN ('warning_50_sent', 'warning_70_sent', 'warning_expiry_sent') 
    THEN '✓ CRITICAL FIX APPLIED' 
    ELSE '' 
  END AS note
FROM information_schema.columns
WHERE table_name = 'credit_lots'
ORDER BY ordinal_position;

-- ─── 4. VERIFY CREDIT PACKAGES — PRICES & VALIDITY ────────────────────────────
\echo ''
\echo '─── 4. CREDIT PACKAGES — Prices & Validity ─────────────────────────────────────'

WITH expected AS (
  SELECT * FROM (VALUES 
    ('Welcome Journey',       1,   12000, 52, 'session', 'session'),
    ('Essence',              15,   11500,  5, 'credit',  'pass'),
    ('Empower',              30,   22000,  7, 'credit',  'pass'),
    ('Bloom',                50,   34000,  9, 'credit',  'pass'),
    ('Return to Life',      100,   66000, 12, 'credit',  'pass')
  ) AS t(name, credits, price, weeks, cat, ctype)
)
SELECT 
  e.name AS expected_name,
  cp.name AS db_name,
  e.credits AS expected_credits,
  cp.credits_amount AS db_credits,
  e.price AS expected_price_cents,
  cp.price_cents AS db_price,
  e.weeks AS expected_weeks,
  cp.validity_weeks AS db_weeks,
  e.ctype AS expected_credit_type,
  cp.credit_type AS db_credit_type,
  CASE 
    WHEN cp.id IS NULL THEN '✗ MISSING'
    WHEN cp.credits_amount != e.credits THEN '✗ WRONG CREDITS'
    WHEN cp.price_cents != e.price THEN '✗ WRONG PRICE'
    WHEN cp.validity_weeks != e.weeks THEN '✗ WRONG VALIDITY'
    WHEN cp.credit_type != e.ctype THEN '✗ WRONG TYPE'
    ELSE '✓ OK'
  END AS status
FROM expected e
LEFT JOIN credit_packages cp ON LOWER(cp.name) = LOWER(e.name)
ORDER BY e.price;

-- ─── 5. VERIFY MEMBERSHIP PLANS ───────────────────────────────────────────────
\echo ''
\echo '─── 5. MEMBERSHIP PLANS ────────────────────────────────────────────────────────'

WITH expected_memberships AS (
  SELECT * FROM (VALUES 
    ('1x Week',  14500),
    ('2x Week',  24500)
  ) AS t(name, price)
)
SELECT 
  e.name AS expected_name,
  mp.name AS db_name,
  e.price AS expected_price_cents,
  mp.price_cents AS db_price,
  mp.credits_per_week,
  CASE 
    WHEN mp.id IS NULL THEN '✗ MISSING'
    WHEN mp.price_cents != e.price THEN '✗ WRONG PRICE'
    ELSE '✓ OK'
  END AS status
FROM expected_memberships e
LEFT JOIN membership_plans mp ON LOWER(mp.name) = LOWER(e.name)
ORDER BY e.price;

-- ─── 6. VERIFY YOGA EXEMPTION POLICY (Welcome Journey not required for yoga) ──
\echo ''
\echo '─── 6. YOGA EXEMPTION POLICY ───────────────────────────────────────────────────'

SELECT 
  name,
  class_type,
  is_welcome_journey,
  CASE 
    WHEN class_type = 'yoga' AND is_welcome_journey = false THEN '✓ YOGA EXEMPT (correct)'
    WHEN class_type != 'yoga' AND is_welcome_journey = false THEN '  Normal class'
    WHEN is_welcome_journey = true THEN '  WJ class'
    ELSE '✗ CHECK NEEDED'
  END AS policy_check
FROM class_templates
WHERE is_active = true
ORDER BY class_type;

-- ─── 7. VERIFY ALL USERS CAN BOOK YOGA (no WJ required) ───────────────────────
\echo ''
\echo '─── 7. USER WELCOME JOURNEY STATUS ─────────────────────────────────────────────'

SELECT 
  COUNT(*) FILTER (WHERE welcome_completed_at IS NULL) AS users_without_wj,
  COUNT(*) FILTER (WHERE welcome_completed_at IS NOT NULL) AS users_with_wj,
  COUNT(*) AS total_users
FROM users
WHERE deleted_at IS NULL;

-- ─── 8. CHECK FOR DUO/Private SESSION COSTS ───────────────────────────────────
\echo ''
\echo '─── 8. DUO / PRIVATE SESSION CREDIT COSTS ──────────────────────────────────────'

SELECT 
  name,
  class_type,
  credit_cost,
  credit_type,
  CASE 
    WHEN class_type LIKE '%duo%' AND credit_cost = 1 AND credit_type = 'session' THEN '✓ DUO = 1 session credit (Reformer Duo)'
    WHEN class_type LIKE '%duo%' AND credit_cost = 3 AND credit_type = 'session' THEN '✓ DUO = 3 session credits (Mat Duo)'
    WHEN class_type LIKE '%duo%' AND credit_cost = 5 AND credit_type = 'pass' THEN '✓ GROUP DUO = 5 pass credits'
    WHEN class_type LIKE '%private%' THEN '✓ Private class'
    ELSE '  —'
  END AS note
FROM class_templates
WHERE is_active = true 
  AND (class_type LIKE '%duo%' OR class_type LIKE '%private%')
ORDER BY class_type;

-- ─── 9. ACTIVE CREDIT LOTS INVENTORY ──────────────────────────────────────────
\echo ''
\echo '─── 9. ACTIVE CREDIT LOTS ──────────────────────────────────────────────────────'

SELECT 
  cp.name AS package_name,
  COUNT(cl.id) AS active_lots,
  SUM(cl.remaining_amount) AS total_remaining_credits,
  MIN(cl.expires_at) AS earliest_expiry,
  MAX(cl.expires_at) AS latest_expiry
FROM credit_lots cl
JOIN credit_purchases cpur ON cpur.id = cl.purchase_id
JOIN credit_packages cp ON cp.id = cpur.package_id
WHERE cl.status IN ('active', 'at_risk')
GROUP BY cp.name
ORDER BY cp.name;

-- ─── 10. CHECK FOR ORPHANED / INCONSISTENT DATA ───────────────────────────────
\echo ''
\echo '─── 10. DATA INTEGRITY CHECKS ──────────────────────────────────────────────────'

-- Bookings without valid users
SELECT 'Bookings with deleted users' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN '✓ CLEAN' ELSE '✗ FOUND' END AS status
FROM bookings b
LEFT JOIN users u ON u.id = b.user_id
WHERE b.status = 'confirmed' AND (u.deleted_at IS NOT NULL OR u.id IS NULL)

UNION ALL

-- Confirmed bookings for cancelled sessions
SELECT 'Confirmed bookings for cancelled sessions' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN '✓ CLEAN' ELSE '✗ FOUND' END AS status
FROM bookings b
JOIN class_sessions cs ON cs.id = b.session_id
WHERE b.status = 'confirmed' AND cs.status = 'cancelled'

UNION ALL

-- Negative credit balances
SELECT 'Negative credit lot balances' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN '✓ CLEAN' ELSE '✗ FOUND' END AS status
FROM credit_lots
WHERE remaining_amount < 0

UNION ALL

-- Overbooked sessions
SELECT 'Overbooked sessions' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN '✓ CLEAN' ELSE '✗ FOUND' END AS status
FROM class_sessions cs
JOIN class_templates ct ON ct.id = cs.template_id
WHERE cs.booked_count > cs.max_capacity AND cs.status = 'scheduled'

UNION ALL

-- Users with role inconsistency
SELECT 'Users with invalid roles' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN '✓ CLEAN' ELSE '✗ FOUND' END AS status
FROM users
WHERE role NOT IN ('student', 'instructor', 'admin') AND deleted_at IS NULL;

-- ─── 11. CHECK DAILY BOOKING STATS ────────────────────────────────────────────
\echo ''
\echo '─── 11. TODAY''S BOOKING SNAPSHOT ──────────────────────────────────────────────'

SELECT 
  ct.name AS class_name,
  ct.class_type,
  cs.starts_at,
  cs.max_capacity,
  cs.booked_count,
  cs.max_capacity - cs.booked_count AS spots_left,
  CASE 
    WHEN cs.booked_count >= cs.max_capacity THEN 'FULL'
    WHEN cs.booked_count >= cs.max_capacity * 0.8 THEN 'Almost full'
    ELSE 'Open'
  END AS status
FROM class_sessions cs
JOIN class_templates ct ON ct.id = cs.template_id
WHERE cs.status = 'scheduled'
  AND cs.starts_at >= CURRENT_DATE
  AND cs.starts_at < CURRENT_DATE + INTERVAL '1 day'
ORDER BY cs.starts_at;

\echo ''
\echo '╔═══════════════════════════════════════════════════════════════════════════════╗'
\echo '║                          HEALTH CHECK COMPLETE                                ║'
\echo '╚═══════════════════════════════════════════════════════════════════════════════╝'
\echo ''
