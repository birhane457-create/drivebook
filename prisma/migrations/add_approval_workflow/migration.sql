-- Add approval workflow system for high-value admin actions
-- Ensures two-person integrity for financial and subscription operations

-- Create PendingApproval table
CREATE TABLE IF NOT EXISTS "PendingApproval" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actionType" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "requestedByName" TEXT,
  "requestedByEmail" TEXT,
  "requestData" JSONB NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedBy" TEXT,
  "approvedByName" TEXT,
  "approvedByEmail" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedBy" TEXT,
  "rejectedByName" TEXT,
  "rejectedByEmail" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "PendingApproval_status_idx" ON "PendingApproval"("status");
CREATE INDEX IF NOT EXISTS "PendingApproval_requestedBy_idx" ON "PendingApproval"("requestedBy");
CREATE INDEX IF NOT EXISTS "PendingApproval_targetType_targetId_idx" ON "PendingApproval"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "PendingApproval_actionType_idx" ON "PendingApproval"("actionType");
CREATE INDEX IF NOT EXISTS "PendingApproval_expiresAt_idx" ON "PendingApproval"("expiresAt");

-- Add comments
COMMENT ON TABLE "PendingApproval" IS 'Two-person approval workflow for high-value admin actions';
COMMENT ON COLUMN "PendingApproval"."actionType" IS 'Type of action: PAYOUT_PROCESS, SUBSCRIPTION_OVERRIDE, WALLET_LARGE_CREDIT, etc.';
COMMENT ON COLUMN "PendingApproval"."status" IS 'PENDING, APPROVED, REJECTED, EXPIRED, CANCELLED';
COMMENT ON COLUMN "PendingApproval"."requestData" IS 'Full request payload for later execution';
COMMENT ON COLUMN "PendingApproval"."expiresAt" IS 'Auto-reject after this time (24-48h typical)';
