# Staff Governance

**Route:** `/admin/staff-governance`  
**Auth required:** ADMIN or SUPER_ADMIN  
**File:** `app/admin/staff-governance/page.tsx`  
**API:** `GET /api/admin/staff-governance/stats`

---

## Purpose

The Staff Governance dashboard provides a high-level operational control view for platform owners and senior admins. It surfaces:

- Tasks requiring supervisor approval
- SLA breaches and escalations
- Financial monitoring (refund rates)
- Performance metrics (resolution time, workload balance)
- Status of all active governance controls

This is a monitoring and oversight page — it does not directly manage staff or tasks, but links out to the relevant tools.

---

## Stats Sections

### Critical Alerts

| Metric | Alert Threshold | Color |
|--------|----------------|-------|
| Tasks Requiring Approval | > 0 → orange | Orange / Green |
| SLA Breaches | > 0 → red | Red / Green |
| Escalations | Always shown | Purple |

### Financial Monitoring

| Metric | Notes |
|--------|-------|
| Total Refunds (All Time) | Cumulative refund value |
| Refunds This Week | Rolling 7-day refund total |
| % of Revenue Refunded | Flags red if > 10% |

A refund rate above 10% triggers a visible warning: "⚠️ Above 10% threshold".

### Performance Metrics

| Metric | Alert Threshold |
|--------|----------------|
| Avg Resolution Time (hours) | Displayed as-is |
| Tasks Reopened | > 5 → red |
| Workload Balance | `Imbalanced` → orange, `Balanced` → green |

---

## Governance Controls Status

Displays the live status of five platform controls. All are expected to show `Active`:

| Control | Description |
|---------|-------------|
| Financial Control Separation | Approval thresholds enforced for financial actions |
| Task Closure Control | Resolution and audit requirements enforced before closing tasks |
| Automated Refund Calculation | Refunds are system-calculated, not manually entered |
| Permission Matrix | Role-based access control (RBAC) enforced across all routes |
| SLA Enforcement | Automatic escalation enabled for overdue tasks |

These are static status indicators — they reflect system design, not live checks. If a control shows `Inactive`, it indicates a configuration or deployment issue.

---

## Actions

- View Staff Dashboard — navigates to `/staff/dashboard`
- View Audit Logs — navigates to `/admin/audit-logs`
- Refresh Data — re-fetches governance stats

---

## Notes

- The `/api/admin/staff-governance/stats` endpoint is expected to aggregate data from tasks, bookings, and transactions. If the endpoint is not yet implemented, the page will show a "Failed to load governance data" error state.
- This page is intended for SUPER_ADMIN and platform owner use. Regular ADMIN users may have read-only access depending on role configuration.

---

## Related

- [AUDIT_LOG.md](./AUDIT_LOG.md) — Full action history
- [SUPPORT.md](./SUPPORT.md) — Support task management
- [PAYOUTS.md](./PAYOUTS.md) — Financial controls for payouts
