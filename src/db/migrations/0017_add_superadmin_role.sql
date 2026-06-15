-- Add superadmin role to the global user role enum.
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'superadmin';
