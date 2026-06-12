-- Migration: Add profile_completed flag to users
-- Tracks whether a Google OAuth user has explicitly completed their profile.
-- false = prompt them on every login until they do (or skip each time).

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "profile_completed" boolean NOT NULL DEFAULT false;
