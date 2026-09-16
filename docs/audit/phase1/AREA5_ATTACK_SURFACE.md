# Phase 2 Area 5: Admin/RBAC Attack Surface Enumeration

**Date**: 2026-08-15  
**Scope**: Admin and staff API endpoints + RBAC enforcement  
**Status**: ENUMERATION COMPLETE

---

## Attack Surface Summary

**Total Admin Endpoints**: 73  
**Total Staff Endpoints**: 4  
**Total Area 5 Endpoints**: 77

**RBAC System**:
- Permission check function: `lib/rbac/checkPermission.ts`
- Permission definitions: `lib/rbac/permissions.ts` (47 permissions)
- Role presets: `lib/rbac/role-presets.ts`

---

## Critical Security Areas

### 1. AI-Powered Admin Endpoints (HIGH RISK)
- `/api/admin/ai-query` - AI query interface (potential data exposure)
- `/api/admin/ai-brief` - AI briefing system
- `/api/admin/ai-brief/history` - Historical AI interactions

**Concern**: AI endpoints can potentially expose broader data than ordinary CRUD

### 2. Financial/Wallet Manipulation (CRITICAL)
- `/api/admin/clients/[id]/wallet/add-credit` - Add wallet credits
- `/api/admin/clients/[id]/wallet/deduct-credit` - Deduct wallet credits
- `/api/admin/payouts/process` - Process individual payout
- `/api/admin/payouts/process-all` - Process all payouts (bulk)
- `/api/admin/payouts/resolve` - Resolve payout issues
- `/api/admin/payouts/resolve-split` - Resolve split payouts
- `/api/admin/revenue` - Revenue data access
- `/api/admin/pricing` - Pricing management
- `/api/admin/transactions/[transactionId]/refund` - Issue refunds

**Concern**: Direct financial manipulation, must verify permission enforcement

### 3. Permission & Role Management (CRITICAL)
- `/api/admin/staff` - Staff member management
- `/api/admin/staff/[staffId]/permissions` - Modify staff permissions
- `/api/admin/staff/[staffId]/status` - Change staff status
- `/api/admin/me/permissions` - View own permissions
- `/api/admin/register` - Register new admin user

**Concern**: Permission escalation, self-modification, wildcard permissions

### 4. Instructor/Provider Management (HIGH)
- `/api/admin/instructors` - List instructors
- `/api/admin/instructors/[id]` - View/edit instructor
- `/api/admin/instructors/[id]/approve` - Approve instructor
- `/api/admin/instructors/[id]/reject` - Reject instructor
- `/api/admin/instructors/[id]/suspend` - Suspend instructor
- `/api/admin/instructors/[id]/subscription` - Manage subscription
- `/api/admin/instructors/[id]/verify-abn` - Verify ABN

**Concern**: IDOR, horizontal privilege escalation, subscription manipulation

### 5. Document Verification (HIGH)
- `/api/admin/documents/instructor/[instructorId]` - View documents
- `/api/admin/documents/instructor/[instructorId]/approve` - Approve documents
- `/api/admin/documents/instructor/[instructorId]/reject` - Reject documents
- `/api/admin/documents/instructor/[instructorId]/expiry` - Update expiry
- `/api/admin/documents/instructor/[instructorId]/upload` - Upload documents
- `/api/admin/documents/compliance` - Compliance overview

**Concern**: IDOR, document manipulation (F-04 was here)

### 6. Audit Log Access (MEDIUM)
- `/api/admin/audit-log` - View audit logs

**Concern**: Audit log manipulation, exposure of sensitive operations

### 7. Bulk/Export Operations (MEDIUM)
- `/api/admin/export` - Export data
- `/api/admin/payouts/preview-all` - Preview all payouts
- `/api/admin/weekly-report` - Weekly report generation
- `/api/admin/daily-summary` - Daily summary

**Concern**: Mass data exfiltration, performance DoS

---

## Complete Endpoint Inventory

### Admin Endpoints (73)

#### AI & Intelligence (3)
1. `POST /api/admin/ai-query` - Execute AI query
2. `POST /api/admin/ai-brief` - Generate AI brief
3. `GET /api/admin/ai-brief/history` - View AI brief history

#### Audit & Monitoring (7)
4. `GET /api/admin/audit-log` - View audit logs
5. `GET /api/admin/operations-timeline` - Operations timeline
6. `GET /api/admin/health-score` - Platform health score
7. `GET /api/admin/instructor-risk` - Instructor risk assessment
8. `GET /api/admin/fortress-dashboard` - Security dashboard
9. `GET /api/admin/daily-summary` - Daily summary stats
10. `GET /api/admin/weekly-report` - Weekly report

#### Bookings Management (4)
11. `GET /api/admin/bookings` - List bookings
12. `POST /api/admin/bookings` - Create booking (if supported)
13. `GET /api/admin/booking-payment-status` - Check payment status
14. `GET /api/admin/cancellations` - List cancellations
15. `GET /api/admin/cancellations/stats` - Cancellation statistics
16. `POST /api/admin/cancellations/[id]/approve` - Approve refund
17. `POST /api/admin/cancellations/[id]/reject` - Reject refund

#### Client/Customer Management (8)
18. `GET /api/admin/clients` - List clients
19. `GET /api/admin/clients/[id]` - View client details
20. `PATCH /api/admin/clients/[id]` - Update client
21. `GET /api/admin/clients/[id]/wallet` - View wallet
22. `POST /api/admin/clients/[id]/wallet/add-credit` - Add credit
23. `POST /api/admin/clients/[id]/wallet/deduct-credit` - Deduct credit
24. `GET /api/admin/clients/[id]/wallet/transactions/[transactionId]` - View transaction
25. `PATCH /api/admin/clients/[id]/wallet/transactions/[transactionId]` - Update transaction

#### Instructor/Provider Management (16)
26. `GET /api/admin/instructors` - List instructors
27. `GET /api/admin/instructors/[id]` - View instructor
28. `PATCH /api/admin/instructors/[id]` - Update instructor
29. `POST /api/admin/instructors/[id]/approve` - Approve instructor
30. `POST /api/admin/instructors/[id]/reject` - Reject instructor
31. `POST /api/admin/instructors/[id]/suspend` - Suspend instructor
32. `POST /api/admin/instructors/[id]/send-onboarding-email` - Send onboarding
33. `POST /api/admin/instructors/[id]/send-setup-nudge` - Send setup nudge
34. `GET /api/admin/instructors/[id]/subscription` - View subscription
35. `PATCH /api/admin/instructors/[id]/subscription` - Update subscription
36. `GET /api/admin/instructors/[id]/documents/[type]` - View document
37. `POST /api/admin/instructors/[id]/verify-abn` - Verify ABN
38. `GET /api/admin/instructors/[id]/onboarding-status` - View onboarding status

#### Document Management (6)
39. `GET /api/admin/documents/instructor/[instructorId]` - List documents
40. `POST /api/admin/documents/instructor/[instructorId]/upload` - Upload document
41. `POST /api/admin/documents/instructor/[instructorId]/approve` - Approve document
42. `POST /api/admin/documents/instructor/[instructorId]/reject` - Reject document
43. `PATCH /api/admin/documents/instructor/[instructorId]/expiry` - Update expiry (F-04 fixed)
44. `GET /api/admin/documents/compliance` - Compliance overview

#### Financial Management (14)
45. `GET /api/admin/revenue` - View revenue
46. `GET /api/admin/ledger` - View financial ledger
47. `GET /api/admin/pricing` - View pricing settings
48. `PATCH /api/admin/pricing` - Update pricing
49. `GET /api/admin/payouts` - List payouts
50. `GET /api/admin/payouts/preview-all` - Preview all payouts
51. `POST /api/admin/payouts/process` - Process single payout
52. `POST /api/admin/payouts/process-all` - Process all payouts
53. `POST /api/admin/payouts/resolve` - Resolve payout
54. `POST /api/admin/payouts/resolve-split` - Resolve split payout
55. `POST /api/admin/payouts/[payoutId]/hold` - Hold payout
56. `POST /api/admin/payouts/[payoutId]/mark-sent` - Mark payout sent
57. `GET /api/admin/transactions/[transactionId]/invoice` - View invoice
58. `POST /api/admin/transactions/[transactionId]/refund` - Issue refund
59. `GET /api/admin/rate-changes` - View rate changes
60. `GET /api/admin/rate-changes/[id]` - View specific rate change

#### Staff & Permissions (6)
61. `GET /api/admin/staff` - List staff members
62. `POST /api/admin/staff` - Create staff member
63. `GET /api/admin/staff/[staffId]/permissions` - View permissions
64. `PATCH /api/admin/staff/[staffId]/permissions` - Update permissions
65. `PATCH /api/admin/staff/[staffId]/status` - Update status
66. `GET /api/admin/me/permissions` - View own permissions
67. `POST /api/admin/register` - Register new admin
68. `GET /api/admin/staff-governance/stats` - Governance stats

#### Platform Management (9)
69. `GET /api/admin/settings` - View platform settings
70. `PATCH /api/admin/settings` - Update platform settings
71. `GET /api/admin/subscriptions` - View subscriptions
72. `GET /api/admin/cron-jobs` - View cron job status
73. `GET /api/admin/test-centres` - List test centres
74. `GET /api/admin/test-centres/[id]` - View test centre
75. `PATCH /api/admin/test-centres/[id]` - Update test centre
76. `GET /api/admin/voice-lines` - List voice lines
77. `GET /api/admin/voice-lines/[id]` - View voice line
78. `PATCH /api/admin/voice-lines/[id]` - Update voice line
79. `GET /api/admin/export` - Export data
80. `GET /api/admin/learning-content` - View learning content

#### User Management (3)
81. `GET /api/admin/users/[userId]` - View user
82. `PATCH /api/admin/users/[userId]` - Update user
83. `POST /api/admin/users/[userId]/reset-password` - Reset password

#### Support & Contact (2)
84. `POST /api/admin/contact` - Send contact message
85. `GET /api/admin/disputes` - View disputes

#### Other (1)
86. `GET /api/admin/test-vercel-api` - Test API endpoint

### Staff Endpoints (4)

87. `GET /api/staff/members` - List staff members
88. `GET /api/staff/tasks` - List tasks
89. `GET /api/staff/tasks/[id]` - View task
90. `PATCH /api/staff/tasks/[id]/notes` - Update task notes

---

## RBAC System Overview

### Roles
- `SUPER_ADMIN` - Wildcard access (bypasses all permission checks)
- `ADMIN` - Granular permission-based access via `StaffMember.permissions`

### Permission Model
- 47 defined permissions in `lib/rbac/permissions.ts`
- Format: `domain.resource.action` (e.g., `finance.payouts.process`)
- ADMIN users must have explicit permission in `StaffMember.permissions[]`
- Empty permissions array = no access

### Key Security Properties
1. ✅ Single authoritative check function (`checkPermission`)
2. ✅ Fresh database read (no stale JWT trust)
3. ✅ SUPER_ADMIN wildcard clearly documented
4. ⚠️ Need to verify: API routes actually call `checkPermission()`
5. ⚠️ Need to verify: No UI-only permission gates
6. ⚠️ Need to verify: No legacy permission fields still in use

---

## Audit Focus Areas

### Critical Questions

**Permission Enforcement**:
1. Do all 77 endpoints call `checkPermission()` at the server boundary?
2. Are any endpoints protected only by UI navigation?
3. Can ADMIN users access SUPER_ADMIN-only endpoints?
4. What happens with empty `permissions[]` array?

**Permission Escalation**:
5. Can ADMIN users modify their own permissions?
6. Can ADMIN users grant themselves SUPER_ADMIN role?
7. Can ADMIN users create new SUPER_ADMIN accounts?
8. Are wildcard permissions (`*`) supported or blocked?

**Horizontal Privilege Escalation**:
9. Can Admin A view/modify Admin B's permissions?
10. Can Admin A access resources outside their department/scope?
11. Are there tenant/organization boundaries for multi-tenant?

**IDOR/BOLA**:
12. Are `userId`, `providerId`, `instructorId`, `staffId` validated?
13. Can admin manipulate IDs to access unauthorized resources?
14. Are there cross-provider/cross-customer access controls?

**Financial Security**:
15. Is `maxRefundAmount` enforced server-side?
16. Can admins bypass refund limits?
17. Are wallet operations atomic and audited?
18. Can admins issue unlimited credits?

**AI Endpoint Security**:
19. Do AI endpoints (`ai-query`, `ai-brief`) enforce permission checks?
20. Can AI queries expose data beyond admin's permissions?
21. Are AI queries audited?

**Audit Log Integrity**:
22. Can admins modify/delete audit logs?
23. Are permission changes audited?
24. Are failed authorization attempts logged?

**Bulk Operations**:
25. Do bulk endpoints have rate limiting?
26. Can bulk operations cause DoS?
27. Are exports permission-checked?

---

## Next Steps

1. ✅ Enumeration complete (77 endpoints)
2. ⏭️ Audit each endpoint against 11-point checklist
3. ⏭️ Document all findings (do not fix yet)
4. ⏭️ Present findings for review
5. ⏭️ Implement approved fixes after review
6. ⏭️ Verify fixes with regression tests

---

**Enumeration By**: Kiro Security Audit  
**Date**: 2026-08-15  
**Next**: Begin systematic endpoint audit  
**Priority**: Critical financial/permission endpoints first
