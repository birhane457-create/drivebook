# AUDIT-05: Audit Coverage Gaps

**Status:** OPEN  
**Priority:** P1 (Security)  
**Scope:** main branch  
**Created:** 2026-09-25  

## Problem Statement

Some sensitive administrative operations may not have audit trail coverage, creating gaps in forensic accountability and compliance requirements.

## Security Requirement

Every sensitive state change must generate an immutable audit record capturing:
- WHO performed the action (actorId)
- WHAT action was performed (action)
- WHEN it occurred (timestamp)
- WHERE it occurred (IP, user agent)
- The OUTCOME (success/failure + details)

## Investigation Scope

### High-Priority Operations Requiring Audit Coverage

1. **User Management**
   - Provider approval/rejection/suspension
   - Customer account modifications
   - Password resets (admin-initiated)
   - Role/permission changes

2. **Financial Operations**
   - Wallet credit/debit operations (AUDIT-01/02 CLOSED — verified covered)
   - Payout processing
   - Subscription overrides
   - Refund processing

3. **Access Control**
   - Permission grants/revokes
   - Role assignments
   - StaffMember creation/modification

4. **Sensitive Data Access**
   - OAuth credential access
   - PII exports
   - Document verification status changes

5. **Configuration Changes**
   - Platform settings modifications
   - Pricing rule changes
   - Policy overrides

## Current Audit Infrastructure

### Verified Components (AUDIT-01/02)
- ✅ `writeAuditLog()` — PostgreSQL native, atomic with business state
- ✅ `writeAuditLogSafe()` — Tier 4 pattern, fail-open for non-critical flows
- ✅ Wallet operations — full coverage with idempotency (MM-12B/MM-12E verified)

### Audit API
- ✅ `GET /api/admin/audit-log` — audit log query interface exists

## Discovered Gaps

### CRITICAL (P0) — No Audit Coverage

#### Provider Status Changes
**Location:** `app/api/admin/instructors/[id]/`

1. **APPROVE** (`approve/route.ts`)
   - ❌ NO AUDIT LOG
   - Updates `approvalStatus = 'APPROVED'`, `isActive = true`, `documentsVerified = true`
   - Permission: `USERS_PROVIDERS_APPROVE`
   - **Risk:** Account approval with no forensic trail

2. **REJECT** (`reject/route.ts`)
   - ❌ NO AUDIT LOG
   - Updates `approvalStatus = 'REJECTED'`, `isActive = false`
   - Permission: `USERS_PROVIDERS_REJECT`
   - Comment in code: `// Note: Audit logging removed - AuditLog model not in schema`
   - **Risk:** Account rejection with no forensic trail

3. **SUSPEND** (`suspend/route.ts`)
   - ❌ NO AUDIT LOG
   - Updates `approvalStatus = 'SUSPENDED'`, `isActive = false`
   - Permission: `USERS_PROVIDERS_SUSPEND`
   - **Risk:** Account suspension with no forensic trail

### Analysis

All three operations:
- Have permission checks (`requirePermission`)
- Update critical Provider state
- Send notification emails
- **Missing:** `writeAuditLog()` calls

The reject route contains an abandoned comment suggesting audit logging was previously attempted but removed because "AuditLog model not in schema". However, AUDIT-01/02 verification proves the AuditLog table DOES exist and is functional in PostgreSQL.

## Next Steps

1. **Map all sensitive operations** — inventory existing admin API routes ✅ (Provider ops discovered)
2. **Audit gap analysis** — identify operations missing `writeAuditLog()` calls ✅ (3 critical gaps found)
3. **Coverage implementation** — add audit calls to identified gaps ⬅️ NEXT
4. **Integration testing** — verify audit records are created
5. **Regression prevention** — add tests ensuring future operations include audit

## Implementation Plan

### Phase 1: Discovery ✅ COMPLETE
- ✅ List all admin API routes by category
- ✅ Identify which routes have `writeAuditLog()` calls
- ✅ Categorize gaps by sensitivity level

### Phase 2: Critical Gaps (P0)
- [ ] Provider status changes (approve/reject/suspend)
- [ ] Permission/role modifications
- [ ] Subscription overrides

### Phase 3: Important Gaps (P1)
- [ ] Document verification status
- [ ] Configuration changes
- [ ] Password resets

### Phase 4: Complete Coverage (P2)
- [ ] All remaining admin mutations
- [ ] PII exports
- [ ] Sensitive data access logs

## Success Criteria

- All P0 operations have audit coverage
- Integration tests verify audit records are written
- No security-sensitive mutations execute without audit trail
- Audit log queryable via admin interface

## References

- AUDIT-01: Audit writes could fail silently — CLOSED (f1634c25, 9eba2f83)
- AUDIT-02: Critical state changes not atomic with audit — CLOSED (1481e78c)
- RBAC-SPEC.md: Permission matrix
- MM-12B/MM-12E: Wallet operation audit verification
