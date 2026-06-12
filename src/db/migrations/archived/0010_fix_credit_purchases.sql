-- Migration: Fix credit_purchases table
-- 1. Create payment_method / payment_status PG enum types (schema uses enums, DB still has varchar)
-- 2. Migrate the columns from varchar(20) → enum
-- 3. Add missing processing_fee_cents column

-- ── payment_method enum ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE "public"."payment_method" AS ENUM (
      'stripe',
      'pay_at_studio',
      'bank_transfer',
      'cash',
      'sound_healing_credits'
    );
  END IF;
END
$$;

-- ── payment_status enum ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE "public"."payment_status" AS ENUM (
      'pending',
      'paid',
      'failed',
      'cancelled',
      'overdue',
      'refunded'
    );
  END IF;
END
$$;

-- ── Migrate payment_method varchar → enum (idempotent) ────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_purchases'
      AND column_name = 'payment_method'
      AND data_type = 'character varying'
  ) THEN
    ALTER TABLE "credit_purchases"
      ALTER COLUMN "payment_method" TYPE "public"."payment_method"
      USING "payment_method"::"public"."payment_method";
  END IF;
END
$$;

-- ── Migrate payment_status varchar → enum (idempotent) ────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_purchases'
      AND column_name = 'payment_status'
      AND data_type = 'character varying'
  ) THEN
    ALTER TABLE "credit_purchases"
      ALTER COLUMN "payment_status" TYPE "public"."payment_status"
      USING "payment_status"::"public"."payment_status";
  END IF;
END
$$;

-- ── Add missing processing_fee_cents column ───────────────────────────────
ALTER TABLE "credit_purchases"
  ADD COLUMN IF NOT EXISTS "processing_fee_cents" integer DEFAULT 0;
