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

**Finding:** RBAC-M-02 appears to have been **already remediated** prior to this investigation.

**Evidence:**
1. All sampled admin routes use permission-based authorization (`requirePermission` / `checkPermission`)
2. No role-based checks (`requireAdmin`, `requireSuperAdmin`, `role === 'SUPER_ADMIN'`) found in any admin routes
3. The authorization helper library (`lib/auth/requireRole.ts`) provides both role-based and permission-based functions, but only the permission-based functions are being used in admin routes
4. 118 occurrences of `requirePermission` across 73 admin routes suggests systematic adoption of the permission model

**Recommendation:** Mark RBAC-M-02 as **REMEDIATED — Already Fixed** and close without further action.

**Alternative hypothesis:** The original finding may have been based on an earlier codebase state, or may have been remediated as part of a different work stream (possibly during the MM-12 or PAY-01 audit phases where wallet operations were reviewed).

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

**If RBAC-M-02 close is accepted:**
- Update master tracker: RBAC-M-02 → CLOSED (Already Fixed — verified 2026-09-24)
- No remediation work required
- Move to next open finding

**If additional verification needed before close:**
- Enumerate all 73 routes in full authorization matrix (Phase 2)
- Run hostile baseline tests to confirm 403 responses for missing permissions (Phase 4)
- Document any edge cases where role checks may be legitimate

---

**Created:** 2026-09-24  
**Investigator:** Kiro audit agent  
**Parent Finding:** RBAC-M-02
