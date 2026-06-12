-- ============================================================================
-- PILATES OS — User & Gamification Diagnosis
-- ============================================================================

\echo '========== USER DIAGNOSIS =========='

\echo ''
\echo '--- 1. ALL USERS with gamification fields ---'
SELECT 
    u.id,
    u.name,
    u.email,
    u.total_classes_attended,
    u.current_streak,
    u.longest_streak,
    u.streak_last_updated_at,
    u.version,
    u.created_at
FROM users u
ORDER BY u.created_at DESC;

\echo ''
\echo '--- 2. USER_STATS entries ---'
SELECT 
    us.user_id,
    u.name,
    us.total_classes_attended,
    us.current_streak,
    us.longest_streak,
    us.streak_last_updated_at,
    us.version,
    us.created_at
FROM user_stats us
LEFT JOIN users u ON us.user_id = u.id
ORDER BY us.created_at DESC;

\echo ''
\echo '--- 3. USERS with attended bookings (ground truth for classes_attended) ---'
SELECT 
    b.user_id,
    u.name,
    COUNT(*) AS actual_attended_classes
FROM bookings b
JOIN users u ON b.user_id = u.id
WHERE b.status = 'attended'
GROUP BY b.user_id, u.name
ORDER BY actual_attended_classes DESC;

\echo ''
\echo '--- 4. USERS with confirmed/active bookings (ground truth for engagement) ---'
SELECT 
    b.user_id,
    u.name,
    COUNT(*) AS total_confirmed_bookings
FROM bookings b
JOIN users u ON b.user_id = u.id
WHERE b.status IN ('confirmed', 'attended')
GROUP BY b.user_id, u.name
ORDER BY total_confirmed_bookings DESC;

\echo ''
\echo '--- 5. USERS missing in user_stats (should be 0) ---'
SELECT u.id, u.name, u.email
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM user_stats us WHERE us.user_id = u.id)
  AND (u.total_classes_attended > 0 OR u.current_streak > 0 OR u.longest_streak > 0);

\echo ''
\echo '--- 6. USER_STATS that do NOT match users table ---'
SELECT 
    u.id,
    u.name,
    u.total_classes_attended AS u_total,
    us.total_classes_attended AS us_total,
    u.current_streak AS u_streak,
    us.current_streak AS us_streak,
    u.longest_streak AS u_longest,
    us.longest_streak AS us_longest
FROM users u
JOIN user_stats us ON u.id = us.user_id
WHERE u.total_classes_attended != us.total_classes_attended
   OR u.current_streak != us.current_streak
   OR u.longest_streak != us.longest_streak;

\echo ''
\echo '--- 7. ALL BOOKINGS per user ---'
SELECT 
    b.user_id,
    u.name,
    b.status,
    COUNT(*) AS cnt
FROM bookings b
JOIN users u ON b.user_id = u.id
GROUP BY b.user_id, u.name, b.status
ORDER BY b.user_id, b.status;

\echo ''
\echo '========== DIAGNOSIS COMPLETE =========='
