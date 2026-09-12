# DriveBook Admin RBAC Specification
**Status:** APPROVED — implementation contract  
**Date:** August 2026  
**Author:** Approved by product owner  

---

## 0. Principles (non-negotiable)

1. `SUPER_ADMIN` has implicit wildcard access. The permission check is never reached.
2. `permissions = []` means **no granular access** — not a fallback to any preset.
3. `canApproveRefunds`, `canOverridePolicy`, `canAccessFinancials` on `StaffMember` do **not** authorize any API action. They may remain in the schema for UI display but are not read by any permission check.
4. `maxRefundAmount` is a **business limit**, not an authorization gate. The permission `finance.credits.manage` gates whether the action is allowed at all. `maxRefundAmount` caps the dollar amount when it is.
5. Every permission in this document must be implemented exactly as specified. No consolidation, simplification, or reinterpretation during implementation.
6. Sensitive read routes require explicit permissions — not all ADMIN users can read financial data, audit logs, or platform configuration.
7. `ADMIN + permissions=[] + canApproveRefunds=true → 403` — this specific case must be tested.
8. `ADMIN + finance.credits.manage + maxRefundAmount=500 → credit allowed up to $500 only` — this specific case must be enforced.

---

## 1. Permission Catalogue (47 permissions)

### Users

```
users.instructors.view
users.instructors.approve
users.instructors.reject
users.instructors.suspend
users.instructors.send_email
users.instructors.manage_subscription
users.instructors.verify_documents
users.instructors.verify_abn

users.clients.view
users.clients.edit
users.clients.wallet_credit
users.clients.wallet_deduct
users.clients.reset_password

users.subscriptions.view
users.subscriptions.override
```

### Finance

```
finance.revenue.view

finance.payouts.view
finance.payouts.process
finance.payouts.hold
finance.payouts.resolve

finance.credits.view
finance.credits.manage

finance.disputes.view
finance.disputes.manage

finance.pricing.view
finance.pricing.manage
```

### Operations

```
operations.bookings.view
operations.bookings.cancel
operations.bookings.delete

operations.documents.view
operations.documents.verify

operations.test_centres.view
operations.test_centres.manage

operations.policy.view
operations.policy.manage

operations.audit_log.view

operations.cron.view

operations.voice_lines.view
operations.voice_lines.manage
```

### Engagement

```
engagement.reviews.view
engagement.reviews.moderate

engagement.support.view
engagement.support.contact
engagement.support.reset_password
```

### Platform

```
platform.settings.view
platform.settings.manage

platform.copilot.view
```

---

## 2. Role → Permission Matrix

Legend: ✓ = explicit grant, — = no access, ✓* = SUPER_ADMIN wildcard (never reaches permission check)

| Permission | SUPER_ADMIN | ADMIN | FINANCE | OPERATIONS | SUPPORT |
|---|:---:|:---:|:---:|:---:|:---:|
| `users.instructors.view` | ✓* | ✓ | — | ✓ | ✓ |
| `users.instructors.approve` | ✓* | ✓ | — | ✓ | — |
| `users.instructors.reject` | ✓* | ✓ | — | ✓ | — |
| `users.instructors.suspend` | ✓* | ✓ | — | ✓ | — |
| `users.instructors.send_email` | ✓* | ✓ | — | ✓ | ✓ |
| `users.instructors.manage_subscription` | ✓* | ✓ | ✓ | — | — |
| `users.instructors.verify_documents` | ✓* | ✓ | — | ✓ | — |
| `users.instructors.verify_abn` | ✓* | ✓ | ✓ | ✓ | — |
| `users.clients.view` | ✓* | ✓ | — | ✓ | ✓ |
| `users.clients.edit` | ✓* | ✓ | — | — | ✓ |
| `users.clients.wallet_credit` | ✓* | ✓ | ✓ | — | — |
| `users.clients.wallet_deduct` | ✓* | — | ✓ | — | — |
| `users.clients.reset_password` | ✓* | ✓ | — | — | ✓ |
| `users.subscriptions.view` | ✓* | ✓ | ✓ | — | — |
| `users.subscriptions.override` | ✓* | — | ✓ | — | — |
| `finance.revenue.view` | ✓* | ✓ | ✓ | — | — |
| `finance.payouts.view` | ✓* | ✓ | ✓ | — | — |
| `finance.payouts.process` | ✓* | — | ✓ | — | — |
| `finance.payouts.hold` | ✓* | — | ✓ | — | — |
| `finance.payouts.resolve` | ✓* | — | ✓ | — | — |
| `finance.credits.view` | ✓* | ✓ | ✓ | — | ✓ |
| `finance.credits.manage` | ✓* | ✓ | ✓ | — | — |
| `finance.disputes.view` | ✓* | ✓ | ✓ | — | — |
| `finance.disputes.manage` | ✓* | — | ✓ | — | — |
| `finance.pricing.view` | ✓* | ✓ | ✓ | — | — |
| `finance.pricing.manage` | ✓* | — | — | — | — |
| `operations.bookings.view` | ✓* | ✓ | — | ✓ | ✓ |
| `operations.bookings.cancel` | ✓* | ✓ | — | ✓ | — |
| `operations.bookings.delete` | ✓* | — | — | ✓ | — |
| `operations.documents.view` | ✓* | ✓ | — | ✓ | — |
| `operations.documents.verify` | ✓* | ✓ | — | ✓ | — |
| `operations.test_centres.view` | ✓* | ✓ | — | ✓ | — |
| `operations.test_centres.manage` | ✓* | ✓ | — | ✓ | — |
| `operations.policy.view` | ✓* | ✓ | — | ✓ | — |
| `operations.policy.manage` | ✓* | — | — | ✓ | — |
| `operations.audit_log.view` | ✓* | ✓ | ✓ | ✓ | — |
| `operations.cron.view` | ✓* | ✓ | — | ✓ | — |
| `operations.voice_lines.view` | ✓* | ✓ | — | ✓ | — |
| `operations.voice_lines.manage` | ✓* | ✓ | — | ✓ | — |
| `engagement.reviews.view` | ✓* | ✓ | — | ✓ | ✓ |
| `engagement.reviews.moderate` | ✓* | ✓ | — | ✓ | — |
| `engagement.support.view` | ✓* | ✓ | — | — | ✓ |
| `engagement.support.contact` | ✓* | ✓ | — | — | ✓ |
| `engagement.support.reset_password` | ✓* | ✓ | — | — | ✓ |
| `platform.settings.view` | ✓* | ✓ | — | — | — |
| `platform.settings.manage` | ✓* | — | — | — | — |
| `platform.copilot.view` | ✓* | ✓ | ✓ | ✓ | — |

**`finance.pricing.manage` and `platform.settings.manage` are SUPER_ADMIN-only.**

---

## 3. Admin Nav Page → Permission Mapping

### Users section

| Page / Action | Required permission |
|---|---|
| `/admin/instructors` list | `users.instructors.view` |
| `/admin/instructors/[id]` view | `users.instructors.view` |
| Approve instructor | `users.instructors.approve` |
| Reject instructor | `users.instructors.reject` |
| Suspend instructor | `users.instructors.suspend` |
| Reactivate instructor | `users.instructors.approve` |
| Send onboarding/setup email | `users.instructors.send_email` |
| Subscription tab (view) | `users.subscriptions.view` |
| Subscription cancel/override | `users.instructors.manage_subscription` |
| Verify documents (admin review) | `users.instructors.verify_documents` |
| Verify ABN | `users.instructors.verify_abn` |
| `/admin/clients` list | `users.clients.view` |
| `/admin/clients/[id]` view | `users.clients.view` |
| Edit client fields | `users.clients.edit` |
| Add wallet credits | `users.clients.wallet_credit` |
| Deduct wallet | `users.clients.wallet_deduct` |
| Reset user password | `users.clients.reset_password` |
| `/admin/subscriptions` | `users.subscriptions.view` |
| Subscription override | `users.subscriptions.override` |
| `/admin/staff-governance` | `operations.audit_log.view` |

### Finance section

| Page / Action | Required permission |
|---|---|
| `/admin/credits` view | `finance.credits.view` |
| Issue credit | `finance.credits.manage` + `maxRefundAmount` limit |
| Issue deduction | `finance.credits.manage` + `maxRefundAmount` limit |
| `/admin/revenue` | `finance.revenue.view` |
| `/admin/payouts` view | `finance.payouts.view` |
| Preview payout batch | `finance.payouts.view` |
| Process single payout | `finance.payouts.process` |
| Process all payouts | `finance.payouts.process` |
| Put payout on hold | `finance.payouts.hold` |
| Mark bank transfer sent | `finance.payouts.resolve` |
| Resolve split | `finance.payouts.resolve` |
| `/admin/disputes` view | `finance.disputes.view` |
| Release dispute hold | `finance.disputes.manage` |
| `/admin/pricing` view | `finance.pricing.view` |
| Update pricing / commission | `finance.pricing.manage` |

### Operations section

| Page / Action | Required permission |
|---|---|
| `/admin/documents` list | `operations.documents.view` |
| Document review (signed URL) | `operations.documents.view` |
| Verify / approve document | `operations.documents.verify` |
| `/admin/bookings` list | `operations.bookings.view` |
| Cancel booking | `operations.bookings.cancel` |
| Delete booking | `operations.bookings.delete` |
| Check payment status | `operations.bookings.view` |
| `/admin/audit-log` | `operations.audit_log.view` |
| `/admin/test-centres` view | `operations.test_centres.view` |
| Create / edit / delete test centre | `operations.test_centres.manage` |
| `/admin/policy` view | `operations.policy.view` |
| Update policy rules | `operations.policy.manage` |
| `/admin/cron-jobs` | `operations.cron.view` |
| `/admin/voice-lines` view | `operations.voice_lines.view` |
| Add / assign / release / suspend voice line | `operations.voice_lines.manage` |

### Engagement section

| Page / Action | Required permission |
|---|---|
| `/admin/reviews` | `engagement.reviews.view` |
| Moderate / action review | `engagement.reviews.moderate` |
| `/admin/support` user search | `engagement.support.view` |
| Send message to user | `engagement.support.contact` |
| Reset password from support | `engagement.support.reset_password` |

### Platform section

| Page / Action | Required permission |
|---|---|
| `/admin/settings` view | `platform.settings.view` |
| Save settings | `platform.settings.manage` |
| `/admin/copilot` | `platform.copilot.view` |

### Overview

| Page | Required permission |
|---|---|
| `/admin` (dashboard) | Any single valid admin permission (entry gate only) |

---

## 4. High-Risk Actions — Explicit Permission Required

These actions require the specified permission AND are logged to AuditLog with the acting admin's id.

| Action | Permission | Additional limit |
|---|---|---|
| Approve instructor | `users.instructors.approve` | — |
| Reject instructor | `users.instructors.reject` | — |
| Suspend instructor | `users.instructors.suspend` | — |
| Override subscription tier | `users.subscriptions.override` | — |
| Add wallet credits | `users.clients.wallet_credit` | `maxRefundAmount` cap |
| Deduct wallet | `users.clients.wallet_deduct` | `maxRefundAmount` cap |
| Reset user password | `users.clients.reset_password` | — |
| Process payout | `finance.payouts.process` | — |
| Hold payout | `finance.payouts.hold` | — |
| Resolve payout / split | `finance.payouts.resolve` | — |
| Issue/manage credits | `finance.credits.manage` | `maxRefundAmount` cap |
| Release Stripe dispute hold | `finance.disputes.manage` | — |
| Update pricing / commission | `finance.pricing.manage` | SUPER_ADMIN only |
| Cancel booking | `operations.bookings.cancel` | — |
| Delete booking | `operations.bookings.delete` | — |
| Update policy rules | `operations.policy.manage` | — |
| Save platform settings | `platform.settings.manage` | SUPER_ADMIN only |

---

## 5. Schema Change

**One migration — add `permissions String[]` to `StaffMember`:**

```prisma
model StaffMember {
  // ... existing fields unchanged ...
  permissions  String[]  @default([])
  // canApproveRefunds, canOverridePolicy, canAccessFinancials remain
  // but are NOT read by any permission check
  // maxRefundAmount remains as business limit
}
```

No other schema changes.

---

## 6. Role Presets (code constants — not stored in DB)

Stored in `lib/rbac/role-presets.ts`. Used only by the migration script and the admin user management UI to populate `permissions[]` when assigning a role. The permissions array itself is always the authoritative source.

```ts
ADMIN_PERMISSIONS = [
  'users.instructors.view', 'users.instructors.approve', 'users.instructors.reject',
  'users.instructors.suspend', 'users.instructors.send_email',
  'users.instructors.manage_subscription', 'users.instructors.verify_documents',
  'users.instructors.verify_abn',
  'users.clients.view', 'users.clients.edit', 'users.clients.wallet_credit',
  'users.clients.reset_password',
  'users.subscriptions.view',
  'finance.revenue.view', 'finance.payouts.view',
  'finance.credits.view', 'finance.credits.manage',
  'finance.disputes.view', 'finance.pricing.view',
  'operations.bookings.view', 'operations.bookings.cancel',
  'operations.documents.view', 'operations.documents.verify',
  'operations.test_centres.view', 'operations.test_centres.manage',
  'operations.policy.view',
  'operations.audit_log.view', 'operations.cron.view',
  'operations.voice_lines.view', 'operations.voice_lines.manage',
  'engagement.reviews.view', 'engagement.reviews.moderate',
  'engagement.support.view', 'engagement.support.contact',
  'engagement.support.reset_password',
  'platform.settings.view', 'platform.copilot.view',
]

FINANCE_PERMISSIONS = [
  'users.instructors.view', 'users.instructors.manage_subscription',
  'users.instructors.verify_abn',
  'users.subscriptions.view', 'users.subscriptions.override',
  'users.clients.wallet_credit', 'users.clients.wallet_deduct',
  'finance.revenue.view', 'finance.payouts.view', 'finance.payouts.process',
  'finance.payouts.hold', 'finance.payouts.resolve',
  'finance.credits.view', 'finance.credits.manage',
  'finance.disputes.view', 'finance.disputes.manage',
  'finance.pricing.view',
  'operations.audit_log.view',
  'platform.copilot.view',
]

OPERATIONS_PERMISSIONS = [
  'users.instructors.view', 'users.instructors.approve', 'users.instructors.reject',
  'users.instructors.suspend', 'users.instructors.send_email',
  'users.instructors.verify_documents', 'users.instructors.verify_abn',
  'users.clients.view',
  'operations.bookings.view', 'operations.bookings.cancel', 'operations.bookings.delete',
  'operations.documents.view', 'operations.documents.verify',
  'operations.test_centres.view', 'operations.test_centres.manage',
  'operations.policy.view', 'operations.policy.manage',
  'operations.audit_log.view', 'operations.cron.view',
  'operations.voice_lines.view', 'operations.voice_lines.manage',
  'engagement.reviews.view', 'engagement.reviews.moderate',
  'platform.copilot.view',
]

SUPPORT_PERMISSIONS = [
  'users.instructors.view', 'users.instructors.send_email',
  'users.clients.view', 'users.clients.edit', 'users.clients.reset_password',
  'finance.credits.view',
  'operations.bookings.view',
  'engagement.reviews.view',
  'engagement.support.view', 'engagement.support.contact',
  'engagement.support.reset_password',
]
```

---

## 7. Configurable Limits (Super Admin adjustable)

These values are stored in `PlatformSettings` (existing model) and adjustable by SUPER_ADMIN via the platform settings API. They must NOT be hardcoded in application logic.

| Setting | Field | Default | Purpose |
|---|---|---|---|
| Max credit per transaction | `maxAdminCreditAmount` | 500 | Hard cap for `finance.credits.manage` regardless of `maxRefundAmount` |
| Max deduction per transaction | `maxAdminDeductAmount` | 500 | Hard cap for `users.clients.wallet_deduct` |
| Per-staff credit limit | `StaffMember.maxRefundAmount` | 100 | Per-user cap, must be ≤ `maxAdminCreditAmount` |

**Note:** `maxAdminCreditAmount` and `maxAdminDeductAmount` are new fields on `PlatformSettings`. They must be added to the schema migration and to the admin pricing/settings API.

---

## 8. Central Permission Check — `lib/rbac/checkPermission.ts`

```ts
// Signature (not implementation — see implementation file)
checkPermission(
  session: Session | null,
  permission: Permission,
  options?: { staffMember?: StaffMember }
): Promise<{ allowed: boolean; staffMember: StaffMember | null }>

// Rules:
// 1. No session → { allowed: false }
// 2. User.role not in ['ADMIN','SUPER_ADMIN'] → { allowed: false }
// 3. User.role === 'SUPER_ADMIN' → { allowed: true } (wildcard, no DB read needed)
// 4. Fetch StaffMember by userId (or use provided)
// 5. staffMember not found → { allowed: false }
// 6. permission not in staffMember.permissions → { allowed: false }
// 7. permission in staffMember.permissions → { allowed: true, staffMember }
```

Route usage pattern:
```ts
const { allowed, staffMember } = await checkPermission(session, 'finance.credits.manage')
if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
// For credit operations: enforce maxRefundAmount from staffMember
```

---

## 9. Client-side Hook — `useAdminPermissions()`

Returns the admin user's permission array from a lightweight API endpoint.
Used by AdminNav to hide inaccessible sections.
SUPER_ADMIN receives a synthetic `['*']` response.
Navigation hiding is UX only — API enforcement is the security layer.

---

## 10. Migration Behaviour

| Scenario | Result |
|---|---|
| Existing `SUPER_ADMIN` | No change. Wildcard. Never checks permissions. |
| Existing `ADMIN` without `StaffMember` | Migration script creates `StaffMember` with `ADMIN_PERMISSIONS` preset |
| Existing `ADMIN` with `StaffMember`, `permissions = []` | Migration script populates with `ADMIN_PERMISSIONS` preset |
| `ADMIN` + `permissions = []` + `canApproveRefunds = true` | **403** — legacy field not authoritative |
| `ADMIN` + `finance.credits.manage` + `maxRefundAmount = 500` | Allowed up to $500 |
| New `ADMIN` created after migration | Gets empty permissions — must be explicitly assigned |

**Migration script location:** `scripts/migrate-rbac.ts`  
Idempotent — safe to run multiple times.

---

## 11. Files to Create / Modify

### New files
```
lib/rbac/permissions.ts          — Permission type + ALL_PERMISSIONS constant
lib/rbac/role-presets.ts         — ADMIN_PERMISSIONS, FINANCE_PERMISSIONS, etc.
lib/rbac/checkPermission.ts      — Central server-side check function
hooks/useAdminPermissions.ts     — Client hook for nav filtering
app/api/admin/me/permissions/route.ts  — Returns current admin's permissions
scripts/migrate-rbac.ts          — One-time migration script
```

### Schema migration
```
prisma/migrations/YYYYMMDD_add_rbac_permissions/migration.sql
  ALTER TABLE "StaffMember" ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT '{}';
  ALTER TABLE "PlatformSettings" ADD COLUMN "maxAdminCreditAmount" FLOAT NOT NULL DEFAULT 500;
  ALTER TABLE "PlatformSettings" ADD COLUMN "maxAdminDeductAmount" FLOAT NOT NULL DEFAULT 500;
```

### Modified files (add permission checks)
```
lib/auth/requireRole.ts                           — add requirePermission() helper
app/admin/layout.tsx                              — pass permissions to child context
app/api/admin/instructors/[id]/approve/route.ts   — users.instructors.approve
app/api/admin/instructors/[id]/reject/route.ts    — users.instructors.reject
app/api/admin/instructors/[id]/suspend/route.ts   — users.instructors.suspend
app/api/admin/instructors/[id]/subscription/route.ts — users.instructors.manage_subscription
app/api/admin/instructors/[id]/verify-abn/route.ts   — users.instructors.verify_abn
app/api/admin/instructors/[id]/send-setup-nudge/route.ts — users.instructors.send_email
app/api/admin/instructors/[id]/send-onboarding-email/route.ts — users.instructors.send_email
app/api/admin/payouts/process/route.ts            — finance.payouts.process
app/api/admin/payouts/process-all/route.ts        — finance.payouts.process
app/api/admin/payouts/[id]/hold/route.ts          — finance.payouts.hold
app/api/admin/payouts/[id]/mark-sent/route.ts     — finance.payouts.resolve
app/api/admin/payouts/resolve/route.ts            — finance.payouts.resolve
app/api/admin/payouts/resolve-split/route.ts      — finance.payouts.resolve
app/api/admin/payouts/route.ts (GET)              — finance.payouts.view
app/api/admin/revenue/route.ts                    — finance.revenue.view
app/api/admin/disputes/route.ts (PATCH)           — finance.disputes.manage
app/api/admin/disputes/route.ts (GET)             — finance.disputes.view
app/api/admin/pricing/route.ts (POST)             — finance.pricing.manage
app/api/admin/pricing/route.ts (GET)              — finance.pricing.view
app/api/admin/credits/* (write)                   — finance.credits.manage + maxRefundAmount
app/api/admin/credits/* (read)                    — finance.credits.view
app/api/admin/bookings/route.ts                   — operations.bookings.view
app/api/admin/audit-log/route.ts                  — operations.audit_log.view
app/api/admin/documents/*                         — operations.documents.view / verify
app/api/admin/policy/route.ts (POST)              — operations.policy.manage
app/api/admin/policy/route.ts (GET)               — operations.policy.view
app/api/admin/voice-lines/* (write)               — operations.voice_lines.manage
app/api/admin/voice-lines/* (read)                — operations.voice_lines.view
app/api/admin/test-centres/* (write)              — operations.test_centres.manage
app/api/admin/test-centres/* (read)               — operations.test_centres.view
app/api/admin/users/[userId]/reset-password/route.ts — users.clients.reset_password
app/api/admin/contact/route.ts                    — engagement.support.contact
app/api/admin/settings/route.ts (POST)            — platform.settings.manage
app/api/admin/settings/route.ts (GET)             — platform.settings.view
app/api/admin/subscriptions/route.ts              — users.subscriptions.view
components/admin/AdminNav.tsx                     — filter nav items by permissions
```

---

## 12. Implementation Order

1. Schema migration (Prisma + SQL)
2. `lib/rbac/permissions.ts` — type definitions
3. `lib/rbac/role-presets.ts` — preset arrays
4. `lib/rbac/checkPermission.ts` — central check
5. `scripts/migrate-rbac.ts` — populate existing admins
6. `lib/auth/requireRole.ts` — add `requirePermission()` helper
7. `app/api/admin/me/permissions/route.ts` — client permissions endpoint
8. `hooks/useAdminPermissions.ts` — client hook
9. Modify API routes — apply permissions (follow section 11 list in order)
10. `components/admin/AdminNav.tsx` — filter nav by permissions
11. `app/admin/layout.tsx` — permissions context
12. PlatformSettings — add `maxAdminCreditAmount`, `maxAdminDeductAmount` to API
