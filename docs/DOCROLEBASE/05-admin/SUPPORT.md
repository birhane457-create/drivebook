# Admin Support

**Route:** `/admin/support`
**Auth required:** ADMIN or SUPER_ADMIN
**File:** `app/admin/support/page.tsx`

---

## Overview

A static reference page for admin operators. No dynamic data — it's a quick-access hub with links to other admin sections and a summary of common operational tasks.

---

## Quick Actions

| Link | Destination | Purpose |
|------|-------------|---------|
| Review Pending Instructors | `/admin/instructors?status=pending` | Approve or reject new applications |
| View All Bookings | `/admin/bookings` | Monitor platform activity |
| Manage Reviews | `/admin/reviews` | Moderate flagged content |
| Platform Settings | `/admin/settings` | Configure pricing and features |

---

## Common Admin Tasks (reference)

### Approving new instructors
1. Go to Instructors → Pending tab
2. Review profile and documents
3. Click Approve or Reject with reason
4. Instructor receives email notification

### Managing subscriptions
- View subscription stats on the Overview (Dashboard) page
- Monitor trial users and past-due accounts
- PRO: $29/mo, 12% commission
- BUSINESS: $59/mo, 7% commission

### Handling support issues
1. Check bookings for cancellations or disputes
2. Review flagged reviews for inappropriate content
3. Contact instructors via their profile page
4. Suspend accounts via `/admin/instructors/[id]` if needed

### Revenue monitoring
- Monthly subscription revenue on Dashboard
- Commission tracked per booking
- Detailed breakdown at `/admin/revenue`

---

## Note

This page is a static operator reference. It does not have a backend API. For live support tooling (ticket system, chat, etc.), that would need to be built separately.
