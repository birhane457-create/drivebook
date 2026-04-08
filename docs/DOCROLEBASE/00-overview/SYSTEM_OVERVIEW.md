# System Overview

**Platform:** drivebook.com.au  
**Governing Law:** Western Australia  
**Timezone:** Australia/Perth (AWST, UTC+8)  
**Stack:** Next.js 14, PostgreSQL (Supabase), Prisma, Stripe, Vercel

---

## What DriveBook Is

DriveBook is a controlled operational and financial platform connecting driving instructors with learner drivers. It is not a simple booking app — it is a system with:

- Explicit state machines for all entities
- A ledger-based financial layer (every dollar tracked)
- Full audit trail on all critical actions
- Admin as the single control authority
- Automated reconciliation and alerting

---

## Core Principles

| Principle | What It Means |
|-----------|---------------|
| Admin is the source of control | All entity lifecycle transitions go through admin APIs |
| Ledger is the source of financial truth | No balance is stored without a corresponding transaction |
| AuditLog is the source of accountability | Every critical action is logged with actor, target, and metadata |
| APIs are the only mutation layer | No direct DB writes from UI — all changes go through route handlers |
| No silent state changes | Every transition is explicit, logged, and reversible only via admin |

---

## System Domains

| Domain | Responsibility |
|--------|---------------|
| Bookings | Lifecycle from creation to completion or cancellation — platform and offline |
| Offline Bookings | Instructor-managed schedule entries for cash/bank students (PRO+, no platform commission) |
| Payments | Stripe capture, wallet debit, transaction recording |
| Payouts | Instructor earnings calculation, withholding, transfer |
| Wallet | Client credit balance — internal payment method |
| Compliance | Instructor document verification and ABN status |
| Audit | Immutable log of all critical system actions |
| Reconciliation | Daily automated check of ledger vs Stripe vs DB |
| Alerting | Email notifications for financial and compliance failures |

---

## Roles

| Role | Access |
|------|--------|
| PUBLIC | Browse instructors, initiate booking |
| CLIENT | Book lessons, manage wallet, view history |
| INSTRUCTOR | Manage bookings, view earnings, configure profile |
| ADMIN | Full operational control — all pages, all actions |
| SUPER_ADMIN | Admin + system overrides (financial safeguard bypass) |

---

## Key Constraints

- `commissionRate` and `newStudentBonus` are never stored on `Instructor` — always derived from `PlatformSettings`
- `withholdingTaxRate` is set by ABN verification status: verified = 0%, unverified = 47%
- Transactions are immutable — no updates, only new adjustment records
- Refund after payout requires SUPER_ADMIN and creates an audit entry
- Payout requires 24-hour buffer after booking completion
- All cron jobs use concurrency locks to prevent double-execution

---

## Related

- [SYSTEM_FLOWS.md](./SYSTEM_FLOWS.md) — End-to-end flows for all major scenarios
- [STATE_MACHINES.md](./STATE_MACHINES.md) — All entity state diagrams
- [SYSTEM_OF_RECORD.md](./SYSTEM_OF_RECORD.md) — Authoritative data sources per domain
- [CONTROL_GUARANTEES.md](./CONTROL_GUARANTEES.md) — What the system guarantees and how
- [FAILURE_HANDLING.md](./FAILURE_HANDLING.md) — How failures are detected and resolved
- `docs/00-foundation/FINANCIAL_DOCTRINE.md` — Deep financial rules and ledger reconstruction
