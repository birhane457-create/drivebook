-- Package Cancellation Approval Workflow (PKG-3)
-- Adds manual approval fields for package cancellations

ALTER TABLE "Booking" 
  ADD COLUMN IF NOT EXISTS "cancellationStatus" TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "cancellationRequestedAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "cancellationRequestedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "adminReviewedAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "adminReviewedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "adminReviewNote" TEXT,
  ADD COLUMN IF NOT EXISTS "adminOverrideAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "stripeRefundId" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentToken" TEXT;

-- Index for pending cancellations queue (admin dashboard)
CREATE INDEX IF NOT EXISTS "idx_booking_cancellation_pending" 
  ON "Booking" ("cancellationStatus", "cancellationRequestedAt")
  WHERE "cancellationStatus" = 'PENDING';

-- Index for admin review history
CREATE INDEX IF NOT EXISTS "idx_booking_admin_reviewed"
  ON "Booking" ("adminReviewedBy", "adminReviewedAt")
  WHERE "adminReviewedBy" IS NOT NULL;

-- Add check constraint for valid cancellation statuses
ALTER TABLE "Booking"
  DROP CONSTRAINT IF EXISTS "chk_cancellation_status",
  ADD CONSTRAINT "chk_cancellation_status" 
    CHECK ("cancellationStatus" IS NULL OR "cancellationStatus" IN ('PENDING', 'APPROVED', 'REJECTED'));