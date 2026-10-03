# RBAC Usage Guide — Developer Reference

**Finding:** APP-H-08  
**Status:** DOCUMENTED  
**Date:** 2026-08-15

This guide explains how to use the RBAC permission system when adding new admin routes or modifying existing ones.

---

## 1 — Quick Reference: Adding a Permission Check

Every admin API route must call `requirePermission` before performing any action:

```typescript
import { requirePermission } from '@/lib/auth/requireRole'
import { PERM } from '@/lib/rbac/permissions'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const deny = await requirePermission(session, PERM.FINANCE_PAYOUTS_PROCESS)
  if (deny) return deny   // returns 401 or 403 automatically

  // ... proceed with protected action
}
```

`requirePermission` returns `null` on success and a ready-to-return `NextResponse` on failure. The returned response already has the correct HTTP status (401 for unauthenticated, 403 for forbidden).

---

## 2 — `requirePermission` vs `checkPermission`

| Use | When |
|-----|------|
| `requirePermission(session, PERM.X)` | Simple gate — only need to know if allowed |
| `checkPermission(session, PERM.X)` | Need the `staffMember` object too (e.g. to read `maxRefundAmount`) |

Example with dollar limit enforcement:

```typescript
import { checkPermission } from '@/lib/rbac/checkPermission'

const check = await checkPermission(session, PERM.FINANCE_CREDITS_MANAGE)
if (!check.allowed) return check.response

if (!check.isSuperAdmin && check.staffMember) {
  const limit = check.staffMember.maxRefundAmount
  if (amount > limit) {
    return NextResponse.json(
      { error: `Amount exceeds your credit limit of $${limit}` },
      { status: 403 }
    )
  }
}
```

---

## 3 — The Permission Constants

Always import from `lib/rbac/permissions.ts`. Never use raw permission strings.

```typescript
import { PERM } from '@/lib/rbac/permissions'

// ✅ correct
await requirePermission(session, PERM.OPERATIONS_BOOKINGS_CANCEL)

// ❌ wrong — string typos won't be caught at compile time
await requirePermission(session, 'operations.bookings.cancel')
```

`ALL_PERMISSIONS` is the exhaustive typed list — use it for validation if needed.

---

## 4 — Adding a New Permission

1. Add the constant to `lib/rbac/permissions.ts`:
   ```typescript
   export const PERM = {
     // ... existing ...
     USERS_PROVIDERS_ARCHIVE: 'users.providers.archive',  // new
   } as const
   ```

2. Add it to the relevant preset arrays in `lib/rbac/role-presets.ts` (whichever roles should have it):
   ```typescript
   export const ADMIN_PERMISSIONS: Permission[] = [
     // ... existing ...
     'users.providers.archive',  // new
   ]
   ```
   The compile-time validator at the bottom of `role-presets.ts` will throw at module load if you add it to a preset without adding it to `PERM` first.

3. Update `docs/DOCROLEBASE/00-overview/RBAC-SPEC.md` to document which roles get the new permission.

4. If the permission gates a UI page or action, add it to the Admin Nav Mapping in RBAC-SPEC.md Section 3.

---

## 5 — Role Hierarchy

| Role | Permission check behaviour |
|------|--------------------------|
| `SUPER_ADMIN` | Wildcard — `checkPermission` returns `{ allowed: true, isSuperAdmin: true, staffMember: null }` immediately. No `StaffMember` record needed. |
| `ADMIN` | Must have an explicit `StaffMember` record with `permissions[]`. Empty array = no access to any protected action. |
| All other roles | `checkPermission` returns 403 `not_admin` before reaching the permission check. |

---

## 6 — Testing a Permission Check

Use `rbac-m-02-verification.test.ts` in `__tests__/integration/` as a reference for integration testing. For unit tests, mock `checkPermission` directly:

```typescript
vi.mock('@/lib/rbac/checkPermission', () => ({
  checkPermission: vi.fn().mockResolvedValue({
    allowed: true,
    isSuperAdmin: true,
    staffMember: null,
  }),
}))
```

To test a 403 path:
```typescript
vi.mocked(checkPermission).mockResolvedValue({
  allowed: false,
  reason: 'missing_permission',
  response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
})
```

---

## 7 — Related Files

| File | Purpose |
|------|---------|
| `lib/rbac/permissions.ts` | All 47 `PERM.*` constants — canonical source |
| `lib/rbac/checkPermission.ts` | Runtime enforcement — reads `StaffMember.permissions` from DB |
| `lib/rbac/role-presets.ts` | ADMIN/FINANCE/OPERATIONS/SUPPORT preset arrays |
| `lib/auth/requireRole.ts` | `requirePermission()` thin wrapper for route handlers |
| `docs/DOCROLEBASE/00-overview/RBAC-SPEC.md` | Full permission catalogue and Role→Permission matrix |
| `docs/DOCROLEBASE/00-overview/ROLES.md` | Role catalogue — what roles exist, how they are assigned |
| `__tests__/integration/rbac-m-02-verification.test.ts` | Integration test pattern for RBAC |
