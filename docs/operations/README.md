# DriveBook Operations Manual

> **For:** ADMIN and SUPER_ADMIN roles only.
> **Updated:** 2026-07-20
> **Source of governance rules:** `lib/config/governance.ts`
> **Source of configurable values:** `PlatformSettings` DB table — see `docs/DOCROLEBASE/00-overview/HARDCODED_VALUES.md`

---

## Manual Structure

| # | Document | What it covers |
|---|---|---|
| [01](./01-admin-governance.md) | Admin Governance | Pre-action checklists, permissions, approval thresholds |
| [02](./02-finance.md) | Finance & Payments | Payouts, refunds, reconciliation, wallet adjustments |
| [03](./03-bookings.md) | Booking Operations | Booking lifecycle, cancellations, disputes |
| [04](./04-instructors.md) | Instructor Management | Approval, suspension, documents, voice lines |
| [05](./05-business-tier.md) | Business Tier | BUSINESS account activation, school identity, roadmap |
| [06](./06-ai-operations.md) | AI Operations | Copilot policy, AI receptionist, what AI may/may not do |
| [07](./07-security-fraud.md) | Security & Fraud | Fraud signals, account freezing, data privacy, Australian Privacy Act |
| [08](./08-data-documents.md) | Data & Documents | Document lifecycle, data export, deletion, retention |
| [09](./09-emergency-runbooks.md) | Emergency Runbooks | Stripe outage, Twilio outage, DB maintenance, P0–P4 severity matrix |
| [10](./10-audit-compliance.md) | Audit & Compliance | Audit requirements, KPI dashboard, feature flags |
| [11](./11-release-management.md) | Release Management | Deployment checklist, rollback, smoke tests, migration procedure |

---

## Quick Reference

| I need to... | Go to |
|---|---|
| Approve an instructor | [04 — Instructor Management](./04-instructors.md#instructor-approval) |
| Process a payout | [02 — Finance](./02-finance.md#payouts) |
| Issue a refund | [02 — Finance](./02-finance.md#refunds) |
| Handle a dispute | [03 — Bookings](./03-bookings.md#disputes) |
| Suspend an instructor | [04 — Instructor Management](./04-instructors.md#suspension) |
| Change pricing/commission | [02 — Finance](./02-finance.md#pricing-changes) |
| Enable BUSINESS tier | [05 — Business Tier](./05-business-tier.md) |
| Assign a voice line | [04 — Instructor Management](./04-instructors.md#voice-lines) |
| Freeze a fraud account | [07 — Security & Fraud](./07-security-fraud.md#fraud-response) |
| Handle P0 incident | [09 — Emergency Runbooks](./09-emergency-runbooks.md#p0) |
| Deploy a release | [11 — Release Management](./11-release-management.md) |
| Understand AI boundaries | [06 — AI Operations](./06-ai-operations.md#ai-boundaries) |
| Export student data | [08 — Data & Documents](./08-data-documents.md#data-export) |
| Check automated actions | [01 — Governance §Automated](./01-admin-governance.md#automated-actions) |
