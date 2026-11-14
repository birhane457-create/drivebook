# Subscription Call-Site Audit - Complete

**Date:** 2026-11-14  
**Status:** ✅ AUDIT COMPLETE - Awaiting fix implementation approval

---

## What Was Completed

### ✅ Comprehensive Call-Site Inventory
- Found **6 API routes** using `requireActiveSubscription()`
- Found **5 additional routes** using `checkProviderEligible()`
- Found **1 dashboard layout** using direct subscription checks
- Documented all authorization gates and their combinations

### ✅ Critical Findings Identified

**2 HIGH Priority Issues:**
1. **Provider deactivation bypass** - `isActive: false` not checked consistently
2. **SaaS bypass missing** from secondary eligibility layer

**3 MEDIUM Priority Issues:**
3. Client creation lacks approval gate (policy decision needed)
4. Future FREE tier will bypass PRO+ checks (unsafe exclusion logic)
5. Missing Provider record fails open (should fail closed)

### ✅ Documentation Delivered

1. **SUBSCRIPTION-VALIDATION-CALL-SITE-AUDIT.md** - Complete findings with evidence
2. **SUBSCRIPTION-FIXES-PROPOSAL.md** - Implementation guide with code samples
3. **Test requirements** - Unit and integration test specifications

---

## Key Discoveries

### 1. Authorization is Multi-Layered (Inconsistently)

```
Request → Authentication → Subscription → Approval → Active Status → Tier
                              ↓                                        ↓
                    requireActiveSubscription()          checkProviderEligible()
```

**Problem:** The two subscription layers don't share the same business model logic.

### 2. c779522f Fixes Were Necessary But Insufficient

| What c779522f Fixed | What Remains Broken |
|---------------------|---------------------|
| ✅ SaaS bypass OR→AND logic | ❌ Second eligibility layer doesn't know about SaaS |
| ✅ DB error fail-closed | ❌ Missing provider still fails open |
| ✅ Consistent MARKETPLACE+DIRECT handling | ❌ Active status checks inconsistent |

### 3. No Regression Tests Exist

- Vercel build success ≠ business logic correctness
- Need test coverage for all business model + subscription state combinations
- Test matrix includes 8+ combinations (see proposal document)

---

## Immediate Next Steps (Your Decision Required)

### Policy Decisions Needed

**Question 1:** Should pending providers be allowed to create clients?
- ⬜ YES - Allow client creation before approval (current behavior)
- ⬜ NO - Require approval first (recommended - aligns with booking restrictions)

**Question 2:** Should missing Provider record fail closed?
- ⬜ YES - Deny access, require support contact (recommended for write ops)
- ⬜ NO - Keep fail-open with monitoring/alerting (current behavior)

**Question 3:** Implementation approach?
- ⬜ OPTION A - Fix all HIGH issues now (~4-5 hours including tests)
- ⬜ OPTION B - Fix #1 (isActive) immediately, defer #2 (eligibility refactor) to next session
- ⬜ OPTION C - Pause fixes, continue Phase 4 audit, batch-fix later

---

## Files Ready for Implementation

If you approve Option A (fix all HIGH issues now):

**Files to modify:**
1. `app/api/bookings/route.ts` - Add isActive check
2. `app/api/bookings/offline/route.ts` - Add isActive check + selection
3. `app/api/clients/route.ts` - Add approval gate (if policy = require)
4. `lib/utils/provider-eligibility.ts` - Add context parameter + SaaS logic
5. `app/api/pda-tests/route.ts` - Update call with context='provider'
6. `app/api/bookings/combined/route.ts` - Update call with context='provider'
7. `app/api/bookings/mobile/route.ts` - Update call with context='provider'
8. `app/api/public/bookings/route.ts` - Update call with context='marketplace'
9. `app/api/public/bookings/bulk/route.ts` - Update call with context='marketplace'

**Test files to create:**
1. `__tests__/unit/subscription-validation.test.ts`
2. `__tests__/integration/booking-authorization.test.ts`

---

## Outstanding Issues (Not in This Audit)

### From Previous Audits

1. **OTP_HASH_SECRET** verification - Not done
2. **SUB-01** trial creation for SaaS - Architectural issue, not addressed
3. **Phase 4 continuation** - 272 routes remaining (paused per your instruction)

---

## Recommendations

### My Recommendation: Option B (Partial Fix Now)

**Why:**
1. **Fix #1 (isActive) is critical** for compliance - 30 min fix
2. **Fix #2 (eligibility refactor)** is complex - affects 9 files + tests
3. **Better to fix incrementally** and test each layer

**Suggested sequence:**
1. **Now:** Fix isActive checks + write focused tests (1 hour)
2. **Next session:** Refactor eligibility layer + comprehensive tests (3-4 hours)
3. **Then:** Resume Phase 4 audit with consistent enforcement

### Alternative: Option A (Fix All Now)

**If you want everything fixed before continuing Phase 4:**
- All HIGH issues resolved in single commit
- Full test coverage
- ~4-5 hours total time
- Clean foundation for Phase 4 continuation

---

## Approval Checklist

Please indicate your decisions:

**Policy:**
- [ ] Client creation requires approval: YES / NO
- [ ] Missing provider fails closed: YES / NO

**Implementation:**
- [ ] Option A - Fix all HIGH now (~4-5 hours)
- [ ] Option B - Fix isActive now, refactor eligibility next session
- [ ] Option C - Defer all fixes, continue Phase 4 audit

**Testing:**
- [ ] Write tests before fixes (TDD approach)
- [ ] Write tests after fixes (verification approach)
- [ ] Defer tests to separate testing session

---

**Status:** ✅ Audit complete, awaiting implementation approval  
**Ready to proceed:** When you provide policy decisions  
**Documents:** All audit findings and implementation proposals delivered
