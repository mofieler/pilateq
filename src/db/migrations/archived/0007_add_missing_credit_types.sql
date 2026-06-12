-- Migration: Add missing credit types to existing enum
-- This migration safely adds new enum values by recreating the enum with all values

-- Step 1: Check if new values exist and add them if missing
DO $$
BEGIN;

-- Add new credit type values if they don't exist
DO $$
BEGIN
    ALTER TYPE "public"."credit_type" ADD VALUE IF NOT EXISTS 'duo_group';
EXCEPTION WHEN duplicate_object THEN
    -- Value already exists, continue
END;
$$;

DO $$
BEGIN
    ALTER TYPE "public"."credit_type" ADD VALUE IF NOT EXISTS 'general_group';
EXCEPTION WHEN duplicate_object THEN
    -- Value already exists, continue
END;
$$;

DO $$
BEGIN
    ALTER TYPE "public"."credit_type" ADD VALUE IF NOT EXISTS 'online_class';
EXCEPTION WHEN duplicate_object THEN
    -- Value already exists, continue
END;
$$;

DO $$
BEGIN
    ALTER TYPE "public"."credit_type" ADD VALUE IF NOT EXISTS 'sound_healing';
EXCEPTION WHEN duplicate_object THEN
    -- Value already exists, continue
END;
$$;

-- Step 2: Add sound_healing to class_type enum if missing
DO $$
BEGIN
    ALTER TYPE "public"."class_type" ADD VALUE IF NOT EXISTS 'sound_healing';
EXCEPTION WHEN duplicate_object THEN
    -- Value already exists, continue
END;
$$;

-- Step 3: Add validityWeeks column if it doesn't exist
DO $$
BEGIN
    ALTER TABLE "credit_packages" ADD COLUMN IF NOT EXISTS "validity_weeks" integer NOT NULL DEFAULT 52;
EXCEPTION WHEN duplicate_column THEN
    -- Column already exists, continue
END;
$$;

COMMIT;
$$;
