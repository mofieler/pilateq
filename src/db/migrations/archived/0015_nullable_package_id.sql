-- Allow membership-based credit_purchases to have no package (packageId = NULL).
-- Membership plan name is stored in admin_notes for display purposes.
ALTER TABLE "credit_purchases" ALTER COLUMN "package_id" DROP NOT NULL;
