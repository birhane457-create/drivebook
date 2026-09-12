# 01 — Admin Governance

> Source: `lib/config/governance.ts`

---

## Permission Matrix

| Action | SUPPORT | FINANCIAL | TECHNICAL | SUPERVISOR | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|---|---|
| Approve refund ≤$100 | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Approve refund $100–$500 | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve refund >$500 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Process payout ≤$200 | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Process payout >$1,000 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Cancel booking | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve instructor | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Suspend instructor | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Change commission rates | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Modify wallet | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Override refund policy | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Access audit log | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Close support tasks | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Assign voice lines | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Freeze account (fraud) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Enable BUSINESS tier | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Emergency platform action | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Automated Actions

> **Read before doing anything manually.** Doing these manually causes duplicates, ledger inconsistencies, or audit failures.

| Action | Automated | Frequency | Do NOT do manually |
|---|---|---|---|
| Stripe payouts | ✅ | Tuesday 2am AWST | Don't manually transfer unless cron failed |
| Payment confirmation | ✅ | On Stripe webhook | Don't manually mark booking as paid |
| Booking expiry (unpaid, 10 min) | ✅ | Every 5 min | Don't manually expire |
| Short-notice booking expiry (2 hr) | ✅ | Every 5 min | Don't manually expire |
| Auto-complete (check-in + ended) | ✅ | Every 5 min | Don't manually set COMPLETED |
| Auto no-show (no check-in, 3 hr) | ✅ | Every 5 min | Don't manually set NO_SHOW |
| Lesson SMS reminders (24h before) | ✅ | Daily 10pm UTC | Don't send duplicate reminders |
| Stripe reconciliation | ✅ | Daily 3am AWST | Only intervene if flagged report |
| FinancialLedger gap backfill | ✅ | Daily | Don't manually add ledger entries |
| Document expiry alerts | ✅ | Weekly Monday | Don't send manual emails |
| Trial expiry enforcement | ✅ | Daily | Don't manually change subscriptionStatus |
| Package expiry alerts | ✅ | Every 15 min | Don't manually notify |

---

## Escalation & SLA

| Priority | Respond within | Resolve within | Escalate after |
|---|---|---|---|
| URGENT | 15 min | 60 min | 30 min |
| HIGH | 30 min | 4 hours | 2 hours |
| NORMAL | 2 hours | 24 hours | 12 hours |
| LOW | 8 hours | 3 days | 2 days |

**Escalation chain:** SUPPORT → SUPERVISOR → ADMIN → SUPER_ADMIN

Always notify SUPER_ADMIN directly for: `PAYMENT_DISPUTE`, `COMPLAINT`, payout failure, any action >$500.

---

## Task Closure Requirements

Before closing any support task:
- [ ] Resolution text ≥ 30 characters
- [ ] At least one note recorded
- [ ] Financial impact recorded if financial task
- [ ] Linked entities verified
- [ ] SUPERVISOR or ADMIN role — SUPPORT cannot close tasks

---

## Audit Requirements

Every action touching money or status is logged to `AuditLog`. Actions requiring extra documentation:
- Override reason ≥ 20 characters
- SUPER_ADMIN approval reference if amount > $500
- Dual control for amounts > $500 (`DUAL_CONTROL_THRESHOLD`)

Audit log retention: **7 years** (`AUDIT_RETENTION_DAYS = 2555`). Do not delete audit entries.
