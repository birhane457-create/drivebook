-- Add RBAC permissions column to StaffMember
ALTER TABLE "StaffMember" ADD COLUMN IF NOT EXISTS "permissions" TEXT[] NOT NULL DEFAULT '{}';

-- Add configurable credit limit columns to PlatformSettings
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "maxAdminCreditAmount" DOUBLE PRECISION NOT NULL DEFAULT 500;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "maxAdminDeductAmount" DOUBLE PRECISION NOT NULL DEFAULT 500;
