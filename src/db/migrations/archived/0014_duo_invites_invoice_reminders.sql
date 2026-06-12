-- Migration 0014: duo_invites + invoice_reminders
-- Adds the Duo Booking System and admin invoice reminder audit trail.
-- Safe to run multiple times — all DDL is guarded with IF NOT EXISTS / DO $$ checks.

-- ─── 1. New enum types ────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "duo_invite_status" AS ENUM (
    'pending',    -- invite created, partner has not yet accepted
    'accepted',   -- partner confirmed and booked
    'expired',    -- expiresAt passed without acceptance
    'cancelled'   -- organizer cancelled their booking
  );
EXCEPTION
  WHEN duplicate_object THEN null;  -- already exists, skip
END $$;

DO $$ BEGIN
  CREATE TYPE "invoice_reminder_type" AS ENUM (
    'overdue_reminder',  -- admin triggers dunning email to client
    'custom_send'        -- admin sends invoice to arbitrary email address
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ─── 2. invoice_reminders ─────────────────────────────────────────────────────
-- Immutable audit trail (§147 AO pattern).  Never UPDATE, only INSERT.
-- Survives purchase deletion — RESTRICT prevents accidental cascade.

CREATE TABLE IF NOT EXISTS "invoice_reminders" (
  "id"                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- [FIX-3] RESTRICT — financial audit record must not vanish silently
  "purchase_id"         UUID        NOT NULL
    REFERENCES "credit_purchases" ("id") ON DELETE RESTRICT,

  -- SET NULL — record survives admin account removal, stays auditable
  "sent_by_admin_id"    UUID
    REFERENCES "users" ("id") ON DELETE SET NULL,

  "recipient_email"     VARCHAR(255) NOT NULL,
  "subject"             VARCHAR(500) NOT NULL,
  "custom_message"      TEXT,
  "reminder_type"       "invoice_reminder_type" NOT NULL,
  "delivery_status"     VARCHAR(20)  NOT NULL DEFAULT 'sent',
  "resend_message_id"   VARCHAR(255),

  -- [FIX-2] withTimezone — immutable audit timestamp
  "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "invoice_reminders_purchase_id_idx"
  ON "invoice_reminders" ("purchase_id");

CREATE INDEX IF NOT EXISTS "invoice_reminders_sent_by_admin_idx"
  ON "invoice_reminders" ("sent_by_admin_id");

-- Composite index for cron sweep: "purchases with no reminder in last N days"
CREATE INDEX IF NOT EXISTS "invoice_reminders_purchase_created_at_idx"
  ON "invoice_reminders" ("purchase_id", "created_at");

-- ─── 3. duo_invites ───────────────────────────────────────────────────────────
-- One row per duo invite link.  Token is the public URL key — must be unique.
-- Financial records referenced with RESTRICT; nullable partner refs use SET NULL.

CREATE TABLE IF NOT EXISTS "duo_invites" (
  "id"                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- [FIX-3] RESTRICT — organizer's booking is a financial record
  "organizer_booking_id"  UUID        NOT NULL
    REFERENCES "bookings" ("id") ON DELETE RESTRICT,

  -- [FIX-3] RESTRICT — user cannot be hard-deleted while holding active invites
  "organizer_user_id"     UUID        NOT NULL
    REFERENCES "users" ("id") ON DELETE RESTRICT,

  -- [FIX-3] RESTRICT — session record is needed for integrity checks
  "session_id"            UUID        NOT NULL
    REFERENCES "class_sessions" ("id") ON DELETE RESTRICT,

  -- 64-char hex token: crypto.randomBytes(32).toString('hex')
  "token"                 VARCHAR(64) NOT NULL,

  "status"                "duo_invite_status" NOT NULL DEFAULT 'pending',

  -- Populated when partner accepts; null until then
  "partner_booking_id"    UUID
    REFERENCES "bookings" ("id") ON DELETE SET NULL,

  -- [FIX-3] RESTRICT once set — partner's booking is financial
  "partner_user_id"       UUID
    REFERENCES "users" ("id") ON DELETE RESTRICT,

  -- [FIX-2] withTimezone — scheduling-critical, never store without TZ
  "expires_at"            TIMESTAMPTZ NOT NULL,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Token must be globally unique — it IS the public invite URL segment
CREATE UNIQUE INDEX IF NOT EXISTS "duo_invites_token_unique_idx"
  ON "duo_invites" ("token");

-- Lookup by organizer booking (check for existing pending invite before creating)
CREATE INDEX IF NOT EXISTS "duo_invites_organizer_booking_idx"
  ON "duo_invites" ("organizer_booking_id");

-- Join from session to its invites
CREATE INDEX IF NOT EXISTS "duo_invites_session_idx"
  ON "duo_invites" ("session_id");

-- Cron sweep: find expired pending invites
CREATE INDEX IF NOT EXISTS "duo_invites_status_expires_idx"
  ON "duo_invites" ("status", "expires_at");

-- ─── 4. Verification queries ──────────────────────────────────────────────────
-- Run these manually after applying to confirm the migration succeeded.
--
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name IN ('invoice_reminders', 'duo_invites')
-- ORDER BY table_name, ordinal_position;
--
-- SELECT typname, enumlabel
-- FROM pg_enum
-- JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
-- WHERE typname IN ('duo_invite_status', 'invoice_reminder_type')
-- ORDER BY typname, enumsortorder;
--
-- SELECT indexname FROM pg_indexes
-- WHERE tablename IN ('invoice_reminders', 'duo_invites')
-- ORDER BY tablename, indexname;
