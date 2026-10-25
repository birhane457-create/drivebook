-- SUB-06-A: Add unique constraints for Provider.stripeCustomerId and Subscription.stripeSubscriptionId
-- Rev 7 requirement: Enforce database-level uniqueness for Stripe identifiers
--
-- MIG-CHAIN-01 FIX: On a clean database, this migration runs BEFORE the init
-- migration (20260328041651) that creates the Provider and Subscription tables.
-- The original code assumed the tables already existed. Guard every section
-- with a table-existence check so the migration is safe for both:
--   - Existing databases: tables exist → run duplicate checks + add constraints
--   - Clean databases: tables don't exist yet → skip (init will create them
--     with the constraints from the Prisma schema)

-- Step 1: Detect and report existing duplicates for Provider.stripeCustomerId
DO $$
DECLARE
  duplicate_count INTEGER;
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Provider') THEN
    RAISE NOTICE 'SUB-06-A MIGRATION: Provider table does not exist yet, skipping duplicate check (init migration will create it)';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "stripeCustomerId", COUNT(*) as cnt
    FROM "Provider"
    WHERE "stripeCustomerId" IS NOT NULL
    GROUP BY "stripeCustomerId"
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE NOTICE 'SUB-06-A MIGRATION WARNING: Found % duplicate stripeCustomerId values in Provider table', duplicate_count;
    RAISE NOTICE 'Duplicate stripeCustomerId values:';
    
    -- Log all duplicates
    FOR r IN (
      SELECT "stripeCustomerId", COUNT(*) as cnt
      FROM "Provider"
      WHERE "stripeCustomerId" IS NOT NULL
      GROUP BY "stripeCustomerId"
      HAVING COUNT(*) > 1
    ) LOOP
      RAISE NOTICE '  stripeCustomerId: %, count: %', r."stripeCustomerId", r.cnt;
    END LOOP;
    
    -- Fail migration if duplicates exist
    RAISE EXCEPTION 'SUB-06-A MIGRATION BLOCKED: Cannot add UNIQUE constraint while duplicates exist. Manual resolution required.';
  ELSE
    RAISE NOTICE 'SUB-06-A MIGRATION: No duplicate stripeCustomerId values found in Provider table';
  END IF;
END $$;

-- Step 2: Detect and report existing duplicates for Subscription.stripeSubscriptionId
DO $$
DECLARE
  duplicate_count INTEGER;
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Subscription') THEN
    RAISE NOTICE 'SUB-06-A MIGRATION: Subscription table does not exist yet, skipping duplicate check (init migration will create it)';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "stripeSubscriptionId", COUNT(*) as cnt
    FROM "Subscription"
    WHERE "stripeSubscriptionId" IS NOT NULL
    GROUP BY "stripeSubscriptionId"
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE NOTICE 'SUB-06-A MIGRATION WARNING: Found % duplicate stripeSubscriptionId values in Subscription table', duplicate_count;
    RAISE NOTICE 'Duplicate stripeSubscriptionId values:';
    
    -- Log all duplicates with Provider context
    FOR r IN (
      SELECT s."stripeSubscriptionId", COUNT(*) as cnt, 
             STRING_AGG(DISTINCT p."stripeCustomerId", ', ') as customer_ids
      FROM "Subscription" s
      JOIN "Provider" p ON s."providerId" = p.id
      WHERE s."stripeSubscriptionId" IS NOT NULL
      GROUP BY s."stripeSubscriptionId"
      HAVING COUNT(*) > 1
    ) LOOP
      RAISE NOTICE '  stripeSubscriptionId: %, count: %, associated stripeCustomerIds: %', 
        r."stripeSubscriptionId", r.cnt, r.customer_ids;
    END LOOP;
    
    -- Fail migration if duplicates exist
    RAISE EXCEPTION 'SUB-06-A MIGRATION BLOCKED: Cannot add UNIQUE constraint while duplicates exist. Manual resolution required.';
  ELSE
    RAISE NOTICE 'SUB-06-A MIGRATION: No duplicate stripeSubscriptionId values found in Subscription table';
  END IF;
END $$;

-- Step 3: Add unique constraint for Provider.stripeCustomerId
-- Guard: skip if table doesn't exist (clean database) or constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Provider') THEN
    RAISE NOTICE 'SUB-06-A MIGRATION: Provider table does not exist yet, skipping constraint (init migration will handle it)';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Provider_stripeCustomerId_key') THEN
    RAISE NOTICE 'SUB-06-A MIGRATION: Provider_stripeCustomerId_key constraint already exists, skipping';
    RETURN;
  END IF;
  ALTER TABLE "Provider" ADD CONSTRAINT "Provider_stripeCustomerId_key" UNIQUE ("stripeCustomerId");
  RAISE NOTICE 'SUB-06-A MIGRATION: Added Provider_stripeCustomerId_key constraint';
END $$;

-- Step 4: Add unique constraint for Subscription.stripeSubscriptionId
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Subscription') THEN
    RAISE NOTICE 'SUB-06-A MIGRATION: Subscription table does not exist yet, skipping constraint (init migration will handle it)';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_stripeSubscriptionId_key') THEN
    RAISE NOTICE 'SUB-06-A MIGRATION: Subscription_stripeSubscriptionId_key constraint already exists, skipping';
    RETURN;
  END IF;
  ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_stripeSubscriptionId_key" UNIQUE ("stripeSubscriptionId");
  RAISE NOTICE 'SUB-06-A MIGRATION: Added Subscription_stripeSubscriptionId_key constraint';
END $$;

-- Log successful migration
DO $$
BEGIN
  RAISE NOTICE 'SUB-06-A MIGRATION COMPLETE: Unique constraints processed successfully';
  RAISE NOTICE '  - Provider.stripeCustomerId unique constraint handled';
  RAISE NOTICE '  - Subscription.stripeSubscriptionId unique constraint handled';
END $$;
