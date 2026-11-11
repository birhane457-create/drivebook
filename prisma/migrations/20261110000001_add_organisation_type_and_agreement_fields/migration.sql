-- Migration: Add organisationType, commercial agreement fields, and privacy consent fields
--
-- Adds 7 new fields to Provider:
--   1. organisationType            — nullable TEXT (no default for existing rows)
--   2. commercialAgreementType     — MARKETPLACE_TERMS | SAAS_TERMS (nullable)
--   3. commercialAgreementStatus   — PENDING | ACCEPTED (default PENDING)
--   4. commercialAgreementVersion  — e.g. '2.0' | null (null = not yet published/accepted)
--   5. commercialAgreementAcceptedAt — DateTime (nullable until accepted)
--   6. privacyPolicyVersion        — e.g. '2.0' (nullable)
--   7. privacyPolicyAcceptedAt     — DateTime (nullable)
--
-- organisationType values (once assigned):
--   INDIVIDUAL_INSTRUCTOR  — driving instructor operating independently
--   DRIVING_SCHOOL         — school with multiple instructors (designed, not yet enabled)
--   SOLE_TRADER            — non-driving sole trader (selected at registration)
--   REGISTERED_BUSINESS    — non-driving registered company or business entity
--   BUSINESS               — multi-provider organisation (reserved; not assigned at registration)
--
-- EXISTING PROVIDER ROWS:
--   organisationType is NULL for all existing rows.
--   This is intentional: existing providers cannot be reliably classified from
--   DB evidence alone without individual review.
--
--   NULL ≠ unclassified data error. It means "classification pending review."
--   New registrations always receive an explicit value from the registration API.
--
-- REQUIRED AFTER APPLYING THIS MIGRATION:
--   Step 1: Run scripts/migration-phase2-classification.cjs (read-only) to classify
--           existing providers.
--   Step 2: Apply the correction SQL for INDIVIDUAL_INSTRUCTOR (high confidence only).
--           See the classification script output for the exact IDs.
--   Step 3: REVIEW group records remain NULL until manually investigated.
--
-- ROLLBACK SAFETY:
--   BEFORE this migration: columns absent, rollback = no-op.
--   AFTER migration but BEFORE real registrations: DROP COLUMN is safe (only NULLs/defaults).
--   AFTER real registrations exist: DROP COLUMN destroys legal consent records.
--     Always back up consent data before dropping. See classification script for procedure.

ALTER TABLE "Provider"
  ADD COLUMN "organisationType"             TEXT,
  ADD COLUMN "commercialAgreementType"      TEXT,
  ADD COLUMN "commercialAgreementStatus"    TEXT         NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "commercialAgreementVersion"   TEXT,
  ADD COLUMN "commercialAgreementAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyPolicyVersion"         TEXT,
  ADD COLUMN "privacyPolicyAcceptedAt"      TIMESTAMP(3);
