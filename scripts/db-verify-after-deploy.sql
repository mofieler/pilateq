-- ═══════════════════════════════════════════════════════════════════════════════
-- QUICK POST-DEPLOYMENT VERIFICATION (run on VPS)
-- Run: docker exec -i <postgres-container> psql -U <user> -d <db> < scripts/db-verify-after-deploy.sql
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT '=== PILATES OS POST-DEPLOY CHECK ===' AS section;

-- 1. Schema columns for avatar feature
SELECT '1. Users table has avatar columns:' AS check_item,
       CASE WHEN COUNT(*) = 2 THEN '✓ PASS' ELSE '✗ FAIL' END AS result
FROM information_schema.columns
WHERE table_name = 'users' AND column_name IN ('avatar_url', 'image');

-- 2. Credit lots warning columns (critical production fix)
SELECT '2. Credit lots has warning columns:' AS check_item,
       CASE WHEN COUNT(*) = 3 THEN '✓ PASS' ELSE '✗ FAIL' END AS result
FROM information_schema.columns
WHERE table_name = 'credit_lots' 
  AND column_name IN ('warning_50_sent', 'warning_70_sent', 'warning_expiry_sent');

-- 3. Package prices match studio pricing
SELECT '3. Package prices correct:' AS check_item,
       CASE WHEN COUNT(*) = 5 THEN '✓ PASS' ELSE '✗ FAIL' END AS result
FROM credit_packages
WHERE is_active = true
  AND (name, credits_amount, price_cents, validity_weeks) IN (
    ('Welcome Journey', 1, 12000, 52),
    ('Essence', 15, 11500, 5),
    ('Empower', 30, 22000, 7),
    ('Bloom', 50, 34000, 9),
    ('Return to Life', 100, 66000, 12)
  );

-- 4. Membership plans exist
SELECT '4. Membership plans exist:' AS check_item,
       CASE WHEN COUNT(*) = 2 THEN '✓ PASS' ELSE '✗ FAIL' END AS result
FROM membership_plans
WHERE name IN ('1x Week', '2x Week');

-- 5. Yoga classes don't require Welcome Journey
SELECT '5. Yoga exemption configured:' AS check_item,
       CASE WHEN COUNT(*) >= 1 THEN '✓ PASS' ELSE '✗ FAIL' END AS result
FROM class_templates
WHERE class_type = 'yoga' AND is_welcome_journey = false AND is_active = true;

-- 6. No data integrity issues
SELECT '6. No orphaned bookings:' AS check_item,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END AS result
FROM bookings b
LEFT JOIN users u ON u.id = b.user_id
WHERE b.status = 'confirmed' AND (u.deleted_at IS NOT NULL OR u.id IS NULL);

SELECT '7. No overbooked sessions:' AS check_item,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END AS result
FROM class_sessions
WHERE status = 'scheduled' AND booked_count > max_capacity;

SELECT '8. No negative credit balances:' AS check_item,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END AS result
FROM credit_lots WHERE remaining_amount < 0;

-- Summary counts
SELECT '=== SUMMARY ===' AS section;
SELECT 
  (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS total_users,
  (SELECT COUNT(*) FROM users WHERE welcome_completed_at IS NULL AND deleted_at IS NULL) AS users_without_wj,
  (SELECT COUNT(*) FROM class_sessions WHERE status = 'scheduled' AND starts_at >= CURRENT_DATE) AS upcoming_sessions,
  (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed') AS total_confirmed_bookings;
