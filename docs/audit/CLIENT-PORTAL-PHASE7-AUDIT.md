# Client Portal Phase 7 — Booking Flow Corrections

**Status:** OPEN
**Updated:** 2026-11-19
**Version:** 2.2
**Authoritative tracker:** `docs/audit/AUDIT-MASTER-TRACKER.md`, Section 15
**Phase 6:** Section 14 remains closed and unchanged.

## Scope

This update implements the lesson and PDA wallet-flow corrections, separates lesson and PDA cart items, and addresses the duration-unit portion of CP-UX-04. Customers can choose a lesson only, a PDA only, or both in one checkout. The isolated PostgreSQL checkout, recovery, refund, and reconciliation tests pass; broader timezone, production, visual, accessibility, navigation, and business-logic verification remains open.

## CP-UX-01 — Normal lesson checkout

The client previously persisted a preliminary booking before the final lesson checkout and passed an authenticated User ID where the API expected a Customer ID. The client now keeps the selection in its cart until final checkout. The server derives the Customer record from the authenticated User and delegates the paid booking to the wallet transaction service.

**Stage:** Source and isolated PostgreSQL HTTP verification pass for the covered checkout and recovery scenarios. Broader production verification remains open; do not mark `FIX-VERIFIED` or `CLOSED`.

## CP-UX-02 — PDA booking and payment

Standalone PDA booking is intended product behavior, not a defect. The Client Portal supports PDA-only checkout and lesson-only checkout, as well as a combined lesson/PDA checkout. The combined cart stores lessons and PDA tests independently: removing a lesson detaches but preserves its PDA as a standalone item, and removing a PDA leaves its lesson intact.

The Client Portal standalone PDA and combined lesson/PDA flows submit through the wallet booking route. The server resolves the Customer from the authenticated User, checks the instructor's active configuration and test-centre eligibility, calculates the authoritative PDA price with Decimal arithmetic, and rejects stale client quotes. The production wallet transaction records the lesson and PDA separately and performs one combined debit.

The client checkout pages send an `Idempotency-Key` and reuse it for retries of an unchanged payload while the checkout page remains mounted. The wallet route prefixes the key with the database-resolved User ID, checks the stored account email, fingerprints the parsed request, and returns 409 if the same key is reused for different content. The `BookingIdempotencyKey.key` primary key enforces uniqueness. The production service claims the key, writes lessons/PDA bookings and one debit, and stores the response in the same SERIALIZABLE transaction. A duplicate-key claim replays the winner's stored response without another booking or debit.

The cleanup cron purges idempotency records older than 24 hours and is scheduled daily. Retries after that retention window are not guaranteed to replay and may be treated as new requests.

Post-commit financial recovery now runs after the transaction and on same-key replay. If ledger/reporting recovery fails, the route returns `503 FINANCIAL_RECORDS_PENDING` while preserving the committed checkout; a same-key retry resumes the missing work without creating another booking or debit. Ledger insertions use stable idempotency keys and verify existing rows before marking financial records complete.

PDA accounting is separately reportable: the full paid amount is recorded as a customer-wallet-liability to `PDA_FUNDS_HELD` entry. No instructor earning, payout, platform fee, or revenue is recognized. Cancellation refunds credit the wallet and reverse held funds; booking status and financial status are separate. Refund work is keyed for retry safety, and the admin finance API exposes a funds-held reconciliation report. This does not claim legally segregated escrow. The legacy `/api/pda-bookings` route remains for its separate public booking callers and retains its prior pending-payment behavior; its Customer identity is server-derived.

The PostgreSQL HTTP suite ran against the isolated local database `127.0.0.1:5433/drivebook_test` on PostgreSQL 16.4. It passed lesson-only, PDA-only, combined checkout, duplicate/replay/changed-content behavior, post-commit ledger failure and recovery, full refund/replay, partial refund, no-refund cancellation, and reconciliation assertions.

**Stage:** Implementation, mocked routes, and isolated PostgreSQL checkout/recovery/refund/reconciliation tests pass. Broader PDA and production verification remain open; do not mark the finding `FIX-VERIFIED` or `CLOSED`.

## CP-UX-04 — Duration and timezone

The wallet service converts the cart's hour-based duration at the request boundary and stores `Booking.duration` in minutes. Client-facing profile, detail, and mobile API responses normalize legacy customer lesson rows that stored hours. The schema documents minutes as the canonical field unit. The wallet checkout's PDA future-time preflight converts the submitted local date/time through the resolved provider timezone before comparing it with the current instant.

Provider IANA timezone is authoritative. Lesson wallet bookings, PDA wallet bookings, legacy PDA scheduling, combined PDA scheduling, PDA availability, and PDA cancellation/deadline calculations now use the provider timezone through `localDateTimeToUTC()` or timezone-aware formatting. Sydney DST coverage passed for summer/winter offsets. Perth fallback remains the default for missing/invalid provider timezone values.

**Stage:** Partially implemented. Duration, provider-timezone conversion, and PDA future-time validation checks pass; production display, reschedule, and broader Australian timezone verification remain open.

## Verification

- Pre-fix route-level reproductions returned the reported identity failures. These used mocked Prisma and do not establish database behavior.
- Mocked regressions: `npx vitest run __tests__/integration/cp-ux-booking-identity.test.ts lib/utils/__tests__/booking-duration.test.ts lib/utils/__tests__/client-booking-cart.test.ts` — exit 0; 19/19 passed.
- Route and mocked regression run: `npx vitest run __tests__/integration/cp-ux-booking-identity.test.ts __tests__/integration/cp-ux-booking-http-postgres.test.ts --reporter=verbose --no-color` — exit 0; 21/21 tests passed. This included 13 mocked route tests and 8 real PostgreSQL HTTP tests against PostgreSQL 16.4 at isolated `127.0.0.1:5433/drivebook_test`.
- Timezone follow-up: Sydney summer/winter DST conversion checks passed 3/3; a focused wallet/PDA route run passed 6/6. Provider timezone is now used across wallet and legacy PDA booking paths, PDA availability, and cancellation deadlines.
- PDA future-time validation: `npx vitest run __tests__/integration/cp-ux-booking-identity.test.ts -t "PDA time that is past|standalone PDA" --reporter=verbose --no-color` — exit 0; 2/2 passed. The regression rejects a Perth-local time that is already past even though interpreting the same wall time as UTC would make it appear future.
- Isolated PostgreSQL: `npx vitest run __tests__/integration/cp-ux-wallet-idempotency-postgres.test.ts --reporter=verbose --no-color` — exit 0; 2/2 passed on PostgreSQL 17.6. Concurrent duplicate submission produced one booking, one `WalletTransaction` debit, one key record, and a $200→$140 balance; same-key retry replayed, and changed content conflicted. Rollback test left 0 bookings, 0 debits, 0 idempotency rows, and balance unchanged at $200.
- Requested runtime pair: `npx vitest run __tests__/integration/cp-07-profile-booking-counts.test.ts __tests__/integration/cp-03-wallet-concurrency.test.ts --reporter=verbose --no-color` — exit 0; 23/23 passed on PostgreSQL 17.6. The production-service concurrency case recorded one P2034, attempts 2/1, one booking, one debit, and final balance $20. The CP-07 run was execution evidence only; Section 14 status was not changed.
- A first combined run including all three PostgreSQL files returned P1001 for CP-07; separate reruns of CP-07 and the requested CP-07/CP-03 pair passed.
- `npx tsc --noEmit --pretty false` — exit 0 for the production TypeScript scope. `tsconfig.json` excludes tests and operational scripts from the Next.js application typecheck; those files are not validated by this command.
- `npx prisma validate --schema prisma\schema.prisma` — passed against the isolated local database. `npx prisma generate --schema prisma\schema.prisma` — passed after the isolated PostgreSQL cluster was started.
- `git diff --check` — exit 0.
- The new PostgreSQL HTTP suite passed, establishing checkout persistence, wallet debits, PDA held/refund ledgers, and same-key post-commit recovery against the isolated database. Broader timezone and full production HTTP journey verification remain outside this suite.
- Vercel status for commit `647c501f47321e26629a178544681c786c8fcfe9` is `failure`. The supplied logs identify invalid UTF-8 in `app/client-dashboard/bookings/page.tsx`; three legacy Windows-1252 punctuation bytes were replaced with their intended Unicode characters. With the dev server stopped to avoid `.next` contention, `npm run build` passed with exit 0. A new Vercel result for the UTF-8 repair commit is still required; this workspace has no Vercel CLI, auth file, or linked project.
- Earlier local build attempts overlapped an active Next dev server and failed while moving or loading `.next` artifacts. After stopping the explicitly approved dev process, the serialized production build completed successfully.

**Database isolation:** The suite ran against local disposable PostgreSQL `127.0.0.1:5433/drivebook_test`, not the hosted or production database. Database cleanup verified zero `CPUX_HTTP_*` users, zero `CPUX_HTTP_CUSTOMER_*` customers, zero bookings, and zero PDA bookings after the run. The previously exposed credential was not reused. An admin ledger UI was not found in the app tree; reconciliation is exposed by the finance API. Whether the API satisfies the reporting requirement or a dashboard is needed remains open.

CP-UX-03 and CP-UX-05 through CP-UX-09 remain provisional and unverified. CP-UX-04 remains open for broader timezone display/reschedule verification and production review. No Phase 7 finding is closed by this update.
