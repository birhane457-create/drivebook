-- Migration: Add organisationType, commercial agreement fields, and privacy consent fields
--
-- Adds 7 new fields to Provider:
--   1. organisationType            — INDIVIDUAL_INSTRUCTOR | DRIVING_SCHOOL | SOLE_TRADER | BUSINESS
--   2. commercialAgreementType     — MARKETPLACE_TERMS | SAAS_TERMS (nullable until registration sets it)
--   3. commercialAgreementStatus   — PENDING | ACCEPTED (default PENDING)
--   4. commercialAgreementVersion  — e.g. '2.0' | null (nullable; null = not yet published/accepted)
--   5. commercialAgreementAcceptedAt — DateTime (nullable until accepted)
--   6. privacyPolicyVersion        — e.g. '2.0' (nullable)
--   7. privacyPolicyAcceptedAt     — DateTime (nullable)
--
-- Existing providers (backfill note):
--   organisationType defaults to 'SOLE_TRADER' for all existing rows via the DEFAULT clause.
--   This is incorrect for existing driving-instructor providers (should be INDIVIDUAL_INSTRUCTOR).
--   It is also potentially incorrect for the 5 MARKETPLACE test accounts identified in Phase 1.
--
--   REQUIRED AFTER APPLYING THIS MIGRATION:
--   Run the following UPDATE to correct existing driving instructors:
--
--     UPDATE "Provider"
--     SET "organisationType" = 'INDIVIDUAL_INSTRUCTOR'
--     WHERE "businessModel" = 'MARKETPLACE'
--        OR id IN (SELECT "providerId" FROM "DrivingProviderProfile");
--
--   This UPDATE is not part of the migration SQL because it references a secondary table
--   and must be verified against the production data before execution.
--   See docs/audit/PHASE1-PROVIDER-INDUSTRY-AUDIT-REPORT.md for the provider classification.
--
--   commercialAgreementStatus defaults to PENDING for all existing rows.
--   All nullable fields are null for existing rows.

ALTER TABLE "Provider"
  ADD COLUMN "organisationType"             TEXT         NOT NULL DEFAULT 'SOLE_TRADER',
  ADD COLUMN "commercialAgreementType"      TEXT,
  ADD COLUMN "commercialAgreementStatus"    TEXT         NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "commercialAgreementVersion"   TEXT,
  ADD COLUMN "commercialAgreementAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyPolicyVersion"         TEXT,
  ADD COLUMN "privacyPolicyAcceptedAt"      TIMESTAMP(3);
