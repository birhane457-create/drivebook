-- Migration: Add organisationType, commercial agreement fields, and privacy consent fields
--
-- Adds 7 new fields to Provider:
--   1. organisationType            — INDIVIDUAL_INSTRUCTOR | DRIVING_SCHOOL | SOLE_TRADER |
--                                    REGISTERED_BUSINESS | BUSINESS
--   2. commercialAgreementType     — MARKETPLACE_TERMS | SAAS_TERMS (nullable)
--   3. commercialAgreementStatus   — PENDING | ACCEPTED (default PENDING)
--   4. commercialAgreementVersion  — e.g. '2.0' | null (null = not yet published/accepted)
--   5. commercialAgreementAcceptedAt — DateTime (nullable until accepted)
--   6. privacyPolicyVersion        — e.g. '2.0' (nullable)
--   7. privacyPolicyAcceptedAt     — DateTime (nullable)
--
-- organisationType values:
--   INDIVIDUAL_INSTRUCTOR  — driving instructor operating independently
--   DRIVING_SCHOOL         — school with multiple instructors (designed, not yet enabled)
--   SOLE_TRADER            — non-driving sole trader (default for plumber/electrician/beauty/tax)
--   REGISTERED_BUSINESS    — non-driving registered company or business entity
--   BUSINESS               — multi-provider organisation (reserved; not assigned at registration)
--
-- Existing provider rows — DEFAULT strategy:
--   The DEFAULT 'SOLE_TRADER' is applied to all existing rows.
--   This is intentionally conservative: SOLE_TRADER is the safer classification
--   for pre-existing non-driving providers (plumber/electrician/beauty/tax).
--
--   REQUIRED AFTER APPLYING THIS MIGRATION — correct driving instructors:
--
--     UPDATE "Provider"
--     SET "organisationType" = 'INDIVIDUAL_INSTRUCTOR'
--     WHERE "businessModel" = 'MARKETPLACE'
--        OR id IN (SELECT "providerId" FROM "DrivingProviderProfile");
--
--   This UPDATE is not part of this migration SQL because it references a secondary
--   table and must be verified against production data before execution.
--   See docs/audit/PHASE1-PROVIDER-INDUSTRY-AUDIT-REPORT.md for the provider classification.
--
-- DO NOT apply this migration to production without reviewing the
-- classification of existing driving-instructor providers first.

ALTER TABLE "Provider"
  ADD COLUMN "organisationType"             TEXT         NOT NULL DEFAULT 'SOLE_TRADER',
  ADD COLUMN "commercialAgreementType"      TEXT,
  ADD COLUMN "commercialAgreementStatus"    TEXT         NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "commercialAgreementVersion"   TEXT,
  ADD COLUMN "commercialAgreementAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyPolicyVersion"         TEXT,
  ADD COLUMN "privacyPolicyAcceptedAt"      TIMESTAMP(3);
