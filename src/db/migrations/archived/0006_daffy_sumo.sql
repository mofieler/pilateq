ALTER TABLE "bookings" ADD COLUMN "access_provider" varchar(40);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "access_grant" jsonb;--> statement-breakpoint
CREATE INDEX "bookings_access_provider_idx" ON "bookings" USING btree ("access_provider");