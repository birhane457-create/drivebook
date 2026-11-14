# Subscription Validation Fixes - Implementation Proposal

**Date:** 2026-11-14  
**Cross-ref:** SUBSCRIPTION-VALIDATION-CALL-SITE-AUDIT.md  
**Status:** PROPOSAL - Awaiting approval

---

## HIGH Priority Fixes (Required Before Phase 4 Continuation)

### Fix 1: Add `isActive` Check to Booking Routes (30 min)

**Issue:** Deactivated providers can still create bookings

**Files to modify:**
1. `app/api/bookings/route.ts` (single booking)
2. `app/api/bookings/offline/route.ts` (offline booking)

**Change:**
```typescript
// Current (line ~163 in bookings/route.ts)
const instructor = await prisma.provider.findUnique({
  where: { id: providerId },
  select: { approvalStatus: true, isActive: true }  // Already selects isActive
})
if (instructor?.approvalStatus !== 'APPROVED') {
  return NextResponse.json({
    error: 'Your account is pending approval...',
    requiresApproval: true,
  }, { status: 403 })
}

// Fixed
if (!instructor || instructor.approvalStatus !== 'APPROVED' || !instructor.isActive) {
  return NextResponse.json({
    error: 'Your account is not eligible to create bookings.',
    requiresApproval: instructor?.approvalStatus !== 'APPROVED',
    requiresActivation: !instructor?.isActive,
  }, { status: 403 })
}
```

**Apply to:**
- `app/api/bookings/route.ts` line ~163
- `app/api/bookings/offline/route.ts` (needs `isActive` added to select + check)

**Test:**
1. Set provider `isActive: false` with `approvalStatus: APPROVED`
2. Attempt POST `/api/bookings` → Expect 403
3. Attempt POST `/api/bookings/offline` → Expect 403

---

### Fix 2: Add SaaS Bypass to `checkProviderEligible()` (1-2 hours)

**Issue:** Second eligibility layer doesn't implement SaaS policy

**File:** `lib/utils/provider-eligibility.ts` (or wherever this function lives)

**Current signature (inferred):**
```typescript
function checkProviderEligible(provider: Provider): boolean
```

**New signature:**
```typescript
type EligibilityContext = 'provider' | 'marketplace'

function checkProviderEligible(
  provider: Provider,
  context: EligibilityContext = 'marketplace'
): { eligible: boolean; reason?: string }
```

**Implementation:**
```typescript
export function checkProviderEligible(
  provider: Pick<Provider, 'subscriptionStatus' | 'trialEndsAt' | 'approvalStatus' | 'isActive' | 'businessModel' | 'paymentMode'>,
  context: EligibilityContext = 'marketplace'
): { eligible: boolean; reason?: string } {
  
  // Check approval and active status (universal)
  if (provider.approvalStatus !== 'APPROVED') {
    return { eligible: false, reason: 'Provider not approved' }
  }
  if (!provider.isActive) {
    return { eligible: false, reason: 'Provider deactivated' }
  }

  // SaaS bypass (provider-operated flows only)
  if (context === 'provider' && provider.businessModel === 'SAAS' && provider.paymentMode === 'DIRECT') {
    return { eligible: true }
  }

  // Marketplace subscription checks (always for marketplace context, fallback for provider context)
  const { subscriptionStatus, trialEndsAt } = provider
  
  if (subscriptionStatus === 'ACTIVE') {
    return { eligible: true }
  }
  
  if (subscriptionStatus === 'TRIAL') {
    const trialExpired = trialEndsAt && new Date(trialEndsAt) < new Date()
    if (!trialExpired) {
      return { eligible: true }
    }
    return { eligible: false, reason: 'Trial expired' }
  }
  
  return { eligible: false, reason: 'No active subscription' }
}
```

**Update call sites:**

**Provider-operated (use context: 'provider'):**
```typescript
// app/api/pda-tests/route.ts
const eligibility = checkProviderEligible(provider, 'provider')

// app/api/bookings/combined/route.ts  
const eligibility = checkProviderEligible(provider, 'provider')

// app/api/bookings/mobile/route.ts
const eligibility = checkProviderEligible(provider, 'provider')
```

**Marketplace-facing (use context: 'marketplace' or default):**
```typescript
// app/api/public/bookings/route.ts
const eligibility = checkProviderEligible(provider, 'marketplace')

// app/api/public/bookings/bulk/route.ts
const eligibility = checkProviderEligible(provider, 'marketplace')
```

**Test:**
1. SaaS provider with expired trial + context='provider' → Eligible
2. SaaS provider with expired trial + context='marketplace' → Not eligible
3. Marketplace provider with expired trial → Not eligible (both contexts)

---

### Fix 3: Client Creation Approval Gate (15 min - IF policy = "require approval")

**Policy Decision Required:**
> Should pending providers be allowed to create clients during profile setup?

**Option A: Require Approval (Recommended)**
```typescript
// app/api/clients/route.ts (add after subscription check)
const provider = await prisma.provider.findUnique({
  where: { userId: session.user.id },
  select: { approvalStatus: true, isActive: true }
})

if (!provider || provider.approvalStatus !== 'APPROVED' || !provider.isActive) {
  return NextResponse.json({
    error: 'Client management requires approved provider status.',
    requiresApproval: true,
  }, { status: 403 })
}
```

**Option B: Allow for Exploration**
- No change needed
- Document as intentional policy
- Add comment explaining rationale

**Recommendation:** Option A - Align with booking restrictions

**Test:**
1. Pending provider attempts POST `/api/clients` → Expect 403
2. Approved provider → Success

---

## MEDIUM Priority Fixes (Can Defer to Next Session)

### Fix 4: Change Offline Tier Check to Allowlist (10 min)

**File:** `app/api/bookings/offline/route.ts`

**Change:**
```typescript
// Current
if (tier === 'BASIC') {
  return NextResponse.json({ error: 'PRO+ feature' }, { status: 403 })
}

// Fixed
const OFFLINE_BOOKING_TIERS = ['PRO', 'PREMIUM', 'ENTERPRISE']
if (!OFFLINE_BOOKING_TIERS.includes(tier)) {
  return NextResponse.json({ 
    error: 'Offline bookings require PRO tier or higher',
    currentTier: tier,
    requiredTiers: OFFLINE_BOOKING_TIERS,
  }, { status: 403 })
}
```

**Benefit:** Future-proof for FREE tier introduction

---

### Fix 5: Missing Provider Record Fail-Closed (5 min decision + 10 min implementation)

**Policy Decision Required:**
> Should missing Provider record fail open (current) or fail closed?

**Option A: Fail Closed (Recommended for write operations)**
```typescript
// lib/middleware/subscriptionValidation.ts line 41-44
if (!instructor) {
  console.warn('[SUBSCRIPTION] Missing provider record for authenticated user', { userId })
  return { valid: false, message: 'Provider profile not found. Please contact support.' }
}
```

**Option B: Keep Fail-Open with Monitoring**
```typescript
if (!instructor) {
  console.error('[SUBSCRIPTION] Missing provider record for authenticated user', { userId })
  // Alert monitoring system
  await sendAlert({
    type: 'DATA_INTEGRITY',
    severity: 'WARNING',
    message: `Authenticated user ${userId} has no Provider record`,
  })
  return { valid: true, readOnly: false }
}
```

**Recommendation:** Option A for write operations (booking/client creation), Option B for read operations (dashboard)

---

## Testing Requirements

### Unit Tests
```typescript
// __tests__/unit/subscription-validation.test.ts
describe('requireActiveSubscription', () => {
  it('allows SAAS + DIRECT providers', async () => {
    const result = await requireActiveSubscription(saasProviderId)
    expect(result.valid).toBe(true)
  })
  
  it('fails on DB error with read-only', async () => {
    mockPrismaError()
    const result = await requireActiveSubscription(userId)
    expect(result.valid).toBe(false)
    expect(result.message).toContain('try again')
  })
  
  it('denies MARKETPLACE + DIRECT inconsistent state', async () => {
    const result = await requireActiveSubscription(inconsistentProviderId)
    expect(result.valid).toBe(false)
  })
})

describe('checkProviderEligible', () => {
  it('applies SaaS bypass for provider context', () => {
    const result = checkProviderEligible(saasProvider, 'provider')
    expect(result.eligible).toBe(true)
  })
  
  it('checks subscription for marketplace context', () => {
    const result = checkProviderEligible(saasProviderExpiredTrial, 'marketplace')
    expect(result.eligible).toBe(false)
  })
})
```

### Integration Tests
```typescript
// __tests__/integration/booking-authorization.test.ts
describe('POST /api/bookings', () => {
  it('denies deactivated provider', async () => {
    await setProviderInactive(providerId)
    const response = await POST('/api/bookings', bookingData, providerToken)
    expect(response.status).toBe(403)
    expect(response.body.requiresActivation).toBe(true)
  })
  
  it('allows SaaS provider with expired trial', async () => {
    const response = await POST('/api/bookings', bookingData, saasProviderToken)
    expect(response.status).toBe(201)
  })
})
```

---

## Implementation Order

**Immediate (before continuing Phase 4):**
1. Fix 1: `isActive` checks (30 min)
2. Policy decision: Client creation approval requirement (5 min)
3. Fix 3: Implement client creation policy (15 min)
4. Fix 2: `checkProviderEligible()` SaaS bypass (1-2 hours)
5. Write and run tests (2-3 hours)

**Total time:** ~4-5 hours for HIGH priority fixes + tests

**Defer to next session:**
- Fix 4: Offline tier allowlist
- Fix 5: Missing provider fail-closed

---

## Approval Required

Before implementing, please confirm:

1. ✅ or ❌ Client creation should require approval?
2. ✅ or ❌ Missing Provider record should fail closed?
3. ✅ or ❌ Proceed with all HIGH priority fixes in single commit?
4. ✅ or ❌ Write tests before or after fixes?

---

**Status:** AWAITING APPROVAL  
**Next:** Implement approved fixes → Test → Commit → Resume Phase 4
