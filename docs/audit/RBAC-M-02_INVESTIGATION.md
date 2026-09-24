# RBAC-M-02 Investigation: Admin Route Authorization Audit

**Status:** IN PROGRESS — Phase 1 (Inventory)  
**Finding:** CONFIRMED (role checks instead of permission checks in admin routes)  
**Risk:** MEDIUM  
**Started:** 2026-09-24

---

## Investigation Workflow

**Phase 1:** Admin API Inventory ← **CURRENT**  
**Phase 2:** Authorization Matrix Construction  
**Phase 3:** Distinguish Legitimate vs Defective Checks  
**Phase 4:** Hostile Baseline Tests  
**Phase 5:** Design Remediation

---

## Phase 1: Admin API Route Inventory

**Total admin routes identified:** 73

**Authorization pattern analysis:**
- `requirePermission` occurrences: **118**
- `requireRole()` calls: **0**
- `requireAdmin()` calls: **0**
- `requireSuperAdmin()` calls: **0**
- Direct `role === 'SUPER_ADMIN'` checks: **0**

### Sample Routes Verified

| Route | Authorization Check | Permission Used | Status |
|-------|---------------------|-----------------|--------|
| `/admin/revenue` | `requirePermission` | `PERM.FINANCE_REVENUE_VIEW` | ✅ Correct |
| `/admin/payouts/process` | `requirePermission` | `PERM.FINANCE_PAYOUTS_PROCESS` | ✅ Correct |
| `/admin/clients/[id]/wallet/deduct-credit` | `checkPermission` | `PERM.USERS_CUSTOMERS_WALLET_DEDUCT` | ✅ Correct |
| `/admin/audit-log` | `requirePermission` | `PERM.OPERATIONS_AUDIT_LOG_VIEW` | ✅ Correct |
| `/admin/booking-payment-status` | `requirePermission` | `PERM.OPERATIONS_BOOKINGS_VIEW` | ✅ Correct |

---

## Phase 1 Conclusion

**Finding Status:** RBAC-M-02 has been **REMEDIATED** between the original Phase 1 audit and this investigation.

**Historical Evidence:**
- Original Phase 1 finding (PHASE1_REMEDIATION_REGISTER.md line 57): *"Example: `app/admin/revenue/route.ts` checks `role === 'SUPER_ADMIN'` instead of `requirePermission(PERM.FINANCIAL_REPORTS_VIEW)`"*
- Current state (verified 2026-09-24): `/admin/revenue/route.ts` uses `requirePermission(session, PERM.FINANCE_REVENUE_VIEW)`
- **Conclusion:** The finding was valid when filed, but has been fixed since then.

**Current Evidence:**
1. All sampled admin routes use permission-based authorization (`requirePermission` / `checkPermission`)
2. No role-based checks (`requireAdmin`, `requireSuperAdmin`, `role === 'SUPER_ADMIN'`) found in any of the 73 admin routes
3. The authorization helper library (`lib/auth/requireRole.ts`) provides both role-based and permission-based functions, but only the permission-based functions are being used in admin routes
4. 118 occurrences of `requirePermission` across admin routes suggests systematic adoption of the permission model

**Verification Gap:**
Hostile baseline tests (Phase 4) have not been executed to prove that:
- ADMIN with permission → 200
- ADMIN without permission → 403
- SUPER_ADMIN → 200 (bypass)
- Non-admin → 403
- Unauthenticated → 401

**Status:** REMEDIATED (source audit complete, hostile tests pending for full closure)

**Recommendation:** 
- **Option A:** Close as REMEDIATED based on source audit evidence (118 permission checks, 0 role checks, historical finding now fixed)
- **Option B:** Run hostile baseline tests against representative routes before final closure to prove the permission checks work as intended

---

## Authorization Model Verification

The current permission-based authorization flow:

```typescript
// Step 1: Get session
const session = await getServerSession(authOptions);

// Step 2: Check permission (not role)
const deny = await requirePermission(session, PERM.FINANCE_REVENUE_VIEW);
if (deny) return deny;

// Step 3: Proceed with operation
```

The `requirePermission` implementation:
1. Calls `checkPermission(session, permission)`
2. Which loads the user from DB (fresh read, not JWT-cached)
3. If user is SUPER_ADMIN → automatically granted
4. If user is ADMIN → checks StaffMember.permissions array
5. Returns 403 if permission not present

This is the **correct** pattern. No route-level role checks bypass the permission system.

---

## Next Steps

**Recommended: Option A — Close as REMEDIATED based on source audit**

**Rationale:**
- Phase 1 finding explicitly stated `/admin/revenue` checked `role === 'SUPER_ADMIN'`
- Current source shows it uses `requirePermission(PERM.FINANCE_REVENUE_VIEW)`
- 118 permission checks found, 0 role checks found across 73 routes
- The remediation is systematic and complete at the source level

**If hostile tests required before close:**
- Test file created: `__tests__/integration/rbac-m-02-verification.test.ts`
- Requires isolated test DB at localhost:5433
- Tests R1-R5, P1-P2, W1-W2 verify permission enforcement across 3 representative routes
- Can be executed when test environment is available

**Independent reviewer decision:** Accept source-level evidence as sufficient for REMEDIATED status, or require hostile baseline test execution before final closure.

---

**Created:** 2026-09-24  
**Investigator:** Kiro audit agent  
**Parent Finding:** RBAC-M-02
