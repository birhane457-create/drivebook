# Phase 5: Schema Integrity Audit

**Version:** 1.0  
**Date:** 2026-11-15  
**Status:** IN PROGRESS  
**Auditor:** Kiro  
**Baseline commit:** be9ca25f (Phase 4 complete)

**Scope:** 53 models across 1,305 lines of Prisma schema  
**Methodology:** Findings-only audit. No code changes during this phase without explicit approval.

---

## Audit Objectives

1. Foreign keys and referential integrity — are relations enforced at DB level, or only in application code?
2. Unique constraints — are business rules (one wallet per user, one subscription per provider) enforced by the DB?
3. Nullable fields — are fields that must have a value allowed to be null? Do nullable fields have safe defaults?
4. Cascading deletes — do cascades preserve financial/audit records that must be retained?
5. Indexes — are critical query paths supported by indexes? Are there missing composite indexes?
6. Concurrent-write risks — are there model structures that enable race conditions not covered by existing constraints?
7. Schema vs migration vs production DB — are there known drifts?

---

## Group 1: Identity and Ownership Models

### User

```prisma
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  role        String   @default("CLIENT")
  providerId  String?               // ← not a FK relation
  ...
  provider    Provider?             // ← relation through Provider.userId
}
```

**Finding PH5-SCH-01 (MEDIUM): `User.providerId` is a plain nullable string, not a foreign key**
- `providerId` on User is set during registration but is not a Prisma relation field — it has no `@relation` directive
- The actual relation is `Provider.userId → User.id` (one-to-one, enforced via `@unique` on Provider.userId)
- `User.providerId` appears to be a denormalised cache of `Provider.id` for JWT session performance
- **Risk:** These two values can diverge — `user.providerId` could point to a deleted or non-existent Provider, or point to a different Provider than the one whose `userId` matches
- **Evidence:** `lib/auth.ts` reads `user.providerId` from the User record for the session JWT; routes use `session.user.providerId` to scope queries. If this diverges from the actual Provider record, ownership checks break silently.
- **Recommendation:** Verify that `User.providerId` and the reverse lookup via `Provider.userId` are always consistent. Consider adding a DB-level check or removing the denormalisation.

**INFO: `User.email @unique` enforced at DB level ✅**

**INFO: One-to-one User→Provider enforced via `Provider.userId @unique` ✅**

**INFO: `User.role` has a safe default (`CLIENT`) ✅**

---

### Customer

**Finding PH5-SCH-02 (LOW): No unique constraint on `Customer.email` per provider**
- Two Customer records with the same email can exist for the same `preferredProviderId`
- Application code checks for duplicates before creating (`findFirst` by email+provider), but this is application-level only
- **Risk:** Concurrent registration flows could create duplicates if the check and create are not in a transaction
- **Note:** The check IS done in a transaction in `POST /api/clients` (reviewed in Phase 4), but `POST /api/public/bookings` creates customers without that guard
- **Recommendation:** Consider adding `@@unique([email, preferredProviderId])` or documenting the deliberate policy (platform-scoped not provider-scoped customers)

**INFO: `Customer.deletedAt` soft-delete present ✅**  
**INFO: `Customer.userId` FK relation enforced (`@relation`) ✅**

---

## Group 2: Financial Models

### Booking

**Finding PH5-SCH-03 (MEDIUM): `Booking.customerId` is nullable with no DB-level owner requirement**
- Offline bookings legitimately have no `customerId` (cash customers)
- But platform bookings should always have a `customerId`
- Application enforces this in routes, but no `@@check` or conditional constraint exists
- **Risk:** A bug in a booking creation path could create a platform booking with no customer linkage, breaking financial reconciliation
- **Recommendation:** Document the invariant explicitly; consider a DB-level check if the ORM supports it

**Finding PH5-SCH-04 (LOW): `Booking.lockedHourlyRate` field not in schema**
- Phase 4 audit found routes referencing `booking.lockedHourlyRate` in serialization
- Schema does not contain this field — routes use `(b.lockedHourlyRate)` with an `as any` cast
- **Risk:** This field either doesn't exist (silent undefined) or was removed from schema without updating routes
- **Verification needed:** Check if this field was renamed or removed

**INFO: `Booking` → `Provider` relation enforced (`@relation`) ✅**  
**INFO: `Booking.deletedAt` soft-delete present ✅**  
**INFO: `Booking.commissionRate` stored at creation time (locked rate) ✅**

---

### Transaction

**Finding PH5-SCH-05 (MEDIUM): `Transaction.bookingId` nullable — no constraint linking settled transactions to a booking**
- A SETTLED Transaction with no bookingId creates a reconciliation gap
- Application always creates Transactions with bookingId for booking payments, but no DB constraint enforces this for `type = 'BOOKING_PAYMENT'`
- **Risk:** A bug or manual admin action could create an unlinked settled transaction
- **Recommendation:** Consider `@@check` or document that bookingId can only be null for non-BOOKING_PAYMENT types

**Finding PH5-SCH-06 (LOW): No `@unique` on `Transaction.stripePaymentIntentId`**
- Multiple Transaction records could reference the same Stripe PaymentIntent
- Application creates one Transaction per booking payment, but no DB constraint prevents duplicates
- **Risk:** Webhook replay or race condition could create two confirmed Transactions for one payment
- **Note:** `BookingIdempotencyKey` prevents duplicate bookings, but doesn't prevent duplicate Transaction creation directly
- **Recommendation:** Add `stripePaymentIntentId String? @unique` or a partial unique index on non-null values

**INFO: `Transaction` → `Booking` cascade delete present (`onDelete: Cascade`) ✅**  
**INFO: `Transaction.commissionRate` Decimal(5,4) — allows rates up to 99.99% ✅**

---

### ClientWallet

**INFO: `ClientWallet.userId @unique` — one wallet per user enforced at DB level ✅**  
**INFO: `ClientWallet` → `User` cascade delete present ✅**

**Finding PH5-SCH-07 (MEDIUM): `ClientWallet.balance` is a stored Decimal that can diverge from transaction sum**
- `balance` is updated by application code on each transaction
- No DB trigger enforces that `balance = SUM(CREDIT) - SUM(DEBIT)` where status = CONFIRMED
- If a WalletTransaction write succeeds but the balance update fails (or vice versa), the balance diverges
- **Evidence from Phase 4:** `wallet/route.ts` already computes balance via aggregate sum rather than trusting `ClientWallet.balance` — this is the correct pattern and indicates awareness of the risk
- **Risk:** Routes that read `ClientWallet.balance` directly (not via aggregate) may use a stale value
- **Recommendation:** Audit which routes read `balance` directly vs compute via aggregate; ensure all financial decisions use the aggregate path

---

### WalletTransaction

**INFO: `@@unique` on `metadata->>'stripePaymentIntentId'` enforced via migration ✅ (documented in schema comment)**  
**INFO: `expiresAt` nullable — correct (DEBIT transactions don't expire) ✅**

---

### Payout / PayoutTransaction

**Finding PH5-SCH-08 (LOW): No unique constraint on `PayoutTransaction.transactionId`**
- A single Transaction could appear in multiple Payouts
- Application code filters by covered transaction IDs, but no DB constraint prevents the same Transaction being added to two different Payout records
- **Risk:** Double-payout if the exclusion logic has a race condition
- **Note:** This was partially addressed by MM-15 fixes, but at the application layer only
- **Recommendation:** Add `@@unique([transactionId])` to `PayoutTransaction`

---

## Group 3: Subscription Model

**Finding PH5-SCH-09 (LOW): No `@@unique([providerId])` on active Subscription**
- Multiple active Subscription records can exist for one Provider
- SUB-22 added `@@unique` constraints for specific scenarios, but a provider can still have multiple ACTIVE subscriptions if the application creates them without checking
- **Evidence from Phase 1:** SUB-02-B race condition was fixed at application layer; DB constraint not added
- **Recommendation:** Add a partial unique index: `@@unique([providerId])` filtered to `status IN ('ACTIVE', 'TRIAL')`, or confirm the application-layer guard is sufficient

**INFO: `Subscription` → `Provider` relation enforced ✅**

---

## Group 4: Cascade Delete Risks

**Finding PH5-SCH-10 (HIGH): `Transaction` cascades delete when `Booking` is deleted — latent data-retention hazard**

**Schema behaviour (CONFIRMED):**
- Migration `20260328041651_init` line 496: `ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE`
- If a Booking row is hard-deleted via `DELETE FROM "Booking"`, PostgreSQL will cascade-delete all Transaction rows referencing that booking
- Transactions are financial records required for audit, tax reconciliation, and dispute handling

**Reachability analysis (VERIFIED — no production hard-delete paths found):**
- Root application search (app/, lib/, scripts/): **zero** hard-delete calls on `Booking` in production code
- Cron jobs (`app/api/cron/`): **zero** hard-delete calls on `Booking`
- Admin routes (`app/api/admin/`): **zero** hard-delete calls on `Booking`
- Test cleanup (`__tests__/`): 2 hard-delete calls in test-only cleanup (mm-05d, mm-05e)
- Standard deletion pattern: `update({ where: { id }, data: { deletedAt: new Date() } })` — soft delete via `deletedAt` timestamp

**Legacy/hybrid scripts (OUT OF SCOPE for root PostgreSQL database):**
- `drivebook-hybrid/` contains multiple hard-delete scripts (handle-package-children.js, migrate-packages-to-wallet.js, cleanup-orphaned-bookings.js, fix-chairman-wallet.js)
- These target the MongoDB hybrid database with a separate Prisma schema
- MongoDB schema also defines `onDelete: Cascade` on Transaction→Booking
- These scripts do not execute against the root PostgreSQL production database

**Risk assessment:**
- **Current risk: LOW** — no reachable production code path hard-deletes bookings; soft-delete pattern is enforced consistently
- **Latent risk: HIGH** — the cascade constraint remains in the schema; a future refactor, admin tool, or database migration script that calls `DELETE FROM "Booking"` would destroy financial records without warning
- **Australian financial record retention:** ATO generally requires 5 years (not universally 7); specific retention period depends on entity type and record category

**Remediation decision:**
- **Recommended fix:** Change `onDelete: Cascade` to `onDelete: Restrict`
  - **Restrict** prevents deletion of a Booking while Transaction rows reference it
  - **SetNull** would preserve Transaction rows but sever the booking linkage — this weakens reconciliation unless `Transaction.metadata` retains an immutable booking snapshot
  - Restrict aligns with the current soft-delete pattern and makes hard-delete attempts fail explicitly rather than silently destroying financial data
- **Migration requirement:** Schema change alone is insufficient — must generate and apply a migration that issues `ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_bookingId_fkey"` then re-adds it with `ON DELETE RESTRICT`
- **Verification:** After migration, attempt `DELETE FROM "Booking" WHERE id = '<test-booking-with-transaction>'` in a test environment — PostgreSQL should reject with foreign key violation

**Status:** CONFIRMED schema defect with latent data-retention risk — FIX NOT YET IMPLEMENTED

**Finding PH5-SCH-11 (LOW): `AuditLog` immutability trigger confirmed (AUDIT-03) but cascade paths not fully traced**
- AuditLog is protected by a DB trigger preventing deletion
- However, relations from AuditLog to other models are not audited for cascade paths
- **Status:** Previously closed under AUDIT-03; recording here for completeness

---

## Group 5: Index Coverage

**Finding PH5-SCH-12 (MEDIUM): `Booking` has no composite index on `(providerId, status, startTime)`**
- The most common booking query pattern: fetch upcoming CONFIRMED bookings for a provider ordered by startTime
- Schema has `@@index([providerId])` but not the composite index needed for this query
- **Impact:** Full table scan on `providerId` then filter+sort — scales poorly as booking count grows
- **Recommendation:** Add `@@index([providerId, status, startTime])`

**Finding PH5-SCH-13 (LOW): `Transaction` has no index on `(providerId, status, createdAt)`**
- Payout eligibility queries filter by providerId + SETTLED status + date range
- No supporting index — full scan on providerId results
- **Recommendation:** Add `@@index([providerId, status, createdAt])`

**INFO: `Customer @@index([preferredProviderId, deletedAt])` present ✅**  
**INFO: `WalletTransaction @@index([walletId, expiresAt])` present ✅**

---

## Group 6: Schema vs Migration vs Production DB

**Known drifts (from Phase 1 audit MIG-CHAIN-01):**
- Production database uses `db push` for most schema changes — not `prisma migrate deploy`
- ~40 migrations applied via db push, not recorded in `_prisma_migrations`
- One failed migration: `20260116000000_sub_06_a_unique_constraints`
- These were reconciled by migration `20261024000002_mig_chain_01_schema_drift_baseline`

**Outstanding:**
- `Provider.organisationType` — production has `NOT NULL DEFAULT 'SOLE_TRADER'`, schema has nullable (`String?`)
- Full migration ledger reconciliation pending (Section 10 of AUDIT-MASTER-TRACKER.md)

---

## Summary

**Total findings this phase:**

| ID | Severity | Finding |
|----|----------|---------|
| PH5-SCH-01 | MEDIUM | `User.providerId` denormalised string — can diverge from Provider relation |
| PH5-SCH-02 | LOW | No unique constraint on Customer email per provider |
| PH5-SCH-03 | MEDIUM | `Booking.customerId` nullable — no DB enforcement for platform bookings |
| PH5-SCH-04 | LOW | `Booking.lockedHourlyRate` referenced in routes but absent from schema |
| PH5-SCH-05 | MEDIUM | `Transaction.bookingId` nullable — no constraint linking settled transactions |
| PH5-SCH-06 | LOW | No `@unique` on `Transaction.stripePaymentIntentId` |
| PH5-SCH-07 | MEDIUM | `ClientWallet.balance` stored Decimal can diverge from transaction aggregate |
| PH5-SCH-08 | LOW | No `@unique` on `PayoutTransaction.transactionId` |
| PH5-SCH-09 | LOW | No partial unique index on active Subscription per Provider |
| PH5-SCH-10 | HIGH | Transaction cascade-deletes when Booking is hard-deleted |
| PH5-SCH-11 | LOW | AuditLog cascade paths not fully traced (previously closed AUDIT-03) |
| PH5-SCH-12 | MEDIUM | Missing composite index `(providerId, status, startTime)` on Booking |
| PH5-SCH-13 | LOW | Missing composite index `(providerId, status, createdAt)` on Transaction |

**1 HIGH, 4 MEDIUM, 8 LOW**

**Next audit targets within Phase 5:**
- Subscription model constraints
- SlotReservation (PAY-H-04 fix confirmed — verify constraint still present)
- LedgerEntry / FinancialLedger relation integrity
- ProviderDiscovery and Business models
- BookingIdempotencyKey and WebhookEvent idempotency structures

---

**Last updated:** 2026-11-15
