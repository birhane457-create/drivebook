# System of Record

For every domain, there is exactly one authoritative source of truth. When data conflicts, this table resolves it.

---

## Authoritative Sources

| Domain | Source of Truth | Notes |
|--------|----------------|-------|
| Bookings | `Booking` table (PostgreSQL) | Status, timing, participants |
| Payments | Stripe + `Transaction` table | Stripe is authoritative for payment status; Transaction is authoritative for platform accounting |
| Client wallet balance | `WalletTransaction` sum (computed) | `ClientWallet.balance` is a cached field — the transaction sum is the authoritative source. All booking paths (instructor, admin, client) compute balance from the transaction sum. The stored `balance` field is not used for financial decisions. |
| Instructor earnings | `Transaction.instructorPayout` sum | Not stored as a running total — always computed |
| Payouts | `Payout` + `PayoutTransaction` collections | Payout system is authoritative for what has been paid |
| Commission rates | `PlatformSettings` (DB) | Never stored on `Instructor` — always fetched at payment time |
| Withholding tax rate | `Instructor.withholdingTaxRate` | Set by ABN verification status — 0% or 47% |
| ABN status | `Instructor.abnVerified` + `Instructor.abnStatus` | Set by ABR API or admin manual override |
| Document compliance | `Instructor` document fields + `workingHours.expiry` | Expiry dates stored in `workingHours` JSON |
| Audit history | `AuditLog` collection | Immutable — never updated, only appended |
| Reconciliation results | `ReconciliationReport` collection | Written by daily cron |
| Platform settings | `PlatformSettings` (DB) | Single record — managed via `/admin/settings` |
| Subscription status | `Instructor.subscriptionTier` + Stripe subscription | Stripe is authoritative for billing; DB mirrors for fast reads |

---

## What Is NOT Authoritative

| What | Why |
|------|-----|
| `Instructor.commissionRate` | Does not exist — always derived from `PlatformSettings` |
| `Instructor.newStudentBonus` | Does not exist — always derived from `PlatformSettings` |
| UI-displayed balances | Always fetched from DB — never cached client-side for financial decisions |
| Stripe metadata | Informational only — DB is authoritative for platform state |

---

## Conflict Resolution

If data conflicts between two sources:

1. Stripe vs Transaction: Stripe wins for payment status. Run reconciliation to sync.
2. Wallet balance vs WalletTransaction sum: WalletTransaction sum wins. Correct `balance` via admin adjustment.
3. AuditLog vs other sources: AuditLog is the historical record — it does not override current state, but it explains how current state was reached.
4. PlatformSettings vs hardcoded defaults: PlatformSettings wins if a record exists. Hardcoded defaults are fallback only.

---

## Related

- [SYSTEM_FLOWS.md](./SYSTEM_FLOWS.md) — How data moves between sources
- [CONTROL_GUARANTEES.md](./CONTROL_GUARANTEES.md) — How consistency is enforced
- `docs/00-foundation/FINANCIAL_DOCTRINE.md` — Ledger reconstruction and reconciliation
