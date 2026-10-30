-- WLA-007 FIX: Partial unique index on Provider.customDomain WHERE domainVerified = true
--
-- Ensures at most ONE provider can have any given customDomain verified at any time.
-- A concurrent claim that tries to set domainVerified=true on the same customDomain
-- while another provider already has it verified will fail with a P2002 constraint
-- violation, which the route handler catches and returns as 409.
--
-- This is the only reliable way to prevent the race condition between the pre-write
-- ownership check (findFirst) and the domain claim (update). The DNS lookup takes
-- 100-500ms, which is too long for a serializable transaction to remain open.
--
-- Note: customDomain can be set to a value without domainVerified=true (pending
-- verification). Multiple providers can have the same customDomain value pending
-- — only the verified state is unique.

CREATE UNIQUE INDEX IF NOT EXISTS "Provider_customDomain_domainVerified_unique"
ON "Provider" ("customDomain")
WHERE "domainVerified" = true;
