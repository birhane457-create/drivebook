# Subscription Validation Call-Site Audit

**Version:** 1.0  
**Date:** 2026-11-14  
**Status:** COMPLETE - Findings documented  
**Cross-references:** 
- PHASE-4-API-ROUTES-AUDIT-v1.2.md (SUB-03)
- SUBSCRIPTION-MANAGEMENT-AUDIT.md (SUB-01)

---

## Executive Summary

Systematic audit of all `requireActiveSubscription()` and `checkSubscriptionAccess()` usage across the API surface. Found **6 API routes** using subscription validation, plus **1 additional route** and dashboard layout using direct checks.

**Critical Finding:** Multiple authorization inconsistencies exist beyond the central subscription helper that was fixed in c779522f. Provider deactivation (`isActive: false`) can be bypassed, and a second eligibility layer (`checkProviderEligible()`) does not implement the SaaS bypass.

---

## Call-Site Inventory

### API Routes Using `requireActiveSubscription()`

| Route | Method | Auth | Additional Gates | Notes |
|-------|--------|------|------------------|-------|
| `/api/bookings` | POST | Provider session | `approvalStatus === 'APPROVED'` | ✅ Checks approval |
| `/api/clients` | POST | Provider session | None | ⚠️ No approval check |
| `/api/instructor/profile` | PUT | Resolved provider session | None | ⚠️ No approval check |
| `/api/instructor/settings` | PUT | Resolved provider session | None | ⚠️ No approval check |
| `/api/bookings/offline` | POST | Provider session | Approval + PRO tier | ✅ Checks approval + tier |
| `/api/pda-tests` | POST | Provider session | Approval + eligibility | ✅ Uses `checkProviderEligible()` |
| `/api/bookings/batch` | POST | Provider session | Approval + `isActive` | ✅ Checks both |

### Routes Using `checkSubscriptionAccess()` Directly

| Route | Method | Usage | Notes |
|-------|--------|-------|-------|
| `/api/bookings/combined` | POST | Via `checkProviderEligible()` | Indirect usage |
| `/dashboard` layout | Page load | Read-only banner control | Presentation only, not write gate |

### Routes Using `checkProviderEligible()`

Separate eligibility function checks subscription independently:
- `/api/pda-tests`
- `/api/bookings/combined`
- `/api/public/bookings`
- `/api/bookings/mobile`
- `/api/public/bookings/bulk`

**Issue:** This function does NOT implement the SaaS bypass (see Finding #2).

---

## Critical Findings

### HIGH-1: Provider Deactivation Bypass

**Issue:** Admin can deactivate provider via `isActive: false` without changing `approvalStatus`, but some routes only check approval.

**Evidence:**

**Admin deactivation** (compliance endpoint):
```typescript
await prisma.provider.update({
  where: { id: providerId },
  data: { isActive: false } // approvalStatus unchanged
})
```

**Inconsistent checking:**
- `/api/bookings` POST: Checks `approvalStatus === 'APPROVED'` only (line 163)
- `/api/bookings/offline` POST: Checks `approvalStatus` only (does not fetch `isActive`)
- `/api/bookings/batch` POST: Checks both `approvalStatus` AND `isActive` ✅
- `/api/pda-tests`: Uses `checkProviderEligible()` which checks both ✅

**Impact:**
- Deactivated provider (`isActive: false`) can still create single bookings
- Deactivated provider can create offline bookings
- Compliance enforcement incomplete

**Recommendation:** All booking creation routes MUST check both:
```typescript
if (!instructor || instructor.approvalStatus !== 'APPROVED' || !instructor.isActive) {
  return NextResponse.json({ error: 'Provider not eligible' }, { status: 403 })
}
```

**Priority:** HIGH - Affects compliance enforcement

---

### HIGH-2: SaaS Bypass Not Applied to `checkProviderEligible()`

**Issue:** Second eligibility layer independently checks subscription without SaaS exception.

**Location:** `lib/utils/provider-eligibility.ts` (inferred from usage pattern)

**Current logic:**
```typescript
// checkProviderEligible() checks:
subscriptionStatus === 'ACTIVE' || (trial not expired)
```

**Missing:** SaaS + DIRECT bypass that exists in `requireActiveSubscription()`

**Routes Affected:**
- `/api/pda-tests` - Provider-operated
- `/api/bookings/combined` - Provider-operated
- `/api/bookings/mobile` - Provider-operated
- `/api/public/bookings` - Public/student-initiated (Marketplace)
- `/api/public/bookings/bulk` - Public (Marketplace)

**Inconsistency:**
- Provider passes `requireActiveSubscription()` (SaaS bypass)
- Same provider fails `checkProviderEligible()` (no bypass)
- PDA test creation rejected despite valid SaaS account

**Complexity:** Some affected routes are Marketplace-facing and SHOULD retain subscription checks. Provider-operated routes need policy decision.

**Recommendation:**
1. Add `businessModel` parameter to `checkProviderEligible()`
2. Apply SaaS bypass only for provider-operated flows
3. Preserve Marketplace restrictions for public booking flows

**Priority:** HIGH - Blocks SaaS provider functionality

---

### MEDIUM-3: Client Creation Lacks Approval Gate

**Issue:** POST `/api/clients` allows pending providers to create client records.

**Current gates:**
- ✅ Authentication (provider session)
- ✅ Subscription check (`requireActiveSubscription()`)
- ❌ No approval status check

**Impact:**
- Pending provider can add clients during exploration phase
- Creates User + ClientWallet for new clients
- Inconsistent with stated policy: "pending instructors limited to profile setup"

**Question for Policy Clarification:**
> Is client creation intended to be permitted before approval?

**If NO:** Add approval check:
```typescript
const instructor = await prisma.provider.findUnique({
  where: { userId: session.user.id },
  select: { approvalStatus: true, isActive: true }
})
if (instructor?.approvalStatus !== 'APPROVED' || !instructor.isActive) {
  return NextResponse.json({ error: 'Requires approval' }, { status: 403 })
}
```

**Priority:** MEDIUM - Policy clarification needed

---

### MEDIUM-4: Future FREE Tier Exclusion Logic Unsafe

**Issue:** Offline booking route uses negative exclusion instead of positive allowlist.

**Location:** `/api/bookings/offline`

**Current logic:**
```typescript
if (tier === 'BASIC') {
  return NextResponse.json({ error: 'PRO+ feature' }, { status: 403 })
}
```

**Problem:** When FREE tier is introduced, this check will NOT deny it.

**Impact:** FREE tier passes PRO+ gate unintentionally

**Recommendation:** Use explicit allowlist:
```typescript
const allowedTiers = ['PRO', 'PREMIUM', 'ENTERPRISE']
if (!allowedTiers.includes(tier)) {
  return NextResponse.json({ error: 'PRO+ feature' }, { status: 403 })
}
```

**Priority:** MEDIUM - Preventive fix for future tier system

---

### MEDIUM-5: Missing Provider Record Fails Open

**Issue:** When `Provider` record doesn't exist, subscription check returns full access.

**Location:** `lib/middleware/subscriptionValidation.ts` line 41-44

**Current logic:**
```typescript
if (!instructor) {
  // No instructor record — fail open, let page-level auth handle it
  return { valid: true, readOnly: false };
}
```

**Justification (from comment):** "Let page-level auth handle it"

**Issue:** Authenticated provider write routes (POST/PUT/DELETE) expect Provider record to exist. Missing record indicates data integrity issue, not auth issue.

**Impact:** Edge case, but authenticated user without Provider could get write access

**Recommendation:** Fail closed for write operations:
```typescript
if (!instructor) {
  return { valid: false, message: 'Provider record not found' };
}
```

**Alternative:** Keep fail-open but log warning for monitoring

**Priority:** MEDIUM - Edge case but should fail safe

---

## Assessment of c779522f Subscription Fixes

| Control | Status |
|---------|--------|
| SaaS bypass uses SAAS + DIRECT | ✅ **CORRECTED** |
| MARKETPLACE + DIRECT no longer triggers bypass | ✅ **CORRECTED** |
| Database error returns read-only | ✅ **CORRECTED** |
| Missing Provider record fails open | ⚠️ **STILL OPEN** (see Finding #5) |
| SaaS PREMIUM/FREE feature differentiation | ❌ **NOT IMPLEMENTED** |
| All enforcement layers use consistent policy | ❌ **NOT RESOLVED** (see Finding #2) |

**Note on DB error handling:** `readOnly: true` is intentional for preserving read access. `requireActiveSubscription()` and batch route correctly convert this to write denial. This is **working as designed**.

---

## Testing Gap

**No subscription validation regression tests found** in repository search.

Vercel build success establishes:
- ✅ TypeScript compilation passes
- ✅ No syntax errors
- ❌ Does NOT verify business logic
- ❌ Does NOT test subscription state combinations

**Recommendation:** Add test file:
```
__tests__/integration/subscription-validation.test.ts
```

**Test matrix required:**
| Business Model | Payment Mode | Subscription Status | Expected Access |
|----------------|--------------|---------------------|-----------------|
| MARKETPLACE | PLATFORM | TRIAL (active) | Full |
| MARKETPLACE | PLATFORM | TRIAL (expired) | Read-only |
| MARKETPLACE | PLATFORM | ACTIVE | Full |
| MARKETPLACE | PLATFORM | CANCELLED | Read-only |
| MARKETPLACE | DIRECT | (any) | Normal checks (no bypass) |
| SAAS | DIRECT | (any) | Full (bypass) |
| SAAS | PLATFORM | (any) | Normal checks (inconsistent state) |

**Additional tests:**
- `isActive: false` with `approvalStatus: APPROVED` → Denied
- `approvalStatus: PENDING` → Denied for bookings/clients
- Database error → Read-only access
- Missing Provider record → (Policy decision needed)

**Priority:** HIGH

---

## Recommended Action Order

| # | Action | Priority | Estimated Effort |
|---|--------|----------|------------------|
| 1 | Fix `isActive` enforcement in single/offline booking routes | HIGH | 30 min |
| 2 | Add `businessModel` parameter to `checkProviderEligible()` | HIGH | 1-2 hours |
| 3 | Apply SaaS bypass to provider-operated eligibility checks | HIGH | 30 min |
| 4 | Decide policy: Can pending providers create clients? | MEDIUM | 5 min decision |
| 5 | Implement policy decision for client creation | MEDIUM | 15 min |
| 6 | Change offline tier check to allowlist pattern | MEDIUM | 10 min |
| 7 | Decide fail-open vs fail-closed for missing Provider | MEDIUM | 5 min decision |
| 8 | Add subscription validation regression tests | HIGH | 2-3 hours |
| 9 | Continue Phase 4 API audit (272 routes remaining) | ONGOING | Multiple sessions |

---

## Outstanding Items (Not Addressed in This Audit)

### OTP Configuration
**Status:** NOT VERIFIED  
**Action:** Check production `OTP_HASH_SECRET` in Vercel env vars  
**Reference:** PHASE-4-API-ROUTES-AUDIT-v1.2.md Finding #2

### SUB-01: Trial Creation for SaaS
**Status:** OPEN (architectural)  
**Issue:** All providers get trial subscriptions regardless of business model  
**Reference:** SUBSCRIPTION-MANAGEMENT-AUDIT.md SUB-01

---

## Conclusion

The c779522f subscription fixes successfully closed the two identified security holes (OR logic, fail-open on DB error). However, authorization enforcement is **not yet consistent** across the API surface:

1. **Provider deactivation** can be bypassed (HIGH)
2. **Second eligibility layer** doesn't implement SaaS policy (HIGH)
3. **Client creation** policy unclear (MEDIUM - needs decision)
4. **Missing regression tests** (HIGH)

**Phase 4 is NOT complete** until these consistency issues are resolved.

---

**Version:** 1.0  
**Audit Completed:** 2026-11-14  
**No code changes made during this review**  
**Next:** Address HIGH priority findings before continuing Phase 4 route sweep
