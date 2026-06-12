-- Force update credit_type enum to ensure new values are applied
ALTER TABLE "credit_packages" ALTER COLUMN "credit_type" SET DATA TYPE text;
ALTER TABLE "credit_balances" ALTER COLUMN "credit_type" SET DATA TYPE text;
ALTER TABLE "bookings" ALTER COLUMN "credit_type" SET DATA TYPE text;
ALTER TABLE "class_templates" ALTER COLUMN "credit_type" SET DATA TYPE text;
ALTER TABLE "credit_purchases" ALTER COLUMN "credit_type" SET DATA TYPE text;
ALTER TABLE "credit_transactions" ALTER COLUMN "credit_type" SET DATA TYPE text;
DROP TYPE IF EXISTS "public"."credit_type";
CREATE TYPE "public"."credit_type" AS ENUM('mat_group', 'reformer_group', 'private_session');
ALTER TABLE "credit_packages" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
ALTER TABLE "credit_balances" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
ALTER TABLE "bookings" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
ALTER TABLE "class_templates" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
ALTER TABLE "credit_purchases" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
ALTER TABLE "credit_transactions" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
