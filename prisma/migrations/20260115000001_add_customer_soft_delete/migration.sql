-- Add soft delete fields to Customer table
-- Never hard delete customers with bookings or user accounts
-- Preserves referential integrity for financial records and audit trails

-- Add deletedAt timestamp (null = not deleted)
ALTER TABLE "Customer" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Add deletedBy to track which provider deleted the client
ALTER TABLE "Customer" ADD COLUMN "deletedBy" TEXT;

-- Add indexes for efficient querying
CREATE INDEX "Customer_preferredProviderId_deletedAt_idx" ON "Customer"("preferredProviderId", "deletedAt");
CREATE INDEX "Customer_email_deletedAt_idx" ON "Customer"("email", "deletedAt");

-- Update status column comment (no schema change, just documentation)
COMMENT ON COLUMN "Customer"."status" IS 'ACTIVE (default), SUSPENDED (SaaS providers can block clients), DELETED (soft delete marker)';
