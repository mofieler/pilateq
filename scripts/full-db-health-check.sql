-- ============================================================================
-- FULL DB HEALTH CHECK — PilatesOS Production VPS
-- ============================================================================
-- Run this after all recent migrations. Checks for errors, inconsistencies,
-- missing data, and orphaned records across the entire schema.
--
-- GREEN = expected / healthy
-- RED   = investigate & fix

\set ON_ERROR_STOP off

-- ============================================================================
-- 1. WELCOME JOURNEY SYSTEM
-- ============================================================================

\echo '\n========== 1. WELCOME JOURNEY SYSTEM =========='

\echo '\n--- 1a. welcome_journey_requests table exists ---'
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'welcome_journey_requests'
  ) THEN '✅ TABLE EXISTS'
  ELSE '❌ TABLE MISSING — RUN MIGRATION'
  END AS status;

\echo '\n--- 1b. welcome_journey_requests structure ---'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'welcome_journey_requests'
ORDER BY ordinal_position;

\echo '\n--- 1c. Indexes on welcome_journey_requests ---'
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'welcome_journey_requests';

\echo '\n--- 1d. Users welcome status counts ---'
SELECT
  COUNT(*) FILTER (WHERE "welcome_completed_at" IS NOT NULL) AS welcomed,
  COUNT(*) FILTER (WHERE "welcome_completed_at" IS NULL)     AS unwelcomed,
  COUNT(*) AS total
FROM "users" WHERE "deleted_at" IS NULL;

\echo '\n--- 1e. Unwelcomed users with existing non-welcome bookings (INCONSISTENT) ---'
SELECT
  u."id", u."name", u."email",
  COUNT(b."id") AS non_welcome_bookings
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

\echo '\n--- 1f. Welcome Journey credit package ---'
SELECT
  "id", "name", "category", "credit_type", "credits_amount", "price_cents", "is_active",
  CASE
    WHEN "name" = 'Welcome Journey' AND "category" = 'session' AND "is_active" = true THEN '✅ OK'
    WHEN "name" = 'Welcome Journey' AND "category" != 'session' THEN '❌ WRONG CATEGORY'
    WHEN "name" = 'Welcome Journey' AND "is_active" = false THEN '⚠️ INACTIVE'
    ELSE '❌ MISSING'
  END AS status
FROM "credit_packages" WHERE "name" = 'Welcome Journey';

\echo '\n--- 1g. Welcome Journey class templates ---'
SELECT
  "id", "name", "class_type", "credit_type", "credit_cost", "is_active",
  CASE WHEN "is_active" = true THEN '✅ OK' ELSE '⚠️ INACTIVE' END AS status
FROM "class_templates"
WHERE "is_welcome_journey" = true;

\echo '\n--- 1h. Upcoming Welcome Journey sessions (next 14 days) ---'
SELECT
  cs."id", ct."name" AS template_name, cs."starts_at",
  cs."max_capacity", cs."booked_count",
  (cs."max_capacity" - cs."booked_count") AS spots_left
FROM "class_sessions" cs
JOIN "class_templates" ct ON cs."template_id" = ct."id"
WHERE ct."is_welcome_journey" = true
  AND cs."starts_at" > NOW()
  AND cs."starts_at" < NOW() + INTERVAL '14 days'
  AND cs."status" = 'scheduled'
ORDER BY cs."starts_at";

\echo '\n--- 1i. Pending welcome requests ---'
SELECT
  wjr."id", wjr."status", u."name", u."email", wjr."created_at"
FROM "welcome_journey_requests" wjr
JOIN "users" u ON wjr."user_id" = u."id"
WHERE wjr."status" = 'pending'
ORDER BY wjr."created_at" DESC;

\echo '\n--- 1j. Orphaned welcome requests (user deleted) ---'
SELECT COUNT(*) AS orphaned
FROM "welcome_journey_requests" wjr
LEFT JOIN "users" u ON wjr."user_id" = u."id"
WHERE u."id" IS NULL;


-- ============================================================================
-- 2. CREDIT PACKAGES (Session + Pass)
-- ============================================================================

\echo '\n========== 2. CREDIT PACKAGES =========='

\echo '\n--- 2a. Session packages: credits should equal session count ---'
SELECT
  "id", "name", "credits_amount" AS current_credits,
  COALESCE(
    (regexp_match("name", '(\d+)\s*(session|Session|SESSION|Kurs|kurs)'))[1]::int,
    (regexp_match("name", '(\d+)'))[1]::int,
    "credits_amount"
  ) AS expected_credits,
  CASE
    WHEN "credits_amount" = COALESCE(
      (regexp_match("name", '(\d+)\s*(session|Session|SESSION|Kurs|kurs)'))[1]::int,
      (regexp_match("name", '(\d+)'))[1]::int,
      "credits_amount"
    ) THEN '✅ OK'
    ELSE '❌ MISMATCH'
  END AS status
FROM "credit_packages"
WHERE "category" = 'session'
ORDER BY "name";

\echo '\n--- 2b. Duplicate active package names ---'
SELECT "name", COUNT(*) AS cnt
FROM "credit_packages"
WHERE "is_active" = true
GROUP BY "name"
HAVING COUNT(*) > 1;

\echo '\n--- 2c. Packages with zero/negative credits ---'
SELECT "id", "name", "credits_amount", "category"
FROM "credit_packages"
WHERE "credits_amount" <= 0;

\echo '\n--- 2d. Packages with zero/negative price ---'
SELECT "id", "name", "price_cents", "category"
FROM "credit_packages"
WHERE "price_cents" <= 0;

\echo '\n--- 2e. Packages with zero validity ---'
SELECT "id", "name", "validity_days", "validity_weeks"
FROM "credit_packages"
WHERE "validity_days" <= 0 OR "validity_weeks" <= 0;

\echo '\n--- 2f. category vs credit_type consistency ---'
SELECT "id", "name", "category", "credit_type",
  CASE
    WHEN "category" = 'session' AND "credit_type" = 'session' THEN '✅ OK'
    WHEN "category" = 'credit' AND "credit_type" = 'pass' THEN '✅ OK'
    ELSE '❌ MISMATCH'
  END AS status
FROM "credit_packages"
WHERE ("category" = 'session' AND "credit_type" != 'session')
   OR ("category" = 'credit' AND "credit_type" != 'pass');

\echo '\n--- 2g. Duo packages MUST be category=session ---'
SELECT
  "id", "name", "category", "credit_type", "credits_amount", "is_active",
  CASE
    WHEN "category" = 'session' AND "credit_type" = 'session' THEN '✅ OK'
    ELSE '❌ WRONG: duo is session, not credit'
  END AS status
FROM "credit_packages"
WHERE "name" ILIKE '%duo%'
ORDER BY "name";


-- ============================================================================
-- 3. CLASS TEMPLATES & SESSIONS
-- ============================================================================

\echo '\n========== 3. CLASS TEMPLATES & SESSIONS =========='

\echo '\n--- 3a. Templates with zero capacity ---'
SELECT "id", "name", "max_capacity", "is_active"
FROM "class_templates"
WHERE "max_capacity" <= 0;

\echo '\n--- 3b. Templates with zero credit cost ---'
SELECT "id", "name", "credit_cost", "credit_type"
FROM "class_templates"
WHERE "credit_cost" <= 0;

\echo '\n--- 3c. Inactive templates with future sessions ---'
SELECT
  ct."id", ct."name", ct."is_active",
  COUNT(cs."id") AS future_sessions
FROM "class_templates" ct
JOIN "class_sessions" cs ON cs."template_id" = ct."id"
WHERE ct."is_active" = false
  AND cs."starts_at" > NOW()
  AND cs."status" = 'scheduled'
GROUP BY ct."id", ct."name", ct."is_active";

\echo '\n--- 3d. Sessions without template (orphaned) ---'
SELECT cs."id", cs."starts_at", cs."status"
FROM "class_sessions" cs
LEFT JOIN "class_templates" ct ON cs."template_id" = ct."id"
WHERE cs."template_id" IS NOT NULL AND ct."id" IS NULL;

\echo '\n--- 3e. Sessions with negative booked/waitlist counts ---'
SELECT "id", "starts_at", "booked_count", "waitlist_count"
FROM "class_sessions"
WHERE "booked_count" < 0 OR "waitlist_count" < 0;

\echo '\n--- 3f. Sessions where booked_count > max_capacity ---'
SELECT "id", "starts_at", "max_capacity", "booked_count",
  ("booked_count" - "max_capacity") AS overbooked_by
FROM "class_sessions"
WHERE "booked_count" > "max_capacity";

\echo '\n--- 3g. Past sessions still marked scheduled (should be completed/cancelled) ---'
SELECT "id", "starts_at", "status"
FROM "class_sessions"
WHERE "starts_at" < NOW() - INTERVAL '2 hours'
  AND "status" = 'scheduled'
ORDER BY "starts_at" DESC
LIMIT 20;

\echo '\n--- 3h. Duo class templates must use session credit_type ---'
SELECT
  "id", "name", "class_type", "credit_type", "credit_cost",
  CASE WHEN "credit_type" = 'session' THEN '✅ OK'
       ELSE '❌ WRONG: duo uses session credits' END AS status
FROM "class_templates"
WHERE "class_type" IN ('reformer_duo', 'mat_duo')
  AND "credit_type" != 'session';


-- ============================================================================
-- 4. BOOKINGS
-- ============================================================================

\echo '\n========== 4. BOOKINGS =========='

\echo '\n--- 4a. Confirmed bookings for past sessions (should be attended or cancelled) ---'
SELECT
  b."id", b."status", b."booked_at",
  cs."starts_at", cs."status" AS session_status,
  u."name" AS user_name, ct."name" AS class_name
FROM "bookings" b
JOIN "class_sessions" cs ON b."session_id" = cs."id"
JOIN "users" u ON b."user_id" = u."id"
LEFT JOIN "class_templates" ct ON cs."template_id" = ct."id"
WHERE b."status" = 'confirmed'
  AND cs."starts_at" < NOW() - INTERVAL '1 hour'
ORDER BY cs."starts_at" DESC
LIMIT 20;

\echo '\n--- 4b. Orphaned bookings (user deleted) ---'
SELECT COUNT(*) AS orphaned_bookings
FROM "bookings" b
LEFT JOIN "users" u ON b."user_id" = u."id"
WHERE u."id" IS NULL;

\echo '\n--- 4c. Orphaned bookings (session deleted) ---'
SELECT COUNT(*) AS orphaned_bookings
FROM "bookings" b
LEFT JOIN "class_sessions" cs ON b."session_id" = cs."id"
WHERE b."session_id" IS NOT NULL AND cs."id" IS NULL;

\echo '\n--- 4d. Bookings with zero credits spent ---'
SELECT "id", "user_id", "session_id", "credits_spent", "status"
FROM "bookings"
WHERE "credits_spent" <= 0 AND "status" IN ('confirmed', 'attended');

\echo '\n--- 4e. Duplicate confirmed bookings per user/session ---'
SELECT "user_id", "session_id", COUNT(*) AS cnt
FROM "bookings"
WHERE "status" = 'confirmed'
GROUP BY "user_id", "session_id"
HAVING COUNT(*) > 1;


-- ============================================================================
-- 5. USERS & AUTH
-- ============================================================================

\echo '\n========== 5. USERS & AUTH =========='

\echo '\n--- 5a. Users without email verified ---'
SELECT "role", COUNT(*) AS cnt
FROM "users"
WHERE "email_verified" IS NULL AND "deleted_at" IS NULL
GROUP BY "role";

\echo '\n--- 5b. Soft-deleted users with active bookings ---'
SELECT u."id", u."name", u."email", u."deleted_at",
  COUNT(b."id") AS active_bookings
FROM "users" u
JOIN "bookings" b ON u."id" = b."user_id"
WHERE u."deleted_at" IS NOT NULL
  AND b."status" = 'confirmed'
GROUP BY u."id", u."name", u."email", u."deleted_at";

\echo '\n--- 5c. Users with negative credit balances ---'
SELECT u."id", u."name", u."email",
  cb."credit_type", cb."balance"
FROM "users" u
JOIN "credit_balances" cb ON u."id" = cb."user_id"
WHERE cb."balance" < 0;

\echo '\n--- 5d. Users without any credit balance row ---'
SELECT u."id", u."name", u."email", u."role"
FROM "users" u
LEFT JOIN "credit_balances" cb ON u."id" = cb."user_id"
WHERE u."deleted_at" IS NULL
  AND cb."id" IS NULL;


-- ============================================================================
-- 6. CREDIT PURCHASES & TRANSACTIONS
-- ============================================================================

\echo '\n========== 6. CREDIT PURCHASES & TRANSACTIONS =========='

\echo '\n--- 6a. Purchases with NULL package_id (legacy?) ---'
SELECT "id", "user_id", "package_id", "payment_status", "created_at"
FROM "credit_purchases"
WHERE "package_id" IS NULL
ORDER BY "created_at" DESC
LIMIT 10;

\echo '\n--- 6b. Purchases stuck in pending > 24h ---'
SELECT "id", "user_id", "payment_status", "created_at"
FROM "credit_purchases"
WHERE "payment_status" = 'pending'
  AND "created_at" < NOW() - INTERVAL '24 hours'
ORDER BY "created_at" DESC
LIMIT 10;

\echo '\n--- 6c. Orphaned credit transactions (booking deleted) ---'
SELECT COUNT(*) AS orphaned
FROM "credit_transactions" ct
LEFT JOIN "bookings" b ON ct."booking_id" = b."id"
WHERE ct."booking_id" IS NOT NULL AND b."id" IS NULL;

\echo '\n--- 6d. Orphaned credit transactions (user deleted) ---'
SELECT COUNT(*) AS orphaned
FROM "credit_transactions" ct
LEFT JOIN "users" u ON ct."user_id" = u."id"
WHERE u."id" IS NULL;


-- ============================================================================
-- 7. MEMBERSHIPS & INVOICES
-- ============================================================================

\echo '\n========== 7. MEMBERSHIPS & INVOICES =========='

\echo '\n--- 7a. Memberships with past next_credit_grant_at ---'
SELECT "id", "user_id", "status", "next_credit_grant_at"
FROM "user_memberships"
WHERE "status" = 'active'
  AND "next_credit_grant_at" < NOW()
ORDER BY "next_credit_grant_at"
LIMIT 10;

\echo '\n--- 7b. Unsent invoice reminders (past due) ---'
SELECT "id", "user_id", "due_date", "status", "reminder_sent_at"
FROM "invoice_reminders"
WHERE "status" = 'pending'
  AND "due_date" < NOW()
ORDER BY "due_date"
LIMIT 10;


-- ============================================================================
-- 8. DUO INVITES
-- ============================================================================

\echo '\n========== 8. DUO INVITES =========='

\echo '\n--- 8a. Expired duo invites still pending ---'
SELECT "id", "organizer_booking_id", "status", "expires_at"
FROM "duo_invites"
WHERE "status" = 'pending'
  AND "expires_at" < NOW()
ORDER BY "expires_at" DESC
LIMIT 10;

\echo '\n--- 8b. Orphaned duo invites (booking deleted) ---'
SELECT COUNT(*) AS orphaned
FROM "duo_invites" di
LEFT JOIN "bookings" b ON di."organizer_booking_id" = b."id"
WHERE b."id" IS NULL;


-- ============================================================================
-- 9. SCHEMA / ENUM SANITY
-- ============================================================================

\echo '\n========== 9. SCHEMA / ENUM SANITY =========='

\echo '\n--- 9a. Check all expected tables exist ---'
SELECT table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables t2
    WHERE t2.table_name = tables.table_name
  ) THEN '✅' ELSE '❌' END AS exists
FROM (VALUES
  ('users'), ('accounts'), ('sessions'),
  ('class_templates'), ('class_sessions'), ('instructors'),
  ('credit_packages'), ('credit_balances'), ('credit_purchases'), ('credit_transactions'),
  ('bookings'), ('waitlist_entries'),
  ('user_memberships'), ('invoice_reminders'),
  ('duo_invites'), ('duo_members'),
  ('welcome_journey_requests'), ('cancellation_mercy_uses')
) AS tables(table_name);

\echo '\n--- 9b. Check expected columns on users ---'
SELECT column_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns c2
    WHERE c2.table_name = 'users' AND c2.column_name = cols.column_name
  ) THEN '✅' ELSE '❌' END AS exists
FROM (VALUES
  ('welcome_completed_at'), ('profile_completed'), ('first_mercy_used'),
  ('total_classes_attended'), ('current_streak'), ('longest_streak'),
  ('deleted_at')
) AS cols(column_name);

\echo '\n--- 9c. Check expected columns on class_templates ---'
SELECT column_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns c2
    WHERE c2.table_name = 'class_templates' AND c2.column_name = cols.column_name
  ) THEN '✅' ELSE '❌' END AS exists
FROM (VALUES
  ('is_welcome_journey'), ('vibe_tags'), ('location')
) AS cols(column_name);

\echo '\n--- 9d. Total record counts ---'
SELECT 'users' AS table_name, COUNT(*) AS cnt FROM "users" WHERE "deleted_at" IS NULL
UNION ALL SELECT 'class_templates', COUNT(*) FROM "class_templates"
UNION ALL SELECT 'class_sessions', COUNT(*) FROM "class_sessions"
UNION ALL SELECT 'credit_packages', COUNT(*) FROM "credit_packages"
UNION ALL SELECT 'credit_purchases', COUNT(*) FROM "credit_purchases"
UNION ALL SELECT 'bookings', COUNT(*) FROM "bookings"
UNION ALL SELECT 'welcome_journey_requests', COUNT(*) FROM "welcome_journey_requests"
UNION ALL SELECT 'user_memberships', COUNT(*) FROM "user_memberships"
UNION ALL SELECT 'duo_invites', COUNT(*) FROM "duo_invites"
ORDER BY table_name;


-- ============================================================================
-- 10. SUMMARY: Count of issues found
-- ============================================================================

\echo '\n========== 10. ISSUE SUMMARY =========='
\echo 'Review all sections above. Any row with ❌ or ⚠️ needs attention.'
\echo 'Sections with zero rows are healthy.'
\echo 'Run this script weekly or after any deployment.'
