-- AUDIT-03: AuditLog immutability — BEFORE DELETE trigger
--
-- Finding: AuditLog rows had no database-level delete protection. Any code path
-- with DB access could delete audit records, compromising the integrity of the
-- audit trail. No application-layer route exploited this, but the architectural
-- gap existed.
--
-- Fix: A PostgreSQL BEFORE DELETE trigger that unconditionally raises an
-- exception. This is the correct layer: it cannot be bypassed by ORM operations,
-- $executeRaw, raw psql sessions, or future code that obtains a DB connection.
--
-- Design decisions (see docs/audit/AUDIT-MASTER-TRACKER.md AUDIT-03):
--   - Trigger fires unconditionally — no session/user/role exception
--   - No testOnly bypass column or conditional logic
--   - Trigger function is reusable (SECURITY DEFINER not required — raise_exception
--     does not need elevated privileges)
--   - ON DELETE RESTRICT at the FK level would not help here (AuditLog has no
--     parent FK — it is a standalone append-only table)
--
-- Test teardown impact: four test files previously called auditLog.deleteMany()
-- for cleanup. Those calls are removed in the same commit (test data is isolated
-- by unique timestamp prefixes — physical cleanup is not required for isolation).
--
-- Verification: scripts/verify-audit03-trigger.mjs
--   Confirms: ORM delete → trigger error, row persists
--   Confirms: deleteMany → trigger error, rows persist
--   Confirms: raw SQL DELETE → trigger error, rows persist (database-level proof)

-- Step 1: Create the trigger function
-- The function raises an exception with a message that identifies the invariant.
-- RETURNS TRIGGER is required for BEFORE triggers; returning NULL would suppress
-- the delete (same effect as the exception here, but exception gives better diagnostics).
CREATE OR REPLACE FUNCTION prevent_auditlog_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog records are immutable and cannot be deleted (AUDIT-03)';
END;
$$;

-- Step 2: Attach the trigger to the AuditLog table
-- BEFORE DELETE fires before the row is removed, allowing the exception to abort
-- the operation cleanly. FOR EACH ROW means it fires once per row, so even a
-- DELETE WHERE ... affecting multiple rows is fully blocked.
CREATE TRIGGER audit03_prevent_auditlog_delete
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_auditlog_delete();
