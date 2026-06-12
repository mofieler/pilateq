-- ============================================================================
-- COMPLETE WELCOME JOURNEY VERIFICATION CHECK
-- ============================================================================
-- Run this after adding the preferred_slots column to verify ALL setup

\echo '\n╔════════════════════════════════════════════════════════════════╗'
\echo '║         WELCOME JOURNEY COMPLETE SETUP VERIFICATION            ║'
\echo '╚════════════════════════════════════════════════════════════════╝\n'

-- ─── 1. TABLE: welcome_journey_requests ──────────────────────────────────────
\echo '───────────────────────────────────────────────────────────────────'
\echo '1. TABLE STRUCTURE: welcome_journey_requests'
\echo '───────────────────────────────────────────────────────────────────'
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'welcome_journey_requests'
ORDER BY ordinal_position;

-- Expected columns: id, user_id, status, user_message, offered_session_ids, preferred_slots, created_at, updated_at
\echo '\n✓ EXPECTED: 8 columns including preferred_slots (jsonb)'

-- ─── 2. INDEXES on welcome_journey_requests ──────────────────────────────────
\echo '\n───────────────────────────────────────────────────────────────────'
\echo '2. INDEXES: welcome_journey_requests'
\echo '───────────────────────────────────────────────────────────────────'
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'welcome_journey_requests'
ORDER BY indexname;

-- Expected: welcome_requests_user_id_idx, welcome_requests_status_idx
\echo '\n✓ EXPECTED: 3 indexes (PK + 2 performance indexes)'

-- ─── 3. COLUMN: users.welcome_completed_at ──────────────────────────────────
\echo '\n───────────────────────────────────────────────────────────────────'
\echo '3. COLUMN: users.welcome_completed_at'
\echo '───────────────────────────────────────────────────────────────────'
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'welcome_completed_at';

\echo '\n✓ EXPECTED: 1 row with timestamp with time zone, nullable'

-- ─── 4. COLUMN: class_templates.is_welcome_journey ───────────────────────────
\echo '\n───────────────────────────────────────────────────────────────────'
\echo '4. COLUMN: class_templates.is_welcome_journey'
\echo '───────────────────────────────────────────────────────────────────'
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'class_templates' AND column_name = 'is_welcome_journey';

\echo '\n✓ EXPECTED: 1 row with boolean, NOT NULL, default=false'

-- ─── 5. FOREIGN KEY: welcome_journey_requests → users ───────────────────────
\echo '\n───────────────────────────────────────────────────────────────────'
\echo '5. FOREIGN KEY CONSTRAINT: welcome_journey_requests.user_id → users'
\echo '───────────────────────────────────────────────────────────────────'
SELECT 
  constraint_name,
  constraint_type,
  table_name,
  column_name
FROM information_schema.constraint_column_usage
WHERE table_name = 'welcome_journey_requests' AND column_name = 'user_id'
LIMIT 1;

\echo '\n✓ EXPECTED: 1 FOREIGN KEY constraint'

-- ─── 6. CREDIT PACKAGE: Welcome Journey ──────────────────────────────────────
\echo '\n───────────────────────────────────────────────────────────────────'
\echo '6. CREDIT PACKAGE: Welcome Journey (MUST EXIST)'
\echo '───────────────────────────────────────────────────────────────────'
SELECT 
  "id",
  "name",
  "category",
  "credit_type",
  "credits_amount",
  "price_cents",
  "is_active",
  CASE 
    WHEN "category" = 'session' AND "is_active" = true THEN '✅ OK'
    WHEN "category" != 'session' THEN '❌ WRONG CATEGORY (must be session)'
    WHEN "is_active" = false THEN '⚠️ INACTIVE'
    ELSE '❓ CHECK'
  END AS status
FROM "credit_packages"
WHERE "name" = 'Welcome Journey';

-- Count
SELECT 
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ MISSING - You must create this!'
    WHEN COUNT(*) = 1 THEN '✅ EXISTS'
    ELSE '❌ DUPLICATE - Multiple found'
  END as status
FROM "credit_packages"
WHERE "name" = 'Welcome Journey';

\echo '\n⚠️ ACTION NEEDED IF 0 ROWS: Create Welcome Journey credit package'
\echo '   INSERT INTO credit_packages (name, category, credit_type, credits_amount, price_cents, currency, is_active, sort_order)'
\echo '   VALUES (''Welcome Journey'', ''session'', ''private_session'', 1, 4500, ''eur'', true, 0);'

-- ─── 7. CLASS TEMPLATE: Welcome Journey ──────────────────────────────────────
\echo '\n───────────────────────────────────────────────────────────────────'
\echo '7. CLASS TEMPLATE: Welcome Journey (MUST EXIST & ACTIVE)'
\echo '───────────────────────────────────────────────────────────────────'
SELECT 
  "id",
  "name",
  "class_type",
  "credit_type",
  "duration_minutes",
  "max_capacity",
  "is_active",
  CASE 
    WHEN "is_active" = true THEN '✅ OK'
    ELSE '⚠️ INACTIVE'
  END as status
FROM "class_templates"
WHERE "is_welcome_journey" = true
ORDER BY "is_active" DESC, "created_at" DESC;

-- Count
SELECT 
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ MISSING - You must create at least 1!'
    WHEN COUNT(*) > 0 THEN '✅ EXISTS'
  END as status
FROM "class_templates"
WHERE "is_welcome_journey" = true AND "is_active" = true;

\echo '\n⚠️ ACTION NEEDED IF 0 ROWS: Create a Welcome Journey class template'
\echo '   INSERT INTO class_templates (name, class_type, credit_type, duration_minutes, max_capacity, is_welcome_journey, is_active)'
\echo '   VALUES (''Welcome Journey Intro'', ''1-on-1'', ''private_session'', 120, 1, true, true);'

-- ─── 8. SCHEDULED SESSIONS: Welcome Journey in next 7 days ───────────────────
\echo '\n───────────────────────────────────────────────────────────────────'
\echo '8. SCHEDULED SESSIONS: Welcome Journey (next 7 days)'
\echo '───────────────────────────────────────────────────────────────────'
SELECT 
  cs."id",
  ct."name" as template_name,
  cs."starts_at",
  cs."ends_at",
  cs."booked_count",
  cs."max_capacity",
  cs."status",
  CASE 
    WHEN cs."status" = 'scheduled' THEN '✅ AVAILABLE'
    ELSE '⚠️ ' || cs."status"
  END as session_status
FROM "class_sessions" cs
JOIN "class_templates" ct ON cs."template_id" = ct."id"
WHERE ct."is_welcome_journey" = true
  AND cs."starts_at" > NOW()
  AND cs."starts_at" < NOW() + INTERVAL '7 days'
  AND cs."status" != 'cancelled'
ORDER BY cs."starts_at" ASC;

-- Count
SELECT 
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️ NO SESSIONS - Admin needs to schedule some'
    WHEN COUNT(*) > 0 THEN '✅ SESSIONS READY'
  END as status
FROM "class_sessions" cs
JOIN "class_templates" ct ON cs."template_id" = ct."id"
WHERE ct."is_welcome_journey" = true
  AND cs."starts_at" > NOW()
  AND cs."status" != 'cancelled';

\echo '\n⚠️ ACTION NEEDED IF 0 ROWS: Schedule at least 1 Welcome Journey session'
\echo '   (Use admin panel or SQL INSERT into class_sessions)'

-- ─── 9. DATA INTEGRITY: Unwelcomed users with non-welcome bookings ────────────
\echo '\n───────────────────────────────────────────────────────────────────'
\echo '9. DATA INTEGRITY: Unwelcomed users with regular bookings (INCONSISTENT!)'
\echo '───────────────────────────────────────────────────────────────────'
SELECT 
  u."id",
  u."name",
  u."email",
  COUNT(b."id") as non_welcome_bookings,
  '❌ INCONSISTENT' as warning
FROM "users" u
JOIN "bookings" b ON u."id" = b."user_id"
JOIN "class_sessions" cs ON b."session_id" = cs."id"
JOIN "class_templates" ct ON cs."template_id" = ct."id"
WHERE u."welcome_completed_at" IS NULL
  AND u."deleted_at" IS NULL
  AND ct."is_welcome_journey" = false
  AND b."status" IN ('confirmed', 'attended')
GROUP BY u."id", u."name", u."email"
ORDER BY non_welcome_bookings DESC;

SELECT 
  COUNT(DISTINCT u."id") as problematic_users,
  CASE 
    WHEN COUNT(DISTINCT u."id") = 0 THEN '✅ OK - No data conflicts'
    ELSE '❌ CONFLICT - These users need fixing'
  END as status
FROM "users" u
JOIN "bookings" b ON u."id" = b."user_id"
JOIN "class_sessions" cs ON b."session_id" = cs."id"
JOIN "class_templates" ct ON cs."template_id" = ct."id"
WHERE u."welcome_completed_at" IS NULL
  AND u."deleted_at" IS NULL
  AND ct."is_welcome_journey" = false
  AND b."status" IN ('confirmed', 'attended');

\echo '\n⚠️ ACTION IF CONFLICTS: Run: UPDATE "users" SET "welcome_completed_at" = NOW() WHERE "welcome_completed_at" IS NULL;'

-- ─── 10. WELCOME REQUESTS: Current status ───────────────────────────────────
\echo '\n───────────────────────────────────────────────────────────────────'
\echo '10. WELCOME REQUESTS: Current (if any)'
\echo '───────────────────────────────────────────────────────────────────'
SELECT 
  wjr."id",
  wjr."status",
  u."name",
  u."email",
  wjr."user_message",
  array_length(wjr."offered_session_ids", 1) as offered_count,
  array_length(wjr."preferred_slots", 1) as preferred_count,
  wjr."created_at"
FROM "welcome_journey_requests" wjr
JOIN "users" u ON wjr."user_id" = u."id"
ORDER BY wjr."created_at" DESC
LIMIT 10;

\echo '\n✅ If table is empty, that''s fine - no requests yet'

-- ─── SUMMARY ──────────────────────────────────────────────────────────────────
\echo '\n╔════════════════════════════════════════════════════════════════╗'
\echo '║                         SETUP CHECKLIST                         ║'
\echo '╚════════════════════════════════════════════════════════════════╝\n'
\echo 'Run this in your VPS psql to validate. Expected results:'
\echo ''
\echo '✅ V1: welcome_journey_requests has 8 columns (including preferred_slots)'
\echo '✅ V2: 3 indexes present'
\echo '✅ V3: users.welcome_completed_at exists (nullable timestamp)'
\echo '✅ V4: class_templates.is_welcome_journey exists (boolean, default false)'
\echo '✅ V5: FK constraint exists'
\echo '✅ V6: Exactly 1 Welcome Journey credit package exists (category=session, active)'
\echo '✅ V7: At least 1 active Welcome Journey class template exists'
\echo '✅ V8: At least 1 scheduled Welcome Journey session exists'
\echo '✅ V9: No unwelcomed users with non-welcome bookings (data integrity OK)'
\echo '✅ V10: welcome_journey_requests can be queried'
\echo ''
\echo 'If any ❌ or ⚠️ appears, follow the action instructions above.'
\echo ''
