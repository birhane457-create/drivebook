-- Migration: Add organisationType, commercial agreement fields, and privacy consent fields
--
-- Adds 7 new fields to Provider:
--   1. organisationType            — INDIVIDUAL_INSTRUCTOR | DRIVING_SCHOOL (default INDIVIDUAL_INSTRUCTOR)
--   2. commercialAgreementType     — MARKETPLACE_TERMS | SAAS_TERMS (nullable until registration sets it)
--   3. commercialAgreementStatus   — PENDING | ACCEPTED (default PENDING)
--   4. commercialAgreementVersion  — e.g. "1.0" or "PENDING" (nullable)
--   5. commercialAgreementAcceptedAt — DateTime (nullable until accepted)
--   6. privacyPolicyVersion        — e.g. "1.0" (nullable)
--   7. privacyPolicyAcceptedAt     — DateTime (nullable)
--
-- Existing providers:
--   organisationType defaults to INDIVIDUAL_INSTRUCTOR for all existing rows.
--   commercialAgreementStatus defaults to PENDING for all existing rows.
--   All nullable fields are null for existing rows — no backfill required.
--   The existing terms acceptance (User.termsAcceptedAt / User.termsVersion)
--   is preserved separately and is not modified by this migration.

ALTER TABLE "Provider"
  ADD COLUMN "organisationType"             TEXT         NOT NULL DEFAULT 'INDIVIDUAL_INSTRUCTOR',
  ADD COLUMN "commercialAgreementType"      TEXT,
  ADD COLUMN "commercialAgreementStatus"    TEXT         NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "commercialAgreementVersion"   TEXT,
  ADD COLUMN "commercialAgreementAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyPolicyVersion"         TEXT,
  ADD COLUMN "privacyPolicyAcceptedAt"      TIMESTAMP(3);
