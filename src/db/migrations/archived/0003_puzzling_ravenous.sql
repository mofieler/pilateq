CREATE TYPE "public"."session_subtype" AS ENUM('private', 'duo');--> statement-breakpoint
ALTER TABLE "membership_plans" ADD COLUMN "session_subtype" "session_subtype";--> statement-breakpoint
ALTER TABLE "user_memberships" ADD COLUMN "session_subtype" "session_subtype";