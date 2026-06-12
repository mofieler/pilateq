-- ============================================================================
-- VERIFICATION: Welcome Journey System (Run after migration)
-- ============================================================================
-- Copy/paste each block into psql / your DB client and confirm the output.

-- ─── V1. Table exists and has correct structure ─────────────────────────────
\echo '\n=== V1. welcome_journey_requests table structure ==='
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'welcome_journey_requests'
ORDER BY ordinal_position;

-- Expected: id(uuid), user_id(uuid), status(varchar), user_message(text),
--           offered_session_ids(jsonb), created_at(timestamp with time zone),
--           updated_at(timestamp with time zone)

-- ─── V2. Indexes exist ──────────────────────────────────────────────────────
\echo '\n=== V2. Indexes on welcome_journey_requests ==='
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'welcome_journey_requests';

-- Expected: PRIMARY KEY, welcome_requests_user_id_idx, welcome_requests_status_idx

-- ─── V3. Users column exists ────────────────────────────────────────────────
\echo '\n=== V3. users.welcome_completed_at column ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'welcome_completed_at';

-- Expected: timestamp with time zone, YES (nullable)

-- ─── V4. class_templates column exists ──────────────────────────────────────
\echo '\n=== V4. class_templates.is_welcome_journey column ==='
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'class_templates' AND column_name = 'is_welcome_journey';

-- Expected: boolean, NO, false

-- ─── V5. User welcome status overview ───────────────────────────────────────
\echo '\n=== V5. User welcome status (top 20) ==='
SELECT
  "id",
  "name",
  "email",
  "role",
  "welcome_completed_at",
  CASE WHEN "welcome_completed_at" IS NULL THEN 'UNWELCOMED (locked)' ELSE 'WELCOMED' END AS status
FROM "users"
WHERE "deleted_at" IS NULL
ORDER BY "created_at" DESC
LIMIT 20;

-- ─── V6. Count of welcomed vs unwelcomed users ──────────────────────────────
\echo '\n=== V6. Welcomed vs Unwelcomed counts ==='
SELECT
  COUNT(*) FILTER (WHERE "welcome_completed_at" IS NOT NULL) AS welcomed_count,
  COUNT(*) FILTER (WHERE "welcome_completed_at" IS NULL) AS unwelcomed_count,
  COUNT(*) AS total_users
FROM "users"
WHERE "deleted_at" IS NULL;

-- ─── V7. Welcome Journey credit package exists ──────────────────────────────
\echo '\n=== V7. Welcome Journey package ==='
SELECT "id", "name", "category", "credit_type", "credits_amount", "price_cents", "is_active"
FROM "credit_packages"
WHERE "name" = 'Welcome Journey';

-- Expected: exactly 1 row with category='session', is_active=true
-- If 0 rows: unwelcomed users will see empty packages on /credits

-- ─── V8. Active Welcome Journey class templates ─────────────────────────────
\echo '\n=== V8. Welcome Journey class templates ==='
SELECT "id", "name", "class_type", "duration_minutes", "max_capacity", "credit_cost", "is_active"
FROM "class_templates"
WHERE "is_welcome_journey" = true;

-- Expected: at least 1 active template for the offer flow to work
-- If 0 rows: admin cannot offer any slots to unwelcomed users

-- ─── V9. Upcoming Welcome Journey sessions ──────────────────────────────────
\echo '\n=== V9. Upcoming Welcome Journey sessions (next 30 days) ==='
SELECT
  cs."id" AS session_id,
  ct."name" AS template_name,
  cs."starts_at",
  cs."max_capacity",
  cs."booked_count",
  (cs."max_capacity" - cs."booked_count") AS spots_left,
  cs."status"
FROM "class_sessions" cs
JOIN "class_templates" ct ON cs."template_id" = ct."id"
WHERE ct."is_welcome_journey" = true
  AND cs."starts_at" > NOW()
  AND cs."starts_at" < NOW() + INTERVAL '30 days'
  AND cs."status" = 'scheduled'
ORDER BY cs."starts_at";

-- Expected: at least a few scheduled sessions
-- If 0 rows: nothing to offer unwelcomed users

-- ─── V10. Pending welcome requests ──────────────────────────────────────────
\echo '\n=== V10. Pending welcome requests ==='
SELECT
  wjr."id" AS request_id,
  wjr."status",
  u."name" AS user_name,
  u."email" AS user_email,
  wjr."user_message",
  wjr."created_at"
FROM "welcome_journey_requests" wjr
JOIN "users" u ON wjr."user_id" = u."id"
WHERE wjr."status" = 'pending'
ORDER BY wjr."created_at" DESC;

-- ─── V11. Foreign key integrity ─────────────────────────────────────────────
\echo '\n=== V11. FK integrity: orphaned welcome requests? ==='
SELECT COUNT(*) AS orphaned_requests
FROM "welcome_journey_requests" wjr
LEFT JOIN "users" u ON wjr."user_id" = u."id"
WHERE u."id" IS NULL;

-- Expected: 0 (cascade delete should prevent this, but verify)

-- ─── V12. Data types sanity check ───────────────────────────────────────────
\echo '\n=== V12. offered_session_ids is valid JSON array ==='
SELECT
  COUNT(*) FILTER (WHERE jsonb_typeof("offered_session_ids") = 'array') AS valid_arrays,
  COUNT(*) FILTER (WHERE "offered_session_ids" IS NULL) AS nulls,
  COUNT(*) FILTER (WHERE jsonb_typeof("offered_session_ids") != 'array') AS invalid_json
FROM "welcome_journey_requests";

-- Expected: valid_arrays >= 0, invalid_json = 0

-- ─── V13. Booking guard check: can unwelcomed users book normal classes? ────
-- (This is a logic check, not a data fix. Run to see if any unwelcomed user
--  already has a non-welcome booking, which would be inconsistent.)
\echo '\n=== V13. Unwelcomed users with non-welcome bookings ==='
SELECT
  u."id",
  u."name",
  u."email",
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

-- Expected: 0 rows. If >0, those users have bookings that the new guards would block.
-- ACTION NEEDED: Mark those users as welcomed (or their bookings will be inconsistent
-- with the new business rules).
