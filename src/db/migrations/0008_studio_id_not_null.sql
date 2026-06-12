-- =============================================================================
-- PilatesOS — Migration 0008: Enforce NOT NULL on studio_id
-- =============================================================================
-- This migration enforces tenant isolation at the schema level for users and
-- credit_packages. It does NOT silently backfill NULL values; if any row lacks
-- a studio_id the migration fails loudly so operators can fix the data first.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "studio_id" IS NULL) THEN
    RAISE EXCEPTION 'users.studio_id contains NULL values; backfill before applying NOT NULL constraint';
  END IF;

  IF EXISTS (SELECT 1 FROM "credit_packages" WHERE "studio_id" IS NULL) THEN
    RAISE EXCEPTION 'credit_packages.studio_id contains NULL values; backfill before applying NOT NULL constraint';
  END IF;
END $$;

ALTER TABLE "users" ALTER COLUMN "studio_id" SET NOT NULL;
ALTER TABLE "credit_packages" ALTER COLUMN "studio_id" SET NOT NULL;
