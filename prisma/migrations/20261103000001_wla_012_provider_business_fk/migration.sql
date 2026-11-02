-- WLA-012: Add optional businessId FK to Provider.
-- One Business can have multiple Providers.
-- Null for standalone Providers not associated with a Business.
-- The biz_ app-layer convention is replaced by this proper relation.
-- Safe to run: column is nullable, no existing rows are affected.

ALTER TABLE "Provider" ADD COLUMN "businessId" TEXT;

ALTER TABLE "Provider"
  ADD CONSTRAINT "Provider_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Provider_businessId_idx" ON "Provider"("businessId");
