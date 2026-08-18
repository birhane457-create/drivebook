# RBAC Enforcement Implementation Guide

## Status: ⚠️ PARTIALLY IMPLEMENTED

The RBAC system is **designed and specified** but **NOT YET ENFORCED** in most admin routes.

### What Exists ✅
- ✅ Detailed RBAC specification (`docs/DOCROLEBASE/00-overview/RBAC-SPEC.md`)
- ✅ Permission definitions (`lib/rbac/permissions.ts` - **needs to be created**)
- ✅ Role presets (`lib/rbac/role-presets.ts` - **needs to be created**)
- ✅ Central permission checker (`lib/rbac/checkPermission.ts`) 
- ✅ Migration script (`scripts/migrate-rbac.js`)
- ✅ Database schema supports `StaffMember.permissions[]`

### What's Missing ❌
- ❌ Admin routes are **not calling** `checkPermission()`
- ❌ Legacy permission flags (`canApproveRefunds`, etc.) may still be checked
- ❌ Client-side permission hook (`hooks/useAdminPermissions.ts`) not created
- ❌ AdminNav not filtering by permissions
- ❌ Permission types file not created

---

## Implementation Steps

### Step 1: Create Permission Definitions

Create `lib/rbac/permissions.ts`:

```typescript
/**
 * Permission Catalogue
 * 47 granular permissions as specified in RBAC-SPEC.md
 */

export const PERMISSIONS = {
  // Users - Instructors (8)
  USERS_INSTRUCTORS_VIEW: 'users.instructors.view',
  USERS_INSTRUCTORS_APPROVE: 'users.instructors.approve',
  USERS_INSTRUCTORS_REJECT: 'users.instructors.reject',
  USERS_INSTRUCTORS_SUSPEND: 'users.instructors.suspend',
  USERS_INSTRUCTORS_SEND_EMAIL: 'users.instructors.send_email',
  USERS_INSTRUCTORS_MANAGE_SUBSCRIPTION: 'users.instructors.manage_subscription',
  USERS_INSTRUCTORS_VERIFY_DOCUMENTS: 'users.instructors.verify_documents',
  USERS_INSTRUCTORS_VERIFY_ABN: 'users.instructors.verify_abn',

  // Users - Clients (5)
  USERS_CLIENTS_VIEW: 'users.clients.view',
  USERS_CLIENTS_EDIT: 'users.clients.edit',
  USERS_CLIENTS_WALLET_CREDIT: 'users.clients.wallet_credit',
  USERS_CLIENTS_WALLET_DEDUCT: 'users.clients.wallet_deduct',
  USERS_CLIENTS_RESET_PASSWORD: 'users.clients.reset_password',

  // Users - Subscriptions (2)
  USERS_SUBSCRIPTIONS_VIEW: 'users.subscriptions.view',
  USERS_SUBSCRIPTIONS_OVERRIDE: 'users.subscriptions.override',

  // Finance (10)
  FINANCE_REVENUE_VIEW: 'finance.revenue.view',
  FINANCE_PAYOUTS_VIEW: 'finance.payouts.view',
  FINANCE_PAYOUTS_PROCESS: 'finance.payouts.process',
  FINANCE_PAYOUTS_HOLD: 'finance.payouts.hold',
  FINANCE_PAYOUTS_RESOLVE: 'finance.payouts.resolve',
  FINANCE_CREDITS_VIEW: 'finance.credits.view',
  FINANCE_CREDITS_MANAGE: 'finance.credits.manage',
  FINANCE_DISPUTES_VIEW: 'finance.disputes.view',
  FINANCE_DISPUTES_MANAGE: 'finance.disputes.manage',
  FINANCE_PRICING_VIEW: 'finance.pricing.view',
  FINANCE_PRICING_MANAGE: 'finance.pricing.manage',

  // Operations (12)
  OPERATIONS_BOOKINGS_VIEW: 'operations.bookings.view',
  OPERATIONS_BOOKINGS_CANCEL: 'operations.bookings.cancel',
  OPERATIONS_BOOKINGS_DELETE: 'operations.bookings.delete',
  OPERATIONS_DOCUMENTS_VIEW: 'operations.documents.view',
  OPERATIONS_DOCUMENTS_VERIFY: 'operations.documents.verify',
  OPERATIONS_TEST_CENTRES_VIEW: 'operations.test_centres.view',
  OPERATIONS_TEST_CENTRES_MANAGE: 'operations.test_centres.manage',
  OPERATIONS_POLICY_VIEW: 'operations.policy.view',
  OPERATIONS_POLICY_MANAGE: 'operations.policy.manage',
  OPERATIONS_AUDIT_LOG_VIEW: 'operations.audit_log.view',
  OPERATIONS_CRON_VIEW: 'operations.cron.view',
  OPERATIONS_VOICE_LINES_VIEW: 'operations.voice_lines.view',
  OPERATIONS_VOICE_LINES_MANAGE: 'operations.voice_lines.manage',

  // Engagement (6)
  ENGAGEMENT_REVIEWS_VIEW: 'engagement.reviews.view',
  ENGAGEMENT_REVIEWS_MODERATE: 'engagement.reviews.moderate',
  ENGAGEMENT_SUPPORT_VIEW: 'engagement.support.view',
  ENGAGEMENT_SUPPORT_CONTACT: 'engagement.support.contact',
  ENGAGEMENT_SUPPORT_RESET_PASSWORD: 'engagement.support.reset_password',

  // Platform (2)
  PLATFORM_SETTINGS_VIEW: 'platform.settings.view',
  PLATFORM_SETTINGS_MANAGE: 'platform.settings.manage',
  PLATFORM_COPILOT_VIEW: 'platform.copilot.view',
} as const

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]

export const ALL_PERMISSIONS = Object.values(PERMISSIONS)
```

### Step 2: Run Migration Script

```bash
node scripts/migrate-rbac.js
```

This will:
- Create `StaffMember` records for existing ADMIN users
- Populate `permissions` array with ADMIN preset
- Leave SUPER_ADMIN users untouched (they have wildcard access)

### Step 3: Update Admin Routes

For EACH admin route that performs a privileged action, add permission check:

**Example: Payout Processing Route**

```typescript
// app/api/admin/payouts/process/route.ts
import { checkPermission } from '@/lib/rbac/checkPermission'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  // RBAC check
  const permCheck = await checkPermission(session, PERMISSIONS.FINANCE_PAYOUTS_PROCESS)
  if (!permCheck.allowed) {
    return permCheck.response // Returns 403 with reason
  }
  
  // Rate limit check
  const identifier = getRateLimitIdentifier(session.user.id, request)
  return await RateLimiters.payoutProcessing(identifier, async () => {
    // ... existing payout logic
  })
}
```

### Step 4: Routes That Need RBAC Enforcement

#### High Priority (Financial)
- [ ] `/api/admin/payouts/process` - `FINANCE_PAYOUTS_PROCESS`
- [ ] `/api/admin/payouts/[id]/hold` - `FINANCE_PAYOUTS_HOLD`
- [ ] `/api/admin/payouts/resolve` - `FINANCE_PAYOUTS_RESOLVE`
- [ ] `/api/admin/credits/*` - `FINANCE_CREDITS_MANAGE` + check `maxRefundAmount`
- [ ] `/api/admin/revenue` - `FINANCE_REVENUE_VIEW`
- [ ] `/api/admin/disputes/*` - `FINANCE_DISPUTES_VIEW` / `MANAGE`
- [ ] `/api/admin/pricing` - `FINANCE_PRICING_VIEW` / `MANAGE`

#### High Priority (User Management)
- [ ] `/api/admin/instructors/[id]/approve` - `USERS_INSTRUCTORS_APPROVE`
- [ ] `/api/admin/instructors/[id]/reject` - `USERS_INSTRUCTORS_REJECT`
- [ ] `/api/admin/instructors/[id]/suspend` - `USERS_INSTRUCTORS_SUSPEND`
- [ ] `/api/admin/instructors/[id]/subscription` - `USERS_INSTRUCTORS_MANAGE_SUBSCRIPTION`
- [ ] `/api/admin/instructors/[id]/verify-abn` - `USERS_INSTRUCTORS_VERIFY_ABN`

#### Medium Priority
- [ ] `/api/admin/bookings` - `OPERATIONS_BOOKINGS_VIEW`
- [ ] `/api/admin/documents/*` - `OPERATIONS_DOCUMENTS_VIEW` / `VERIFY`
- [ ] `/api/admin/audit-log` - `OPERATIONS_AUDIT_LOG_VIEW`
- [ ] `/api/admin/settings` - `PLATFORM_SETTINGS_VIEW` / `MANAGE`

### Step 5: Create Client-Side Hook

Create `hooks/useAdminPermissions.ts`:

```typescript
'use client'

import { useEffect, useState } from 'react'

export function useAdminPermissions() {
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    fetch('/api/admin/me/permissions')
      .then(res => res.json())
      .then(data => {
        setPermissions(data.permissions || [])
        setIsSuperAdmin(data.isSuperAdmin || false)
      })
      .finally(() => setLoading(false))
  }, [])

  const hasPermission = (permission: string) => {
    return isSuperAdmin || permissions.includes(permission)
  }

  const hasAnyPermission = (perms: string[]) => {
    return isSuperAdmin || perms.some(p => permissions.includes(p))
  }

  return { permissions, loading, isSuperAdmin, hasPermission, hasAnyPermission }
}
```

### Step 6: Update AdminNav

```typescript
// components/admin/AdminNav.tsx
import { useAdminPermissions } from '@/hooks/useAdminPermissions'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export default function AdminNav() {
  const { hasPermission, loading } = useAdminPermissions()
  
  if (loading) return <div>Loading...</div>
  
  return (
    <nav>
      {hasPermission(PERMISSIONS.FINANCE_REVENUE_VIEW) && (
        <Link href="/admin/revenue">Revenue</Link>
      )}
      {hasPermission(PERMISSIONS.FINANCE_PAYOUTS_VIEW) && (
        <Link href="/admin/payouts">Payouts</Link>
      )}
      {/* ... etc */}
    </nav>
  )
}
```

---

## Testing RBAC

### Test Scenario 1: ADMIN with Empty Permissions
1. Create ADMIN user without running migration
2. Try to access `/admin/payouts` → should get 403
3. Run migration → should grant access

### Test Scenario 2: ADMIN with Partial Permissions
1. Give ADMIN only `finance.credits.view`
2. Try to issue credit → should get 403
3. Add `finance.credits.manage` → should work
4. Try to exceed `maxRefundAmount` → should get 403

### Test Scenario 3: SUPER_ADMIN Bypass
1. Login as SUPER_ADMIN
2. Should access ALL routes regardless of permissions

### Test Scenario 4: Legacy Flag Ignored
1. Create ADMIN with `canApproveRefunds=true` but empty `permissions`
2. Try to issue credit → should get 403
3. Confirms legacy flags are not authoritative

---

## Rollback Plan

If RBAC causes issues in production:

1. **Quick Fix:** Grant all permissions to affected admins
   ```sql
   UPDATE "StaffMember" 
   SET permissions = ARRAY[
     'users.instructors.view', 'users.instructors.approve', ...
   ]
   WHERE permissions = '{}';
   ```

2. **Emergency Bypass:** Temporarily treat empty permissions as SUPER_ADMIN
   ```typescript
   // In checkPermission()
   if (staffMember.permissions.length === 0) {
     console.warn('EMERGENCY: Empty permissions treated as wildcard')
     return { allowed: true, isSuperAdmin: false, staffMember }
   }
   ```

3. **Full Rollback:** Remove permission checks from routes
   - Revert to role-only checks (`role === 'ADMIN'`)
   - Keep audit logging

---

## Current Status Summary

| Component | Status |
|---|---|
| Database schema | ✅ Ready |
| Permission definitions | ❌ Need to create |
| Role presets | ✅ Exists in migration script |
| checkPermission() | ✅ Implemented |
| Migration script | ✅ Ready to run |
| Admin routes enforcement | ❌ Not implemented (0%) |
| Client-side hook | ❌ Not created |
| AdminNav filtering | ❌ Not implemented |
| Testing | ❌ Not done |

**Estimated effort:** 8-12 hours to fully implement and test

**Risk level:** MEDIUM
- High value (proper authorization)
- Medium complexity (lots of routes to update)
- Low risk if tested properly (fallback to role checks)

---

## Next Actions

1. **NOW:** Create permission definitions file
2. **NOW:** Run migration script on development DB
3. **TODAY:** Update 5-10 highest-risk routes (payouts, subscriptions, credits)
4. **THIS WEEK:** Update remaining admin routes
5. **THIS WEEK:** Create client-side hook and update AdminNav
6. **THIS WEEK:** Test all scenarios
7. **BEFORE LAUNCH:** Final audit of all admin routes
