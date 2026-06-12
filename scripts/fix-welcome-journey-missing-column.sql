-- ============================================================================
-- MIGRATION FIX: Add missing preferred_slots column to welcome_journey_requests
-- ============================================================================
-- This fixes the schema/migration mismatch where the Drizzle ORM schema defines
-- preferred_slots but the actual database migration never created the column.

-- Add the missing column
ALTER TABLE "welcome_journey_requests" ADD COLUMN IF NOT EXISTS "preferred_slots" jsonb DEFAULT '[]'::jsonb;

-- Verify the column now exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'welcome_journey_requests'
ORDER BY ordinal_position;

-- Expected output should now include:
-- preferred_slots | jsonb | '[]'::jsonb
