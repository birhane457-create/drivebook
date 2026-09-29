# INFRA-SUB06A-TEST-01: SUB-06-A Behavioral Test Schema Alignment

**Status:** OPEN  
**Priority:** HIGH (blocks TEST-VERIFIED gate for Writers #5-12)  
**Created:** 2026-08-15  
**Blocker For:** SUB-06-A Writers #5, #6, #9, #10, #11, #12 behavioral verification

---

## Problem Statement

SUB-06-A behavioral verification tests cannot execute due to schema mismatches between test fixtures and actual Prisma schema. Test code assumes Provider/Subscription field contracts that don't match production schema.

**Impact:** Writers #5-12 remain at SOURCE-VERIFIED gate indefinitely without behavioral concurrency evidence.

---

## Concrete Schema Mismatches

### Provider Model Issues

**Test Assumption:**
```typescript
await prisma.provider.create({
  data: {
    userId: testUserId,                    // ❌ WRONG: no direct userId field
    stripeSubscriptionId: 'sub_test_123', // ❌ WRONG: field doesn't exist on Provider
  }
});
```

**Actual Schema (prisma/schema.prisma lines 66-191):**
- `userId` field exists but requires nested `user: { connect: { id: userId } }` relation syntax
- `stripeSubscriptionId` does NOT exist on Provider model
- Provider only has: `stripeCustomerId` (String?), `stripeAccountId` (String?)
- Required fields: `name` (String), `phone` (String), `hourlyRate` (Float)

**Error Evidence:**
```
PrismaClientValidationError: Unknown argument `userId`. Did you mean `user`?
PrismaClientValidationError: Unknown argument `stripeSubscriptionId`. Available options are marked with ?.
```

### Subscription Model Issues

**Test Assumption:**
```typescript
await prisma.subscription.create({
  data: {
    providerId: testProviderId,
    tier: 'PRO',
    status: 'ACTIVE',
    stripeSubscriptionId: 'sub_test',
    currentPeriodEnd: new Date(),
    // Missing required fields
  }
});
```

**Actual Schema (prisma/schema.prisma lines 422-450):**
- Required fields NOT provided by tests:
  - `monthlyAmount` (Decimal @db.Decimal(10, 2)) - REQUIRED
  - `billingCycle` (String) - REQUIRED
  - `currentPeriodStart` (DateTime) - REQUIRED

**Error Evidence:**
```
(No specific error yet captured - tests blocked by Provider issues first)
```

### User Model Issues

**Test Assumption:**
```typescript
await prisma.user.create({
  data: {
    email: 'test@example.com',
    hashedPassword: 'test-hash',  // ❌ WRONG: field name
    role: 'INSTRUCTOR',
  }
});
```

**Actual Schema:**
- Field is `password` (String), not `hashedPassword`

**Error Evidence:**
```
PrismaClientValidationError: Unknown argument `hashedPassword`. Available options are marked with ?.
```

---

## Root Cause Analysis

**Not a code defect.** The SUB-06-A implementations (Writers #5-12) are correct. The test infrastructure was created without inspecting the actual Prisma schema contracts.

**Test-fixture/schema contract misalignment:**
1. Tests assume simplified Provider creation (direct `userId`, `stripeSubscriptionId` fields)
2. Tests omit required Subscription fields (`monthlyAmount`, `billingCycle`, `currentPeriodStart`)
3. Tests use wrong User field name (`hashedPassword` vs `password`)

**Why this blocks verification:**
- Behavioral tests cannot execute → no production route exercised
- No concurrency/ownership evidence → cannot claim TEST-VERIFIED
- Source inspection alone insufficient (shows correct locks, not behavioral proof)

---

## Affected Test Files

1. `__tests__/integration/sub-06a-writer-05-manual-sync.test.ts` (commit 48f7ea94)
   - Status: Created but never successfully executed
   - Blocks: Writer #5 TEST-VERIFIED gate

2. Future test files for Writers #6, #9, #10, #11, #12 (not yet created)
   - Will encounter same schema mismatches if not preemptively fixed

---

## Resolution Requirements

### Option A: Fix Test Schema Compliance (Recommended)

Create test fixture helpers that match actual Prisma schema:

```typescript
// Test helper: createTestProvider()
async function createTestProvider(overrides = {}) {
  return prisma.provider.create({
    data: {
      name: 'Test Provider',
      phone: '+61400000000',
      hourlyRate: 100.00,
      subscriptionTier: 'PRO',
      subscriptionStatus: 'ACTIVE',
      stripeCustomerId: 'cus_test',
      ...overrides,
    },
  });
}

// Test helper: createTestSubscription()
async function createTestSubscription(providerId, overrides = {}) {
  return prisma.subscription.create({
    data: {
      providerId,
      tier: 'PRO',
      status: 'ACTIVE',
      stripeSubscriptionId: 'sub_test',
      monthlyAmount: 49.00,              // REQUIRED
      billingCycle: 'monthly',           // REQUIRED
      currentPeriodStart: new Date(),    // REQUIRED
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ...overrides,
    },
  });
}
```

**Verification:**
1. Extract actual required fields from `prisma/schema.prisma`
2. Create fixture helpers matching production contracts
3. Update existing Writer #5 test
4. Execute Writer #5 test → verify passes
5. Use same helpers for Writers #6, #9-12 tests

### Option B: Simplify Prisma Schema for Tests

Make test-only fields optional (NOT RECOMMENDED - makes test environment non-representative).

---

## Relationship to INFRA-SUB06A-DB-01

**INFRA-SUB06A-DB-01:** Test database missing Prisma schema columns (`Subscription.lastWebhookEventId`, etc.)  
**INFRA-SUB06A-TEST-01:** Test fixtures don't match Prisma schema field contracts

**Different root causes:**
- DB-01: Production schema → test database synchronization failure
- TEST-01: Test code → Prisma schema contract misalignment

**Resolution order:**
1. Fix TEST-01 first (test code alignment with schema)
2. Then address DB-01 (database schema sync)

Both must be resolved before Writers #4-12 can achieve TEST-VERIFIED.

---

## Acceptance Criteria

1. ✅ Test fixture helpers created matching actual Prisma schema
2. ✅ Writer #5 test executes without Prisma validation errors
3. ✅ Writer #5 test exercises production sync route with concurrency
4. ✅ Test results show behavioral evidence of Provider-first locking
5. ✅ Fixture helpers documented for Writers #6, #9-12 test creation

---

## Current Workaround

**None.** Writers #5-12 remain at SOURCE-VERIFIED gate until schema alignment complete.

**Manual verification alternative:** Production observation logs showing concurrent request serialization (not automated test evidence).

---

## References

- **Prisma Schema:** `prisma/schema.prisma`
- **Writer #5 Test:** `__tests__/integration/sub-06a-writer-05-manual-sync.test.ts` (commit 48f7ea94)
- **Writer #5 Implementation:** `app/api/instructor/subscription/sync/route.ts` (SOURCE-VERIFIED)
- **Related Blocker:** INFRA-SUB06A-DB-01 (separate database schema sync issue)
