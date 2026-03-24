# Control Guarantees

What the system guarantees, and the mechanism that enforces each guarantee.

---

## Financial Guarantees

| Guarantee | Enforcement Mechanism |
|-----------|----------------------|
| No double payouts | Idempotency check in `resolve` endpoint — 409 if payout already resolved |
| No negative wallet balance | `assertNonNegativeBalance()` in `ledger-service.ts` before any debit |
| No untracked transactions | All money movements create a `Transaction` record atomically |
| No payout before 24h buffer | `processedAt < now - 24h` check in payout eligibility query |
| No refund after payout (without override) | Status check in cancel/refund flow — SUPER_ADMIN required |
| Commission rate locked at payment time | Rate stored in Stripe metadata + `Booking.commissionRate` at creation |
| Withholding applied correctly | `withholdingTaxRate` set on every ABN status change — read at payout build time |
| Split resolution is atomic | `resolve-split` uses `prisma.$transaction()` — all-or-nothing |

---

## Operational Guarantees

| Guarantee | Enforcement Mechanism |
|-----------|----------------------|
| No silent state changes | All transitions go through API route handlers |
| Every critical action is audited | `AuditLog.create()` called in every mutation path |
| No orphan bookings | Slot expiry cron cleans PENDING_PAYMENT bookings after 10 minutes |
| Cron jobs don't double-run | Concurrency lock checked at start of each cron execution |
| Compliance failures are surfaced | Daily `recheck-abn` and `reconcile-stripe` crons + alert emails |
| Admin is always in control | All lifecycle transitions require ADMIN or SUPER_ADMIN session |

---

## Data Integrity Guarantees

| Guarantee | Enforcement Mechanism |
|-----------|----------------------|
| Transactions are immutable | No `transaction.update()` calls — only new records with `parentTransactionId` |
| Wallet balance = transaction sum | Daily reconciliation cron verifies and alerts on mismatch |
| Ledger group coherence | `ledgerGroupId` links all transactions for a booking — reconstructable at any time |
| AuditLog is append-only | No update or delete routes exist for `AuditLog` |
| Resolution group traceability | `resolutionGroupId` on `Transaction` links all entries from a split/dispute resolution |

---

## What Is NOT Guaranteed (Known Gaps)

| Gap | Status |
|-----|--------|
| Stripe Connect automated transfer | Not yet configured — payouts are manual bank transfer |
| `sendReminder` in compliance route | Logs intent but does not send email yet |
| Staff governance stats API | `/api/admin/staff-governance/stats` endpoint not yet implemented |
| ~~STRIPE_WEBHOOK_SECRET~~ | **RESOLVED** — real secret set (test mode); replace with production secret at go-live |
| ~~Prisma client stale~~ | **RESOLVED** — `prisma generate` run March 2026; payout + ledger services functional |
| `wallet.balance` drift | Instructor booking path creates `WalletTransaction` but does not update stored `balance` field |
| AuditLog on booking creation | `POST /api/bookings` does not create an AuditLog entry |
| AuditLog on admin booking PATCH | Status changes (COMPLETED, NO_SHOW) are not audited |

---

## Related

- [FAILURE_HANDLING.md](./FAILURE_HANDLING.md) — What happens when guarantees are violated
- [SYSTEM_OF_RECORD.md](./SYSTEM_OF_RECORD.md) — Where authoritative data lives
- `docs/00-foundation/FINANCIAL_DOCTRINE.md` — Financial safety checklist
