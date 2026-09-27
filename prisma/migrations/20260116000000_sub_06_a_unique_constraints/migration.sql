-- SUB-06-A: Add unique constraints for Provider.stripeCustomerId and Subscription.stripeSubscriptionId
-- Rev 7 requirement: Enforce database-level uniqueness for Stripe identifiers

-- Step 1: Detect and report existing duplicates for Provider.stripeCustomerId
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
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
BEGIN
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
-- Only reached if no duplicates were found
ALTER TABLE "Provider" 
  ADD CONSTRAINT "Provider_stripeCustomerId_key" 
  UNIQUE ("stripeCustomerId");

-- Step 4: Add unique constraint for Subscription.stripeSubscriptionId
ALTER TABLE "Subscription" 
  ADD CONSTRAINT "Subscription_stripeSubscriptionId_key" 
  UNIQUE ("stripeSubscriptionId");

-- Log successful migration
DO $$
BEGIN
  RAISE NOTICE 'SUB-06-A MIGRATION COMPLETE: Unique constraints added successfully';
  RAISE NOTICE '  - Provider.stripeCustomerId is now UNIQUE';
  RAISE NOTICE '  - Subscription.stripeSubscriptionId is now UNIQUE';
END $$;
