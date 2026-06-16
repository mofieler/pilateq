-- =============================================================================
-- Migration: Delete old test tenants created before paquitatest1-6
-- =============================================================================
-- Keeps:
--   - platform        (superadmin holder)
--   - default         (fallback studio)
--   - paquitatest1..6 (current test studios)
--
-- Everything else in "studios" will be deleted. Because all FKs to studios
-- use ON DELETE CASCADE, this also removes related rows in:
--   users, studio_memberships, studio_invites, studio_settings,
--   instructors, class_templates, class_sessions, bookings, waitlist_entries,
--   credit_packages, credit_purchases, credit_transactions, duo_invites,
--   calendar_connections, external_calendar_blocks, invoice_reminders,
--   membership_plans, promo_codes, promo_usages, cancellation_mercy_uses,
--   class_pass_checkins, welcome_journey_requests, audit_logs
--
-- Run this inside a transaction so it rolls back on any FK error.
-- =============================================================================

BEGIN;

-- Preview only (uncomment to check what will be removed):
-- SELECT id, slug, name, created_at
-- FROM studios
-- WHERE slug NOT IN (
--   'platform', 'default',
--   'paquitatest1', 'paquitatest2', 'paquitatest3',
--   'paquitatest4', 'paquitatest5', 'paquitatest6'
-- )
-- ORDER BY created_at;

DELETE FROM studios
WHERE slug NOT IN (
  'platform',
  'default',
  'paquitatest1',
  'paquitatest2',
  'paquitatest3',
  'paquitatest4',
  'paquitatest5',
  'paquitatest6'
);

COMMIT;
