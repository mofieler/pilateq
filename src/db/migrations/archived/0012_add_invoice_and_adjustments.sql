-- Migration 0012: Add invoice tracking to credit_purchases + credit_adjustments audit table

-- Invoice fields on credit_purchases (§14 UStG compliance)
ALTER TABLE "credit_purchases"
  ADD COLUMN IF NOT EXISTS "invoice_number" varchar(50),
  ADD COLUMN IF NOT EXISTS "invoice_issued_at" timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS "credit_purchases_invoice_number_idx"
  ON "credit_purchases" ("invoice_number")
  WHERE "invoice_number" IS NOT NULL;

-- Credit adjustments audit table (§147 AO retention requirement)
CREATE TABLE IF NOT EXISTS "credit_adjustments" (
  "id"           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"      uuid        NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "admin_id"     uuid        REFERENCES "users"("id") ON DELETE SET NULL,
  "credit_type"  credit_type NOT NULL,
  "amount_delta" integer     NOT NULL,
  "reason"       text        NOT NULL,
  "new_balance"  integer     NOT NULL,
  "notes"        text,
  "created_at"   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "credit_adjustments_user_id_idx"
  ON "credit_adjustments" ("user_id");

CREATE INDEX IF NOT EXISTS "credit_adjustments_admin_id_idx"
  ON "credit_adjustments" ("admin_id");

CREATE INDEX IF NOT EXISTS "credit_adjustments_user_created_at_idx"
  ON "credit_adjustments" ("user_id", "created_at");
