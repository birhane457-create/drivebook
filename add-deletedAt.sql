-- Add soft delete fields to Customer table
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS "Customer_preferredProviderId_deletedAt_idx" ON "Customer"("preferredProviderId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Customer_email_deletedAt_idx" ON "Customer"("email", "deletedAt");
