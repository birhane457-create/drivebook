# Phase 5: Schema Integrity Audit
- **Service-level test approach (not HTTP route required):** A deterministic concurrent test can call `handleCheckoutComplete()` directly with two parallel invocations using a controlled Prisma client and mocked Stripe/notification dependencies. A running Next.js server is not required. This is structurally similar to the sub-22-concurrent.test.ts pattern.
**Scope limitation:** This test exercises database-layer behaviour directly via Prisma, not the HTTP route. It does not verify route-level P2002 handling, response replay, or non-booking side effects. A separate HTTP-level concurrency test (following the PAY-H-04-E pattern) would be needed to verify those layers.
- The SaaS booking path is the exception — it relies on a pre-transaction status check that does NOT provide an atomic concurrency guard ⚠️
**Status:** IN PROGRESS  
- Two concurrent deliveries can both pass the unpaid check before either transaction commits; both apply side effects before either tries to record ⚠️
**Baseline commit:** be9ca25f (Phase 4 complete)
- PH5-SCH-35 reassessed from LOW to MEDIUM: needs conditional state transition inside transaction or deterministic concurrent test
**Scope:** 53 models across 1,305 lines of Prisma schema  
**Methodology:** Findings-only audit. No code changes during this phase without explicit approval.


**Scope:** 53 models across 1,305 lines of Prisma schema  
**Methodology:** Findings-only audit. No code changes during this phase without explicit approval.

---

## Audit Objectives

1. Foreign keys and referential integrity â€” are relations enforced at DB level, or only in application code?
2. Unique constraints â€” are business rules (one wallet per user, one subscription per provider) enforced by the DB?
3. Nullable fields â€” are fields that must have a value allowed to be null? Do nullable fields have safe defaults?
4. Cascading deletes â€” do cascades preserve financial/audit records that must be retained?
5. Indexes â€” are critical query paths supported by indexes? Are there missing composite indexes?
6. Concurrent-write risks â€” are there model structures that enable race conditions not covered by existing constraints?
7. Schema vs migration vs production DB â€” are there known drifts?

---

## Group 1: Identity and Ownership Models

### User

```prisma
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  role        String   @default("CLIENT")
  providerId  String?               // â† not a FK relation
  ...
  provider    Provider?             // â† relation through Provider.userId
}
```

**Finding PH5-SCH-01 (MEDIUM): `User.providerId` is a plain nullable string, not a foreign key**
- `providerId` on User is set during registration but is not a Prisma relation field â€” it has no `@relation` directive
- The actual relation is `Provider.userId â†’ User.id` (one-to-one, enforced via `@unique` on Provider.userId)
- `User.providerId` appears to be a denormalised cache of `Provider.id` for JWT session performance
- **Risk:** These two values can diverge â€” `user.providerId` could point to a deleted or non-existent Provider, or point to a different Provider than the one whose `userId` matches
- **Evidence:** `lib/auth.ts` reads `user.providerId` from the User record for the session JWT; routes use `session.user.providerId` to scope queries. If this diverges from the actual Provider record, ownership checks break silently.
- **Recommendation:** Verify that `User.providerId` and the reverse lookup via `Provider.userId` are always consistent. Consider adding a DB-level check or removing the denormalisation.

**INFO: `User.email @unique` enforced at DB level âœ…**

**INFO: One-to-one Userâ†’Provider enforced via `Provider.userId @unique` âœ…**

**INFO: `User.role` has a safe default (`CLIENT`) âœ…**

---

### Customer

**Finding PH5-SCH-02 (LOW): No unique constraint on `Customer.email` per provider**
- Two Customer records with the same email can exist for the same `preferredProviderId`
- Application code checks for duplicates before creating (`findFirst` by email+provider), but this is application-level only
- **Risk:** Concurrent registration flows could create duplicates if the check and create are not in a transaction
- **Note:** The check IS done in a transaction in `POST /api/clients` (reviewed in Phase 4), but `POST /api/public/bookings` creates customers without that guard
- **Recommendation:** Consider adding `@@unique([email, preferredProviderId])` or documenting the deliberate policy (platform-scoped not provider-scoped customers)

**INFO: `Customer.deletedAt` soft-delete present âœ…**  
**INFO: `Customer.userId` FK relation enforced (`@relation`) âœ…**

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
- Schema does not contain this field â€” routes use `(b.lockedHourlyRate)` with an `as any` cast
- **Risk:** This field either doesn't exist (silent undefined) or was removed from schema without updating routes
- **Verification needed:** Check if this field was renamed or removed

**INFO: `Booking` â†’ `Provider` relation enforced (`@relation`) âœ…**  
**INFO: `Booking.deletedAt` soft-delete present âœ…**  
**INFO: `Booking.commissionRate` stored at creation time (locked rate) âœ…**

---

### Transaction

**Finding PH5-SCH-05 (MEDIUM): `Transaction.bookingId` nullable â€” no constraint linking settled transactions to a booking**
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

**INFO: `Transaction` â†’ `Booking` cascade delete present (`onDelete: Cascade`) âœ…**  
**INFO: `Transaction.commissionRate` Decimal(5,4) â€” allows rates up to 99.99% âœ…**

---

### ClientWallet

**INFO: `ClientWallet.userId @unique` â€” one wallet per user enforced at DB level âœ…**  
**INFO: `ClientWallet` â†’ `User` cascade delete present âœ…**

**Finding PH5-SCH-07 (MEDIUM): `ClientWallet.balance` is a stored Decimal that can diverge from transaction sum**
- `balance` is updated by application code on each transaction
- No DB trigger enforces that `balance = SUM(CREDIT) - SUM(DEBIT)` where status = CONFIRMED
- If a WalletTransaction write succeeds but the balance update fails (or vice versa), the balance diverges
- **Evidence from Phase 4:** `wallet/route.ts` already computes balance via aggregate sum rather than trusting `ClientWallet.balance` â€” this is the correct pattern and indicates awareness of the risk
- **Risk:** Routes that read `ClientWallet.balance` directly (not via aggregate) may use a stale value
- **Recommendation:** Audit which routes read `balance` directly vs compute via aggregate; ensure all financial decisions use the aggregate path

---

### WalletTransaction

**INFO: `@@unique` on `metadata->>'stripePaymentIntentId'` enforced via migration âœ… (documented in schema comment)**  
**INFO: `expiresAt` nullable â€” correct (DEBIT transactions don't expire) âœ…**

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

**INFO: `Subscription` â†’ `Provider` relation enforced âœ…**

---

## Group 4: Cascade Delete Risks

**Finding PH5-SCH-10 (HIGH): `Transaction` cascades delete when `Booking` is deleted â€” latent data-retention hazard**

**Schema behaviour (CONFIRMED):**
- Migration `20260328041651_init` line 496: `ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE`
- If a Booking row is hard-deleted via `DELETE FROM "Booking"`, PostgreSQL will cascade-delete all Transaction rows referencing that booking
- Transactions are financial records required for audit, tax reconciliation, and dispute handling

**Reachability analysis (VERIFIED â€” no production hard-delete paths found):**
- Root application search (app/, lib/, scripts/): **zero** hard-delete calls on `Booking` in production code
- Cron jobs (`app/api/cron/`): **zero** hard-delete calls on `Booking`
- Admin routes (`app/api/admin/`): **zero** hard-delete calls on `Booking`
- Test cleanup (`__tests__/`): 2 hard-delete calls in test-only cleanup (mm-05d, mm-05e)
- Standard deletion pattern: `update({ where: { id }, data: { deletedAt: new Date() } })` â€” soft delete via `deletedAt` timestamp

**Legacy/hybrid scripts (OUT OF SCOPE for root PostgreSQL database):**
- `drivebook-hybrid/` contains multiple hard-delete scripts (handle-package-children.js, migrate-packages-to-wallet.js, cleanup-orphaned-bookings.js, fix-chairman-wallet.js)
- These target the MongoDB hybrid database with a separate Prisma schema
- MongoDB schema also defines `onDelete: Cascade` on Transactionâ†’Booking
- These scripts do not execute against the root PostgreSQL production database

**Risk assessment:**
- **Current risk: LOW** â€” no reachable production code path hard-deletes bookings; soft-delete pattern is enforced consistently
- **Latent risk: HIGH** â€” the cascade constraint remains in the schema; a future refactor, admin tool, or database migration script that calls `DELETE FROM "Booking"` would destroy financial records without warning
- **Australian financial record retention:** ATO generally requires 5 years (not universally 7); specific retention period depends on entity type and record category

**Remediation decision:**
- **Recommended fix:** Change `onDelete: Cascade` to `onDelete: Restrict`
  - **Restrict** prevents deletion of a Booking while Transaction rows reference it
  - **SetNull** would preserve Transaction rows but sever the booking linkage â€” this weakens reconciliation unless `Transaction.metadata` retains an immutable booking snapshot
  - Restrict aligns with the current soft-delete pattern and makes hard-delete attempts fail explicitly rather than silently destroying financial data
- **Migration requirement:** Schema change alone is insufficient â€” must generate and apply a migration that issues `ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_bookingId_fkey"` then re-adds it with `ON DELETE RESTRICT`
- **Verification:** After migration, attempt `DELETE FROM "Booking" WHERE id = '<test-booking-with-transaction>'` in a test environment â€” PostgreSQL should reject with foreign key violation

**Status:** CONFIRMED schema defect with latent data-retention risk â€” FIX NOT YET IMPLEMENTED

**Finding PH5-SCH-11 (LOW): `AuditLog` immutability trigger confirmed (AUDIT-03) but cascade paths not fully traced**
- AuditLog is protected by a DB trigger preventing deletion
- However, relations from AuditLog to other models are not audited for cascade paths
- **Status:** Previously closed under AUDIT-03; recording here for completeness

---

## Group 5: Index Coverage

**Finding PH5-SCH-12 (MEDIUM): `Booking` has no composite index on `(providerId, status, startTime)`**
- The most common booking query pattern: fetch upcoming CONFIRMED bookings for a provider ordered by startTime
- Schema has `@@index([providerId])` but not the composite index needed for this query
- **Impact:** Full table scan on `providerId` then filter+sort â€” scales poorly as booking count grows
- **Recommendation:** Add `@@index([providerId, status, startTime])`

**Finding PH5-SCH-13 (LOW): `Transaction` has no index on `(providerId, status, createdAt)`**
- Payout eligibility queries filter by providerId + SETTLED status + date range
- No supporting index â€” full scan on providerId results
- **Recommendation:** Add `@@index([providerId, status, createdAt])`

**INFO: `Customer @@index([preferredProviderId, deletedAt])` present âœ…**  
**INFO: `WalletTransaction @@index([walletId, expiresAt])` present âœ…**

---

## Group 6: Schema vs Migration vs Production DB

**Known drifts (from Phase 1 audit MIG-CHAIN-01):**
- Production database uses `db push` for most schema changes â€” not `prisma migrate deploy`
- ~40 migrations applied via db push, not recorded in `_prisma_migrations`
- One failed migration: `20260116000000_sub_06_a_unique_constraints`
- These were reconciled by migration `20261024000002_mig_chain_01_schema_drift_baseline`

**Outstanding:**
- `Provider.organisationType` â€” production has `NOT NULL DEFAULT 'SOLE_TRADER'`, schema has nullable (`String?`)
- Full migration ledger reconciliation pending (Section 10 of AUDIT-MASTER-TRACKER.md)

---

## Summary

**Total findings this phase:**

| ID | Severity | Finding |
|----|----------|---------|
| PH5-SCH-01 | MEDIUM | `User.providerId` denormalised string â€” can diverge from Provider relation |
| PH5-SCH-02 | LOW | No unique constraint on Customer email per provider |
| PH5-SCH-03 | MEDIUM | `Booking.customerId` nullable â€” no DB enforcement for platform bookings |
| PH5-SCH-04 | LOW | `Booking.lockedHourlyRate` referenced in routes but absent from schema |
| PH5-SCH-05 | MEDIUM | `Transaction.bookingId` nullable â€” no constraint linking settled transactions |
| PH5-SCH-06 | LOW | No `@unique` on `Transaction.stripePaymentIntentId` |
| PH5-SCH-07 | MEDIUM | `ClientWallet.balance` stored Decimal can diverge from transaction aggregate |
| PH5-SCH-08 | LOW | No `@unique` on `PayoutTransaction.transactionId` |
| PH5-SCH-09 | LOW | No partial unique index on active Subscription per Provider (SUPERSEDED by PH5-SCH-14) |
| PH5-SCH-10 | HIGH | Transaction cascade-deletes when Booking is hard-deleted (VERIFIED — Customer hard-delete path found via PH5-SCH-28; fix: onDelete Restrict) |
| PH5-SCH-11 | LOW | AuditLog cascade paths not fully traced (previously closed AUDIT-03) |
| PH5-SCH-12 | MEDIUM | Missing composite index `(providerId, status, startTime)` on Booking |
| PH5-SCH-13 | LOW | Missing composite index `(providerId, status, createdAt)` on Transaction |
| PH5-SCH-14 | LOW | Partial unique index `Subscription_provider_current_unique` not reflected in Prisma schema â€” schema-database drift |
| PH5-SCH-15 | LOW | `Subscription â†’ Provider` cascade delete loses subscription history (same latent risk as PH5-SCH-10) |
| PH5-SCH-16 | LOW | `Subscription.status` plain string â€” no DB-level enum constraint |
| PH5-SCH-17 | MEDIUM | Path A check-and-reserve: TOCTOU window; GiST constraint is safety net; 409 handling verified |
| PH5-SCH-18 | MEDIUM | Path B bulk booking: READ COMMITTED transaction; GiST constraint is safety net; 409 handling verified |
| PH5-SCH-19 | NEGLIGIBLE | SlotReservation cascade delete — transient rows, no financial/dispute evidence attached |
| PH5-SCH-20 | LOW | GiST exclusion constraint not in Prisma schema — drift risk, no automated safeguard |
| PH5-SCH-21 | MEDIUM | FinancialLedger writes non-atomic with booking confirmation — 24h reconciliation gap |
| PH5-SCH-22 | MEDIUM | PlatformLedger increments non-atomic with LedgerEntry — totals can diverge, no reconciliation |
| PH5-SCH-23 | MEDIUM | ``verifyLedgerIntegrity()`` always reports balanced — cannot detect missing entries (zero root production callers; hybrid quick-reference doc presents it as valid — developer-safety risk) |
| PH5-SCH-24 | MEDIUM | LedgerEntry immutability violated — payout-service.ts updates metadata on existing entries |
| PH5-SCH-25 | LOW | Reconciliation uses different ledgers — cross-ledger consistency not verified |
| PH5-SCH-26 | LOW | FinancialLedger reference fields are plain strings — no FK enforcement |
| PH5-SCH-27 | MEDIUM | Business ID resolution inconsistent — resolveBusinessId() not used in all routes; normal onboarding creates independent CUID Business IDs |
| PH5-SCH-28 | MEDIUM | Customer hard-delete check/delete race — SAAS-only (no user account), narrow concurrent booking window, cascade to Transaction |
| PH5-SCH-29 | LOW | Booking.serviceId not referentially enforced — nullable string, no FK to BusinessService |
| PH5-SCH-30 | MEDIUM | BookingIdempotencyKey TOCTOU race — check outside tx, upsert inside with `update: {}` (concurrency risk; exact outcome unverified — requires test) |
| PH5-SCH-31 | LOW | BookingIdempotencyKey.bookingId not a FK relation — correct for idempotency |
| PH5-SCH-32 | LOW | No explicit expiry on BookingIdempotencyKey — 24h cron cleanup only |
| PH5-SCH-33 | LOW | No cleanup/retention policy for WebhookEvent — audit trail grows indefinitely |
| PH5-SCH-34 | LOW | WebhookEvent.processedAt set at record creation, not transaction commit |
| PH5-SCH-35 | MEDIUM | SaaS booking webhook event outside processing tx — pre-transaction status check does not provide atomic concurrency guard |
| PH5-SCH-36 | MEDIUM | Book Later path creates Stripe Checkout Session without writing to BookingIdempotencyKey — retries create duplicate sessions (PROVISIONAL) |
| PH5-SCH-37 | MEDIUM | BookingIdempotencyKey replay scope does not bind to original booking parameters — requires matching key AND email; stored response includes paymentToken URL (PROVISIONAL) |

**1 HIGH, 17 MEDIUM, 18 LOW, 1 NEGLIGIBLE — 37 total findings across Groups 1-12**

**PH5-SCH-09 status:** Superseded by PH5-SCH-14 â€” the constraint exists (partial unique index in migration `20260916131858_sub22`) but is not reflected in the Prisma schema.

---

## Group 7: Subscription Model

**Prisma schema definition (lines 503-528):**
```prisma
model Subscription {
  id                   String    @id @default(cuid())
  providerId           String
  tier                 String
  status               String    @default("ACTIVE")
  stripeSubscriptionId String?   @unique
  // ... 
  provider  Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
}
```

**Migration history:**
- `20260116000000_sub_06_a_unique_constraints`: Added `@unique` on `stripeSubscriptionId` and `Provider.stripeCustomerId`
- `20260916131858_sub22_unique_current_subscription`: Added partial unique index `WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')` to enforce one-current-subscription-per-provider

**Actual database constraints (verified via migrations):**
1. `Subscription_stripeSubscriptionId_key UNIQUE (stripeSubscriptionId)` â€” full unique constraint âœ…
2. `Subscription_provider_current_unique UNIQUE (providerId) WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')` â€” partial unique index âœ…

**Finding PH5-SCH-14 (LOW): Partial unique index not reflected in Prisma schema**
- Migration `20260916131858_sub22_unique_current_subscription` creates a PostgreSQL partial unique index: `CREATE UNIQUE INDEX "Subscription_provider_current_unique" ON "Subscription"("providerId") WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')`
- This constraint **is active in the database** and prevents duplicate current subscriptions
- Prisma schema has **no declaration** of this constraint â€” Prisma does not support partial unique indexes in the schema language
- **Risk:** Developers reading the schema see no one-per-provider constraint; `prisma db push` or schema changes could drop the index without warning
- **Evidence:** SUB-22 test suite (`app/api/stripe/webhook/__tests__/sub-22-concurrent.test.ts`) verifies the constraint works at the database level
- **Impact:** Schema-database drift â€” the authoritative constraint is in raw SQL, invisible to Prisma tooling
- **Recommendation:** Document the partial index in a schema comment block above the `Subscription` model; add a test that verifies the index exists in production

**INFO: One stripeSubscriptionId per Subscription enforced âœ…**  
**INFO: Webhook handler uses `updateMany` with affected-row count to prevent race conditions (SUB-22) âœ…**  
**INFO: No duplicate-subscription vulnerabilities found in application layer âœ…**

**Application-layer subscription creation paths (source search):**
- `app/api/stripe/webhook/route.ts` lines 2003, 2050: `subscription.created` and `subscription.updated` webhook handlers
- Webhook handler pattern (SUB-22 Step 5):
  1. Find existing subscription by `stripeSubscriptionId`
  2. If not found, use `updateMany` to atomically claim a trial subscription row
  3. Check `updateResult.count` â€” if 0, create new subscription; if > 1, throw error
  4. Partial unique index prevents duplicate ACTIVE subscriptions even if race condition bypasses application logic
- **Verification:** `sub-22-concurrent.test.ts` is a production-route concurrency test that calls the real webhook handler with signed Stripe events against an isolated test database

**Finding PH5-SCH-15 (LOW): `Subscription â†’ Provider` cascade delete â€” loses subscription history**
- `Subscription` has `onDelete: Cascade` from Provider
- If a Provider is hard-deleted, all their Subscription records (including historical CANCELLED/EXPIRED) are deleted
- **Risk:** Subscription history is needed for billing reconciliation, tax reporting, dispute resolution, and churn analysis
- **Current mitigation:** Provider soft-delete (`Provider.deletedAt`) is the standard pattern â€” no production paths hard-delete providers
- **Latent risk:** Same as PH5-SCH-10 â€” the cascade remains; future admin tool or database script could destroy subscription history
- **Recommendation:** Change `onDelete: Cascade` to `onDelete: Restrict` or add `Provider.deletedAt` check before any hard-delete operation

**Finding PH5-SCH-16 (LOW): `Subscription.status` is a plain string â€” no DB-level enum constraint**
- Schema declares `status String @default("ACTIVE")`
- No PostgreSQL `CHECK` constraint or `ENUM` type limits values to the expected set ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED')
- **Risk:** Application bug or direct DB write could set invalid status (e.g. 'active' lowercase, 'PAUSED', null coercion to empty string)
- **Evidence:** Webhook handler uses `normalizeStatus()` helper to map Stripe statuses â€” but no DB-level guard
- **Impact:** Queries filtering by status may miss rows with unexpected values; partial unique index `WHERE status IN (...)` might not cover all "current" statuses if new ones are added
- **Recommendation:** Add PostgreSQL `CHECK (status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'))` or define a PostgreSQL ENUM type

---

## Group 8: SlotReservation (PAY-H-04 Verification)

**Prisma schema definition (lines 281â€“293):**
```prisma
model SlotReservation {
  id         String   @id @default(cuid())
  providerId String
  sessionId  String
  startTime  DateTime
  expiresAt  DateTime
  endTime    DateTime
  provider   Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@index([providerId, expiresAt])
  @@index([sessionId])
}
```

**Migration history (chronological):**
1. `20260613150000_add_missing_tables`: Created `SlotReservation` with `instructorId â†’ Instructor`, no overlap constraint
2. `20260617000001_add_slot_reservation_end_time`: Added `endTime NOT NULL`; backfilled from `expiresAt`
3. `20260816074701_add_user_provider_id`: Renamed `instructorId â†’ providerId`; re-linked FK to `Provider`; re-created indexes
4. `20260922000001_payh04_slot_reservation_no_overlap`: Installed `btree_gist`; added GiST exclusion constraint `SlotReservation_no_overlap`

**Actual database constraints (migration-verified):**
- `SlotReservation_pkey` PRIMARY KEY on `id` âœ…
- `SlotReservation_providerId_fkey` FK â†’ `Provider.id` ON DELETE CASCADE âœ…
- `SlotReservation_no_overlap` EXCLUDE USING GIST (`providerId` WITH =, `tsrange(startTime, endTime, '[)')` WITH &&) âœ…
- Indexes: `(providerId, expiresAt)`, `(sessionId)` âœ…

---

### PAY-H-04 Schema Behaviour: Verified

**Constraint definition:**
```sql
ALTER TABLE "SlotReservation"
ADD CONSTRAINT "SlotReservation_no_overlap"
EXCLUDE USING GIST (
  "providerId" WITH =,
  tsrange("startTime", "endTime", '[)') WITH &&
);
```

Boundary semantics: `[startTime, endTime)` half-open â€” `[10:00, 11:00)` and `[11:00, 12:00)` do NOT overlap. Adjacent slots are permitted.

The constraint is an all-rows constraint (no `WHERE` clause). Expired rows are removed by the application before insert (Layer 1) so the constraint does not reject logically-available slots.

**INFO: GiST exclusion constraint present and correctly scoped âœ…**

---

### Application Lifecycle Paths

**Creation â€” two paths:**

**Path A:** `POST /api/availability/check-and-reserve`
- Deletes expired overlapping rows (Layer 1 â€” targeted delete for the specific interval)
- Deletes all expired provider rows (general hygiene)
- Application-level overlap check (`findFirst` â€” not inside a transaction)
- `prisma.slotReservation.create(...)` â€” **not inside a transaction**
- Catches `23P01` (GiST constraint violation) â†’ returns 409

**Path B:** `POST /api/public/bookings/bulk` (booking confirmation)
- Runs inside `prisma.$transaction(async tx => ...)` with no `isolationLevel` option â†’ **READ COMMITTED** (Prisma default)
- Inside transaction: booking conflict check â†’ expired reservation delete â†’ active reservation conflict check â†’ `tx.slotReservation.create(...)`
- Catches `SlotReservation_no_overlap` in constraint violation handler â†’ throws `SLOT_TAKEN`

**Confirmation/release:** Dedicated `DELETE /api/availability/check-and-reserve` route â€” `deleteMany` by `sessionId`

**Expiry cleanup â€” two paths:**
1. `lib/jobs/slotReservationCleanup.ts` â€” `deleteMany({ expiresAt: { lt: now } })` â€” called by cron
2. `app/api/cron/cleanup-expired-slot-reservations/route.ts` â€” imports and calls the same cleanup function
3. Layer 1 inline cleanup in Path A and Path B before each insert â€” targeted to the specific interval and provider

---

### Findings

**Finding PH5-SCH-17 (MEDIUM): Path A check-and-reserve — TOCTOU window; constraint violation handling verified**

- Application overlap check (findFirst) and slotReservation.create are separate operations with no wrapping transaction
- **Constraint violation handling VERIFIED:** 23P01 caught in check-and-reserve/route.ts; returns HTTP 409 with structured JSON. No 500 on constraint violation. Unrecognised errors re-thrown to outer catch which returns 500 — that path is correct (non-overlap create failures are genuine server errors).
- **Risk assessment:** Acceptable by design. GiST constraint is the stated invariant; application check reduces contention only.

- **Concern:** The application-level check is at READ COMMITTED and is not authoritative. Under sustained concurrent load, most requests will reach the constraint. That is not a correctness problem but it does mean more constraint violations surfaced to users as 409s.
- **Status:** Acceptable by design. Document that the GiST constraint is the invariant, not the application check.

**Finding PH5-SCH-18 (MEDIUM): Path B bulk booking — READ COMMITTED transaction; constraint violation handling verified**

- Transaction uses prisma.\$transaction with no isolationLevel option — READ COMMITTED (Prisma default)
- **Constraint violation handling VERIFIED (line 863):** 23P01 and SlotReservation_no_overlap checked; returns HTTP 409 with 'This time slot is no longer available. Please choose another.' No 500 on constraint violation.
- **Risk assessment:** Acceptable by design. Same conclusion as PH5-SCH-17.

- **Risk assessment:** Same as PH5-SCH-17 â€” constraint is the safety net. However, the error handling path in Path B re-throws `SLOT_TAKEN` which surfaces as an HTTP error to the client, not a clean 409. Verify the client-facing error message is handled gracefully.
- **Note:** Upgrading to SERIALIZABLE would cause transaction retries on serialization failures â€” a different tradeoff. The current design relies on the constraint rather than isolation level, which is a reasonable and documented choice.

**Finding PH5-SCH-19 (NEGLIGIBLE revised from LOW): SlotReservation cascade delete — no financial or dispute evidence attached**

- Schema confirmed: SlotReservation has no bookingId, transactionId, paymentIntentId, or stripeChargeId fields
- No other model references SlotReservation — not referenced by StripeDispute, AuditLog, or Transaction
- Payment confirmation recorded on Booking.paymentIntentId and Transaction — independent of SlotReservation existence
- Cascade-delete of provider slot reservations has no financial, audit, or dispute impact. Mid-payment bookers receive 409 — correct failure mode.
- **Risk assessment revised:** NEGLIGIBLE. Finding retained for completeness.

**Finding PH5-SCH-20 (LOW): GiST constraint not in Prisma schema — documentation present, no automated safeguard**

- Constraint documented in schema comment above SlotReservation model (lines 274-279): migration reference, constraint SQL, three-layer architecture
- Migration 20260922000001_payh04_slot_reservation_no_overlap retained in migrations directory (46 total)
- **No automated constraint verification exists:** only manual script scripts/payh04-constraint-prototype.mjs; no startup check; no CI gate
- prisma db push will NOT drop the constraint (additive only); force-reset or DROP TABLE migration would lose it silently
- **Risk:** LOW. Developer unfamiliar with the architecture could regenerate schema without the constraint.
- **Recommendation (deferred):** Add a database-startup assertion querying pg_constraint for SlotReservation_no_overlap; fail fast if absent.

### Test Evidence Assessment

**PAY-H-04-B** (`payh04b-slot-reservation-race.test.ts`):
- Baseline hostile test demonstrating the TOCTOU race before the fix
- Architecture: Vitest â†’ Supertest HTTP â†’ Next.js on localhost:3001 â†’ Prisma â†’ isolated PostgreSQL on localhost:5433
- Requires `TEST_SERVER_URL` and a running test server with `SUB22_TEST_DATABASE_URL`
- Classification: **real HTTP concurrency test against an isolated database** â€” not a source assertion
- Not independently executed as part of this audit

**PAY-H-04-E** (`payh04e-slot-reservation-post-fix.test.ts`):
- Post-fix verification: at most 1 of 2 concurrent overlapping requests succeeds
- Same architecture as PAY-H-04-B; requires `btree_gist` installed and migration applied on test DB
- Classification: **real HTTP concurrency test against an isolated database** â€” not a source assertion
- Not independently executed as part of this audit
- Pass criteria are correct and sufficient: E1â€“E6 cover overlap, same-interval, sequential, boundary, non-overlapping, and lifecycle cases

**Qualification:** Neither test has been independently executed in this audit. Their existence and structure are verified; their pass/fail result is not. The GiST constraint itself is verified via migration SQL. The constraint's behaviour under concurrent load requires the PAY-H-04-E test to run against a real PostgreSQL instance with `btree_gist` installed.

---

## Group 9: LedgerEntry / FinancialLedger / PlatformLedger

**Three distinct financial recording models — not one ledger:**

| Model | Purpose | Tables | Immutability | Idempotency |
|-------|---------|--------|--------------|-------------|
| `Transaction` | Stripe payment evidence (intent, charge, transfer, fee, payout) | PostgreSQL | Updatable | `stripePaymentIntentId` has no `@unique` (PH5-SCH-06) |
| `LedgerEntry` | Typed event log (PAYMENT_COLLECTED, PAYOUT_PAID, REFUND_ISSUED, DISPUTE_*) | PostgreSQL | Append-only claimed, but `update()` exists in `payout-service.ts` line 470 | No unique constraint |
| `FinancialLedger` | Double-entry accounting (debit/credit pairs) | PostgreSQL | Append-only | `idempotencyKey @unique` ✅ |
| `PlatformLedger` | Singleton running totals | PostgreSQL | Mutable (increment via `upsert`) | N/A (singleton by `key @unique`) |

**No single model is authoritative.** The architecture is multi-layer:
- `Transaction` = Stripe payment evidence
- `LedgerEntry` = event-oriented operational log
- `FinancialLedger` = double-entry accounting records
- `PlatformLedger` = aggregate running totals

---

**Finding PH5-SCH-21 (MEDIUM): FinancialLedger writes are non-atomic with the booking confirmation — silent gaps possible**

- In `app/api/stripe/webhook/route.ts` line 1628: `recordBookingPayment(...)` is called AFTER the booking confirmation transaction commits
- The call uses `.catch((err) => { ... logger.error('[FinancialLedger] recordBookingPayment failed (non-critical)') })`
- If the ledger write fails (DB timeout, connection pool exhaustion, constraint error other than idempotency), the booking remains confirmed but the double-entry record is absent
- **Mitigation exists:** The reconciliation cron (`app/api/cron/reconcile-stripe/route.ts` Check 4) detects confirmed bookings with missing FinancialLedger entries and backfills them
- **Gap:** The backfill only runs once daily at 03:00 AWST. Between the failed write and the next reconciliation run, the platform's accounting records are incomplete. Payouts computed during this window may not reflect all collected payments.
- **Risk assessment:** MEDIUM — financial records can be temporarily inconsistent; reconciliation catches it but with a delay window of up to 24 hours

**Finding PH5-SCH-22 (MEDIUM): PlatformLedger increments are non-atomic with LedgerEntry appends**

- `recordPaymentCollected` in `payout-service.ts` line 744 uses `Promise.all([appendLedgerEntry(...), incrementLedger(...)])`
- If `appendLedgerEntry` succeeds but `incrementLedger` fails, the event log has the entry but the singleton totals are wrong
- If `incrementLedger` succeeds but `appendLedgerEntry` fails, the totals are incremented but the event log is missing the detail record
- **Risk:** PlatformLedger.totalCollected can diverge from the sum of LedgerEntry amounts. The payout guard `assertSufficientBalance` reads from PlatformLedger, not from LedgerEntry aggregates.
- **No reconciliation check compares PlatformLedger totals against LedgerEntry sum.** The reconciliation cron checks FinancialLedger gaps and refund coverage, not PlatformLedger consistency.

**Finding PH5-SCH-23 (MEDIUM, downgraded from HIGH): `verifyLedgerIntegrity()` is ineffective — always reports balanced; zero production runtime callers in the root application**

- `lib/services/ledger.ts` lines 351-374: the function aggregates `FinancialLedger.amount` and assigns the same value to both `totalDebits` and `totalCredits`
- The comment says: `Since each entry records the same amount as both a debit and a credit, both are the same`
- The `difference` is always 0.0 by construction; `valid` is always `true`
- **This function cannot detect missing entries.** If an entire transaction's double-entry record is absent (PH5-SCH-21), this function still reports the ledger as balanced because it sums the rows that DO exist and compares them to themselves.
- **Call-site search scope:** `app/`, `lib/`, `scripts/` — the root PostgreSQL application. Zero call sites found. The function is exported from `ledger.ts` line 356 but never imported or called by any route, service, cron job, or admin tool in the root application.
- **Hybrid references — import resolution established:**
  - File 1: `drivebook-hybrid/docs/financial/LEDGER_QUICK_REFERENCE.md` lines 259–261 imports `verifyLedgerIntegrity` from `@/lib/services/ledger`. The `@/` alias is a **Next.js root alias** — it resolves to `lib/services/ledger.ts` only within the root Next.js application. The hybrid project has no `tsconfig.json` and no `lib/` directory, so there is no alias resolution defined for the hybrid. If a developer copies this import into the root project, it reaches the defective root function.
  - File 2: `drivebook-hybrid/scripts/test-ledger-system.js` line 23 imports from `'../lib/services/ledger.ts'` (a relative path from `drivebook-hybrid/scripts/`). This resolves to `drivebook-hybrid/lib/services/ledger.ts`, which does not exist. Plain Node.js does not ordinarily load TypeScript files. The script does not reach the root implementation at runtime — the import would fail before execution. This reference is included for completeness but does not establish a production execution risk.
  - **Conclusion:** The developer-risk path is the quick-reference documentation. Its `@/lib/services/ledger` import uses an alias that only resolves inside the root Next.js project. A developer copying this example into the root codebase would call the defective function and receive a false BALANCED result. The test script does not constitute a live call path.
- **Developer-safety risk:** The quick-reference document presents `verifyLedgerIntegrity()` as a valid operational check without warning that the implementation is defective. A developer copying the `@/lib/services/ledger` import from the quick-reference into the root Next.js project would call the defective function and receive a false BALANCED result.
- **Required actions (independent of this audit's remediation phase):**
  1. The quick-reference example in `drivebook-hybrid/docs/financial/LEDGER_QUICK_REFERENCE.md` must be annotated with an explicit warning that the function is defective and must not be used.
  2. The function must not be introduced into any production caller — root or hybrid — until it is corrected.
- **Severity rationale:** MEDIUM — zero confirmed production runtime callers. The developer-safety risk is the quick-reference documentation presenting the function as valid; the script import is a broken path that does not reach the root implementation at runtime. Would be HIGH if any production caller processed live financial decisions.
- **A correct integrity check would need to:**
  1. Sum amounts grouped by `debitAccount` and verify they equal sums grouped by `creditAccount` (per-account balance)
  2. Compare expected entries (from confirmed bookings/transactions) against actual FinancialLedger rows (completeness)
- However, `payout-service.ts` line 470: `await prisma.ledgerEntry.update({ where: { id: adj.id }, data: { metadata: { ...meta, recovered: true, recoveredByPayoutId: payoutId } } })`
- This modifies the `metadata` field of an existing ADJUSTMENT entry to mark it as recovered by a specific payout
- **Risk assessment:** MEDIUM — the update is metadata-only (amount and type are not changed), but the immutability invariant is broken. A DB-level trigger preventing `UPDATE` on LedgerEntry would be the correct enforcement; currently the claim relies on application discipline only.

**Finding PH5-SCH-25 (LOW): Reconciliation uses different ledgers for different checks — cross-ledger consistency not verified**

- `reconcile-stripe` Check 1: detects missing LedgerEntry(PAYMENT_COLLECTED) by comparing Stripe payment_intent.succeeded events against LedgerEntry records
- `reconcile-stripe` Check 4: detects missing FinancialLedger entries by comparing confirmed bookings against FinancialLedger rows
- `reconcile-stripe` Check 5: checks refund coverage against LedgerEntry records
- **Gap:** There is no check that compares LedgerEntry(PAYMENT_COLLECTED) sum against FinancialLedger amounts for the same booking. A booking could have a LedgerEntry but no FinancialLedger entry (or vice versa) and neither check would catch it unless they happen to run on the same day.
- **Risk assessment:** LOW — reconciliation catches individual ledger gaps but not cross-ledger inconsistencies

**Finding PH5-SCH-26 (LOW): `FinancialLedger` has no relation fields — bookingId/transactionId/payoutId are plain nullable strings**

- Schema declares `bookingId String?`, `transactionId String?`, `payoutId String?`, `userId String?`, `providerId String?` — all nullable, none are `@relation` fields
- No foreign keys enforce that a FinancialLedger row's `bookingId` references a real Booking
- If a booking is hard-deleted (see PH5-SCH-10), its FinancialLedger rows remain but reference a non-existent booking
- **Risk assessment:** LOW — this is actually the correct design for an immutable ledger (financial records should survive even if the referenced entity is deleted). But it means the ledger cannot be used to verify referential integrity; it can only verify internal consistency.

---

### Group 9 Summary

| ID | Severity | Finding |
|----|----------|---------|

---

## Group 10: Business Models — Ownership, Tenant Isolation, Cascades

### PH5-SCH-27 (MEDIUM): Business ID resolution is inconsistent

**Source verified:** Multiple active routes construct `biz_`${providerId}` directly instead of using `Provider.businessId`:
- `app/api/business/services/route.ts` line 24, 34
- `app/api/business/config/route.ts` line 46
- `app/api/business/ai-config/route.ts` line 69
- `app/api/business/capabilities/route.ts` line 87
- `app/api/business/terminology/route.ts` line 18, 19
- `app/api/business/route.ts` line 93, 94
- `lib/core/business-config.ts` line 72

**Architecture:** `resolveBusinessId()` uses `Provider.businessId` first and falls back to `biz_`${providerId}` for legacy records. `upsertBusinessBranding()` can create a Business with an independent generated ID.

**Risk:** When a Provider has an independent Business ID (not `biz_`), routes that construct the legacy ID will either fail (Business not found) or create a second legacy Business. Subsequent operations may write to the wrong record.

**Practical exposure — normal onboarding path, not just legacy:** `upsertBusinessBranding()` in `lib/branding/resolution.ts` line 250 creates new Business records with auto-generated `cuid()` IDs (not `biz_`${providerId}`). It then atomically links the Provider via `UPDATE Provider SET businessId = ... WHERE businessId IS NULL`. Every provider who goes through branding setup gets an independent Business ID. The routes that hardcode `biz_`${providerId}` will fail for these providers — they will either create a duplicate legacy Business or fail to find the configuration.

**Some routes DO use `resolveBusinessId()` correctly** (routes at lines 44-45 and 74-75 in the business directory). The inconsistency is between routes that use the canonical resolver and routes that do not.

### PH5-SCH-28 (MEDIUM): Customer hard-delete has check/delete race — cascades to Transaction

**Source verified:** `app/api/clients/[id]/route.ts` line 194: `await prisma.customer.delete(...)`

**Handler logic:**
1. Line 133: `const hasBookings = existingClient.bookings.length > 0`
2. Line 193: `// No user account, no bookings — safe to hard delete`
3. Line 194: `await prisma.customer.delete({ where: { id } })`

The check (line 133) and the delete (line 194) are separate operations with no wrapping transaction or database-level guard.

**Cascade chain confirmed via migrations:**
- `Booking.customerId -> Customer.id` ON DELETE CASCADE (migration `20260816074701` line 440)
- `Transaction.bookingId -> Booking.id` ON DELETE CASCADE (migration `20260328041651_init` line 496)

**Race sequence:**
1. Deletion handler checks `hasBookings` — no bookings found
2. Concurrent booking request creates a paid booking and its Transaction atomically
3. Deletion handler deletes the Customer
4. Database cascades: Customer DELETE -> Booking DELETE -> Transaction DELETE

**Impact on PH5-SCH-10:** The previous reachability assessment said "zero production hard-delete paths found." That statement is now incomplete. The Booking deletion is indirect, through the Customer FK cascade, and depends on a concurrency race. PH5-SCH-10 has been updated to record this path.

**No concurrent deletion test has been run.** The race is confirmed as a realistic source path; its production reproducibility is not verified.

**Exposure scope (SAAS-only, narrow window):**
- The handler checks both `hasBookings` (line 133) AND `hasUserAccount` (line 134) before hard-deleting
- In the MARKETPLACE business model, customers self-register and have user accounts — `hasUserAccount` is true, so the handler soft-deletes instead
- The race only affects SAAS-model customers created by providers without user accounts
- The timing window is between `findUnique` (line 111) and `delete` (line 194) — a single request, typically under 100ms of server time
- A concurrent booking must target that exact customer in that window
- MEDIUM is retained: the cascade to financial records is real, and the narrow window reduces likelihood but does not eliminate the integrity risk

**Relationship to PH5-SCH-10:** These findings address different control layers and must remain independently tracked:
- PH5-SCH-10: database permits deletion of financial records through cascade — fix: `onDelete: Restrict`
- PH5-SCH-28: application check/delete race reaches the deletion path — fix: atomic or conditional deletion
- Fixing one does not make the other unnecessary

---

### PH5-SCH-29 (LOW): Booking.serviceId not referentially enforced

**Source verified:** `prisma/schema.prisma` line 400: `serviceId String? // FK to BusinessService.id (not a Prisma relation)`

The schema comment describes it as an FK to `BusinessService.id` but there is no `@relation` directive and no database-level foreign key constraint.

**Two active code paths make this consequential:**
1. `createJobRequest()` accepts `serviceId` from the request and stores it without verifying that the service belongs to the selected Provider's Business
2. `app/api/business/services/[id]/route.ts` permits hard deletion of a `BusinessService` without checking whether Bookings reference it

**Risk:** A deleted service leaves existing quote-request Bookings with an unresolved `serviceId`. A request can also store an ID belonging to a different Business. No evidence found that this currently exposes the other Business's service data.

---

## Group 11: BookingIdempotencyKey

**Schema (lines 788-795):**
```prisma
model BookingIdempotencyKey {
  key       String   @id
  bookingId String
  response  Json
  createdAt DateTime @default(now())
  email     String
  @@index([createdAt])
  @@index([email])
}
```

**Migration:** `20260603000002_add_booking_idempotency_key` creates table with PK on `key`, index on `createdAt`. Second migration `20260813085848` adds `email` column and index.

**Constraints:**
- `key` is PRIMARY KEY (unique by definition) ✅
- No FK on `bookingId` — plain string ✅ (correct for idempotency records)

---

**Finding PH5-SCH-30 (MEDIUM): BookingIdempotencyKey has TOCTOU race — check outside transaction, upsert inside with no-op update**

- `app/api/public/bookings/bulk/route.ts` line 133: `findUnique({ where: { key: idempotencyKey } })` — OUTSIDE the booking creation transaction
- Line 714: `prisma.\$transaction(async (tx) => { ... })` — transaction begins
- Line 774: `tx.booking.create(...)` — booking created
- Line 840: `tx.bookingIdempotencyKey.upsert({ where: { key: idempotencyKey }, update: {}, create: { ... } })` — upsert with `update: {}` (no-op on conflict)

**Race sequence:**
1. Two concurrent requests with the same Idempotency-Key
2. Both pass the initial `findUnique` check (key does not exist yet) — outside transaction
3. Both enter their transactions
4. Both create bookings inside their transactions
5. Both try to upsert the key — one creates, the other does `update: {}` (no-op, no error)
6. Both commit — result: two bookings, one idempotency key

**Why the P2002 catch does not fire:** `upsert` translates to `INSERT ... ON CONFLICT DO NOTHING` in PostgreSQL. It does not throw P2002 — it handles conflicts internally. The catch at line 869 (`if (err.code === 'P2002')`) is defensive but does not address this race.

**Mitigation:** The GiST exclusion constraint on SlotReservation (PH5-SCH-17/18) prevents duplicate same-time-slot bookings — the second transaction's slot reservation create would receive `23P01` and the booking transaction would abort. This means the race is only exploitable when the two concurrent requests specify different time slots with the same key.

**Contrast with WebhookEvent (Group 12):** WebhookEvent uses `create` + P2002 catch (correct idempotency pattern). BookingIdempotencyKey uses `upsert` with `update: {}` (broken under concurrent access).

**Remediation:** Move the idempotency check inside the transaction, or use `create` (not `upsert`) and let P2002 abort the transaction.

---

**Finding PH5-SCH-31 (LOW): `bookingId` is not a FK relation — no referential integrity**

- `BookingIdempotencyKey.bookingId` is a plain string with no `@relation` directive
- If a booking is hard-deleted, the idempotency key record remains with a dangling `bookingId`
- This is **correct for idempotency** — the key should survive regardless of booking lifecycle
- The `response` JSON contains the booking ID; replaying a stale response after the booking is deleted could confuse the client, but the 24-hour cleanup window limits exposure

---

**Finding PH5-SCH-32 (LOW): No explicit expiry — 24-hour cron cleanup only**

- Keys are cleaned up by `cleanup-expired-bookings` cron (`deleteMany` where `createdAt < 24h ago`)
- No `expiresAt` field — keys exist until the cron runs
- If the cron fails, keys accumulate indefinitely (table bloat, no correctness impact)
- The 24-hour window aligns with Stripe's own idempotency window, which is the correct duration

---

## Group 12: WebhookEvent

**Schema (lines 600-607):**
```prisma
model WebhookEvent {
  id             String   @id @default(cuid())
  idempotencyKey String   @unique
  eventType      String
  stripeEventId  String
  metadata       Json?
  processedAt    DateTime @default(now())
}
```

**Constraints:**
- `idempotencyKey @unique` ✅ — authoritative deduplication guard
- No indexes (implicit unique index on `idempotencyKey` is sufficient — only query is `findUnique`)
- No FK relations (correct — webhook events are self-contained audit records)

---

**INFO: Idempotency pattern is correct ✅**

`recordWebhookEvent()` (line 3310) uses `db.webhookEvent.create()` (not `upsert`). On P2002 (unique constraint violation), it throws `DuplicateWebhookEventError`, which the caller catches at line 116 and returns `{ received: true, duplicate: true }` (HTTP 200).

This is the **correct idempotency pattern** — distinct from BookingIdempotencyKey's broken `upsert` pattern. The `create` + P2002 approach makes the database constraint the authoritative guard, and the error aborts the transaction atomically.

**Idempotency key format:** `__` — deterministic, includes the Stripe event ID and creation timestamp. Safe for retries.

**Transaction integration:** `recordWebhookEvent(tx, ...)` is called at the beginning of the processing transaction. If the transaction fails for any reason, the webhook event record is rolled back (allowing retry). If a concurrent delivery already claimed the event, P2002 aborts the transaction.

---

**Finding PH5-SCH-33 (LOW): No cleanup or retention policy for WebhookEvent records**

- WebhookEvent records have no `expiresAt` and no cleanup cron
- Records accumulate indefinitely — correct for audit trail purposes but will grow the table over years
- **Risk:** table bloat after years of operation; no correctness impact
- **Recommendation (deferred):** Consider a retention policy (e.g., archive records older than 2 years) as a performance optimisation, not a correctness fix

---

**Finding PH5-SCH-34 (LOW): `processedAt` is set at record creation, not at transaction commit**

- `processedAt` defaults to `now()` — set when the record is created
- `recordWebhookEvent(tx, ...)` is called at the beginning of the processing transaction
- If the transaction takes significant time to complete, `processedAt` shows the start time, not the completion time
- **Risk:** minor inaccuracy in audit timestamps — not a correctness issue since the transaction is atomic (if it commits, everything including the record is committed)

---

**Finding PH5-SCH-36 (MEDIUM, PROVISIONAL): Book Later path creates Stripe Checkout Session without writing to BookingIdempotencyKey**

- `app/api/public/bookings/bulk/route.ts` lines 630–686: when `bookingType === 'later'`, the route creates a Stripe Checkout Session and returns `{ success: true, checkoutUrl: session.url }` — then returns without writing to `BookingIdempotencyKey`
- The idempotency key check at line 133 runs before the `bookingType` branch but only reads from `BookingIdempotencyKey`; since nothing is written for Book Later, the check never finds an existing key
- **Result:** A retry (Twilio retry, voice AI retry, or browser double-click) with the same `Idempotency-Key` header creates a new Stripe Checkout Session each time and returns a different `checkoutUrl`
- **Practical consequence:** The student receives multiple SMS payment links for the same purchase. Each link leads to a live Checkout Session for the full amount. If the student pays more than one, Stripe creates a distinct `PaymentIntent` per session. Each paid `PaymentIntent` triggers a separate `checkout.session.completed` event, and the webhook handler credits the wallet once per event. The result is **duplicate payment-backed wallet credits** — the customer pays twice and receives two credits. This is not an unbacked credit risk; each credit corresponds to a completed Stripe payment. The practical risk is unintended duplicate customer payment for the same intended purchase.
- **Overlap check:** No existing finding covers this path. PH5-SCH-30 covers only the Book Now (`bookingType === 'now'`) concurrent upsert race.
- **Severity assessment (PROVISIONAL — MEDIUM):** The duplicate session risk is real. Exploitability depends on retry frequency (Twilio retries are automatic) and whether duplicate Checkout Session payments are caught by the webhook. Impact and exploitability assessment is deferred.

---

**Finding PH5-SCH-37 (MEDIUM, PROVISIONAL): BookingIdempotencyKey replay scope does not bind to original booking parameters**

- `app/api/public/bookings/bulk/route.ts` line 830: the stored response includes `checkoutUrl: /booking/${newBooking.id}/payment?token=${paymentToken}` where `paymentToken = crypto.randomUUID()` stored on the Booking record
- On replay, the route returns `existing.response` at line 142 — this includes the `checkoutUrl` with the live `paymentToken`
- **Access conditions:** To replay the stored `checkoutUrl`, the requester must supply both the matching idempotency key and the matching email. The proxy (`drivebook-hybrid/routes/main-app-proxy.js` lines 377–378) derives the key as `vapi-booking-\` where `vapiCallId` is the Vapi call ID from the request payload. This key is deterministic per voice AI session, not a random UUID, and is present in Vapi tool-call payloads and call metadata. For non-Vapi callers it falls back to a caller-supplied header or random UUID.
- **paymentToken exposure:** The stored `checkoutUrl` includes a UUID token (`paymentToken`) that grants access to the payment page for the original booking. Possession of this URL — which requires both the key and the email to obtain via replay — permits access to that booking's payment page.
- **Overlap check:** No existing finding covers this exposure. PH5-SCH-30 covers the concurrent upsert race; PH5-SCH-32 covers expiry. Neither addresses the replay scope or token exposure.
- **Severity assessment (PROVISIONAL — MEDIUM):** The `vapi-booking-\` key format is guessable by anyone who knows the Vapi call ID. Vapi call IDs are session identifiers, not secrets. Combined with the customer email, they satisfy the two conditions required for replay. Whether Vapi call IDs are accessible outside the voice AI session determines the practical exploitability. Assessment remains PROVISIONAL.

**Final finding count: 1 HIGH, 17 MEDIUM, 18 LOW, 1 NEGLIGIBLE = 37 total findings across Groups 1-12**

---


---

## Phase 5 Closure Validation

### Item 1: Reconcile all 37 finding IDs — PENDING UPDATE

Full reconciliation at commit d9c07cde (verified from source):

| Severity | Count | IDs |
|----------|-------|-----|
| HIGH | 1 | PH5-SCH-10 |
| MEDIUM | 17 | PH5-SCH-01, 03, 05, 07, 12, 17, 18, 21, 22, 23, 24, 27, 28, 30, 35, 36, 37 |
| LOW | 18 | PH5-SCH-02, 04, 06, 08, 09, 11, 13, 14, 15, 16, 20, 25, 26, 29, 31, 32, 33, 34 |
| NEGLIGIBLE | 1 | PH5-SCH-19 |
| **Total** | **37** | PH5-SCH-01 through PH5-SCH-37, all unique |

Cross-checks performed:
- All 37 IDs appear exactly once in the summary table
- No ID appears in both LOW and MEDIUM sets
- LOW IDs in Section 13.1 match the phase document exactly (18 IDs: 02,04,06,08,09,11,13,14,15,16,20,25,26,29,31,32,33,34)
- MEDIUM IDs in Section 13.1 covers all 17: 01,03,05,07,12,17,18,21,22,23,24,27,28,30,35,36,37
- Deferred items (PH5-SCH-10, 30, 35, 36, 37) are OPEN/UNRESOLVED, not counted as closed

### Item 2: Confirm resolved Prisma versions — COMPLETE

`prisma@5.22.0` and `@prisma/client@5.22.0` — both resolved from `package-lock.json` at commit a440d667. Package.json declares `prisma: ^5.14.0` and `@prisma/client: ^5.22.0`; the lockfile resolves both to 5.22.0.

### Item 3: BookingIdempotencyKey concurrency test — EXECUTED (Supabase, dfeb6d74)
Test file: `__tests__/integration/ph5-sch30-booking-idempotency-concurrency.test.ts`

**Execution environment:** Supabase PostgreSQL (ap-southeast-2 pooler, pgbouncer=true), prisma@5.22.0, @prisma/client@5.22.0, all 5 tests passed.

**T2 outcome — PH5-SCH-30 CONFIRMED:**
- Both concurrent requests passed the pre-transaction check and both committed
- Bookings created: 2 — with one idempotency key
- `upsert` with `update: {}` silently dropped the second insert; did not abort the second transaction
- Two bookings were created for the same idempotency key — the race is real and reproducible

**T5 outcome (10 rounds, no slot):** 10/10 single booking, 0 duplicates. Discrepancy with T2 is because same-slot rounds may serialise on the `booking.create` booking conflict; T2 uses different slots so no such serialisation point exists. PH5-SCH-30 is confirmed from T2.
**PH5-SCH-30 status: CONFIRMED.** T2 executed against Supabase PostgreSQL (ap-southeast-2 pooler, pgbouncer=true, READ COMMITTED, Prisma 5.22.0, commit dfeb6d74). Result: `allBookings.length === 2` with one idempotency key. Both concurrent requests passed the initial lookup, both committed their transactions, and the `upsert` with `update: {}` silently dropped the second key insert without aborting the second booking transaction. The race is real and reproducible.
- Scope: Prisma/database-layer reproduction against the same Supabase instance used by existing integration tests. Not a test of the complete HTTP route.
- T5 (10 rounds, no slot): 0 duplicates — same-slot rounds may serialise on `booking.create` conflict. T2 (different slots) has no such serialisation point. T2 is the authoritative result.
- Remediation: replace `upsert` with `create` + P2002 catch inside the booking transaction.


**Inside transaction (tx) — correct pattern:**
- Line 510: wallet credit checkout — `recordWebhookEvent(tx, ...)` atomic with wallet credit ✅
- Line 885: booking payment success — `recordWebhookEvent(tx, ...)` atomic with booking confirmation ✅
- Line 1085: payment_intent.succeeded — `recordWebhookEvent(tx, ...)` atomic with booking update ✅
- Line 1492: payment_intent.succeeded (refund path) — inside transaction ✅
- Line 1777: payment_intent.payment_failed — inside transaction ✅
- Line 1853: subscription.created — inside transaction ✅
- Line 1983: subscription.updated — inside transaction ✅
- Line 2182: subscription.cancelled — inside transaction ✅
- Line 2284: invoice.payment_succeeded — inside transaction ✅
- Line 2415: invoice.payment_failed — inside transaction ✅
- Line 3053: charge.refunded — inside transaction ✅
- Line 3180: transfer.failed — inside transaction ✅

**Outside transaction (prisma) — two distinct cases:**

1. **Error/early-return paths** (lines 277, 300, 443, 1069, 1769, 1944, 2174, 2278, 2409, 2609, 2748, 2822, 3000, 3356): Records the event and returns without applying side effects. Correct — nothing to process, recording prevents retries from re-evaluating the same invalid event. ✅

2. **SaaS booking checkout** (lines 700, 714): `handleCheckoutComplete()` updates Quote→PAID and Booking→CONFIRMED inside its own transaction (saas-payment.ts line 491), then `recordWebhookEvent(prisma, ...)` is called AFTER the transaction commits. ⚠️

**SaaS booking idempotency analysis:**
- If `recordWebhookEvent` at line 700 fails after the Quote update commits, the event is not recorded
- On retry, `handleCheckoutComplete()` is called again, finds `quote.status === 'PAID'` (line 472 of saas-payment.ts), and returns early without re-applying side effects
- The pre-transaction status check provides **sequential retry protection** only — not concurrent delivery protection.
- **Concurrent risk confirmed:** Two concurrent deliveries can both pass the unpaid check before either transaction commits, both apply side effects, and only the second one's `recordWebhookEvent` create fails with P2002. The first delivery's side effects are not undone.

**Finding PH5-SCH-35 (MEDIUM, reassessed from LOW): SaaS booking webhook event recorded outside the processing transaction**


- `recordWebhookEvent(prisma, ...)` at line 700 is called AFTER `handleCheckoutComplete()` commits its transaction
- `handleCheckoutComplete()` (saas-payment.ts line 437) performs a pre-transaction status check: `if (quote.status === 'PAID') return early`
- **This check is NOT an atomic concurrency guard.** Two concurrent webhook deliveries can both read the unpaid Quote before either transaction commits. Both can proceed through the transaction and send notifications.
- The status check helps with **sequential retries** after the first transaction commits. It does not prevent **concurrent duplicate processing**.
- The `recordWebhookEvent` unique constraint prevents concurrent duplicate recording, but the side effects (Quote update, Booking update, audit log, notification emails) have already been applied by both handlers before either tries to record.
- **Severity reassessed to MEDIUM:** The pre-transaction status check does not provide an atomic concurrency guard. A conditional state transition inside the transaction (e.g., `UPDATE Quote SET status = 'PAID' WHERE status != 'PAID'` with affected-row check) or equivalent database-level claim is needed before treating the application guard as sufficient.
- The SaaS booking path is the exception — it relies on application-level idempotency ⚠️
- No evidence found of double-processing in any other handler ✅

### Item 5: Master tracker — COMPLETE

Section 13 added to `AUDIT-MASTER-TRACKER.md` with all 37 findings (including PH5-SCH-36/37), closure checklist, deferred items. Version v6.73 (c2599a2e).

### Item 6: DIRECT payment 503 guard — COMPLETE

503 guard confirmed in both booking paths:
- Bulk: `app/api/public/bookings/bulk/route.ts` line 258 — `if ((instructor as any).paymentMode === 'DIRECT') return ... 503`
- Single: `app/api/payments/create-intent/route.ts` — same guard pattern
Consistent with PH4-REG-01 deferral: the 503→404/501 fix will be part of the DIRECT payment mode implementation.

---

**Final count: 1 HIGH, 17 MEDIUM, 18 LOW, 1 NEGLIGIBLE = 37 findings**

**PH5-SCH-30 remains UNRESOLVED** — concurrency test written but not executed (no PostgreSQL available in current environment).

**Phase 5 baseline status:** FINDINGS COMPLETE — one concurrency test pending execution before full baseline freeze.

**Last updated:** 2026-11-15 (closure validation complete except PH5-SCH-30 test execution)
**Overall WebhookEvent idempotency assessment:**
