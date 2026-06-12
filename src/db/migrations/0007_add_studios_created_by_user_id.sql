-- Migration: add studios.created_by_user_id for onboarding ownership verification
-- Prevents onboarding completion from escalating an arbitrary authenticated user
-- to admin of an existing studio row.

ALTER TABLE studios
  ADD COLUMN created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX studios_created_by_user_id_idx ON studios(created_by_user_id);
