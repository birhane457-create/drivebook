# SUB-22 Concurrency Test Setup

## Quick Start

```powershell
.\test-sub-22.ps1
```

This script will:
1. Start isolated PostgreSQL container
2. Wait for database readiness
3. Run Prisma migrations
4. Verify partial unique indexes exist with correct predicates
5. Execute SUB-22 concurrency tests
6. Display results

## Manual Steps

If you prefer to run steps individually:

### 1. Start PostgreSQL
```powershell
docker-compose -f docker-compose.test.yml up -d
```

### 2. Wait for readiness
```powershell
docker exec drivebook-test-db pg_isready -U testuser -d drivebook_test
```

### 3. Apply migrations
```powershell
$env:DATABASE_URL = "postgresql://testuser:testpass@localhost:5433/drivebook_test"
npx prisma migrate deploy
```

### 4. Verify indexes
```powershell
docker exec -it drivebook-test-db psql -U testuser -d drivebook_test
```

Then run:
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'Subscription' 
  AND indexname LIKE '%unique%'
ORDER BY indexname;
```

Expected indexes:
- `Subscription_provider_current_unique` with `WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')`
- `Subscription_stripeSubscriptionId_unique` with `WHERE stripeSubscriptionId IS NOT NULL`

### 5. Run tests
```powershell
# Load environment
Get-Content .env.test | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
}

# Run tests
npm test sub-22-concurrent
```

## Test Database Management

### Inspect database
```powershell
docker exec -it drivebook-test-db psql -U testuser -d drivebook_test
```

Useful queries:
```sql
-- Check subscriptions
SELECT id, "providerId", "stripeSubscriptionId", status, "createdAt" 
FROM "Subscription" 
ORDER BY "createdAt" DESC 
LIMIT 20;

-- Check webhook events
SELECT "idempotencyKey", "eventType", "createdAt" 
FROM "WebhookEvent" 
ORDER BY "createdAt" DESC 
LIMIT 20;

-- Verify no duplicate current subscriptions per provider
SELECT "providerId", status, COUNT(*) 
FROM "Subscription" 
WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
GROUP BY "providerId", status 
HAVING COUNT(*) > 1;
```

### Stop database (preserve data)
```powershell
docker-compose -f docker-compose.test.yml stop
```

### Start again
```powershell
docker-compose -f docker-compose.test.yml start
```

### Stop and remove everything
```powershell
docker-compose -f docker-compose.test.yml down -v
```

## What the Tests Verify

1. **Concurrent same Stripe ID**: Two webhooks (created + updated) with same Stripe subscription ID arrive simultaneously
   - Expected: One subscription row, both webhooks recorded, no duplicates
   
2. **Exact replay**: Same event sent twice (idempotency test)
   - Expected: Processed once, second attempt returns 200 with idempotent response

3. **Concurrent different Stripe IDs**: Two webhooks with different Stripe IDs for same provider
   - Expected: P2002 error, second webhook returns 409, only first ID persists

4. **Triple concurrency**: Three webhooks arrive simultaneously
   - Expected: No race conditions, final state consistent

5. **Invalid signature**: Webhook with bad Stripe signature
   - Expected: 400 error, no database changes

## Critical P2002 Question

The test will expose whether the P2002 recovery logic works:

```typescript
try {
  const updateResult = await tx.subscription.updateMany({...});
  if (updateResult.count === 0) {
    // No rows matched - another transaction won
  }
} catch (err: any) {
  if (err.code === 'P2002' || err.code === '23505') {
    // ⚠️ CRITICAL: Can we query tx after P2002?
    const existingRow = await tx.subscription.findFirst({...});
    if (existingRow.stripeSubscriptionId !== newId) {
      throw new Error('Conflict: different Stripe ID');
    }
  }
}
```

**Question**: Does `tx.subscription.findFirst()` work after catching P2002 in the same SERIALIZABLE transaction, or does PostgreSQL abort the transaction block?

If the test fails with transaction errors, we need to restructure the P2002 handling (likely moving the conflict check outside the transaction or using a separate connection).

## Files

- `docker-compose.test.yml` - PostgreSQL container definition
- `.env.test` - Test environment variables (safe to commit)
- `test-sub-22.ps1` - Automated test runner
- `app/api/stripe/webhook/__tests__/sub-22-concurrent.test.ts` - Test suite

## After Tests Pass

Only after all tests pass with the expected behavior should we:
1. Apply the migration to production
2. Monitor production webhooks for P2002 errors
3. Verify no duplicate subscriptions are created
