# WLA-008 — Independent Verification Report

**Finding:** WLA-008 — Cross-Provider Tenant Isolation  
**Report commit:** `3aee1ace` (origin/main, 2026-10-31)  
**Source inspections in this report use exact per-file commit references listed under each sub-finding. The branch head at time of last implementation commit was `0bccc0bb`; categorisation docs followed at `b8fd4d63`; this report was added at `3aee1ace`.**  
**Report prepared:** 2026-10-31  
**Purpose:** Record what has been independently verified, what remains reported-only, and what verifiable evidence exists for each fix. This document is separate from the implementation team's claims so the audit trail remains clear.

---

## How to use this document

Each sub-finding lists:
- **Source verified** — a reviewer inspected the named file at the named commit on GitHub
- **Test design inspected** — a reviewer read the test source; confirms the test is a meaningful check
- **PostgreSQL execution reported** — an execution log is committed; the reviewer has not independently re-run the tests
- **PostgreSQL execution independently reproduced** — a reviewer ran the tests in their own environment and observed the same result
- **Outstanding** — not yet verified

---

## Sub-finding WLA-008-A-txt — Invoice text endpoint IDOR

**Route:** `app/api/instructor/invoices/[transactionId]/route.ts`  
**Fix commit:** `2dc5d81a`

| Claim | Status | Notes |
|---|---|---|
| `findFirst({ where: { id, providerId } })` used (not `findUnique`) | **Source verified** at `2dc5d81a` | Reviewed on GitHub |
| Post-fetch `transaction.providerId !== session.user.providerId` check removed | **Source verified** | 403 branch absent |
| Null result returns 404 (not 403) | **Source verified** | Both cases return 404 |
| A01–A04 source tests pass | **Test design inspected** | Tests read file and check regex patterns |
| PostgreSQL execution | **Not tested** | No DB-backed test for this sub-finding |

---

## Sub-finding WLA-008-A-data — Invoice data endpoint IDOR

**Route:** `app/api/instructor/invoices/[transactionId]/data/route.ts`  
**Fix commit:** `98fb7605`

| Claim | Status | Notes |
|---|---|---|
| `findFirst({ where: { id, providerId } })` used | **Source verified** at `98fb7605` | Reviewed on GitHub |
| Post-fetch ownership check removed; 404 for null | **Source verified** | 403 branch absent |
| D01–D04 source tests pass | **Test design inspected** | Source-pattern checks |
| PostgreSQL execution | **Not tested** | No DB-backed test for this sub-finding |

---

## Sub-finding WLA-008-B — Mobile booking: customer IDOR + payment bypass + concurrency

**Route:** `app/api/bookings/mobile/route.ts`  
**Fix commits:** `2dc5d81a` (ownership + payment), `98fb7605` (wallet into tx), `b75e37fc` (SERIALIZABLE), `68b4778e` (withSerializableRetry + P2034→409), `0bccc0bb` (final)

| Claim | Status | Notes |
|---|---|---|
| Customer ownership check via `bookings: { some: { providerId } }` present | **Source verified** at `0bccc0bb` | Reviewed on GitHub |
| Wallet balance check inside `$transaction` (not outside) | **Source verified** | `tx.clientWallet.findUnique` used |
| `isolationLevel: 'Serializable'` on `$transaction` | **Source verified** | `MOBILE_BOOKING_TX` constant |
| `withSerializableRetry` wraps the transaction | **Source verified** | Import and call site verified |
| P2034 exhausted → HTTP 409 (not 500) | **Source verified** | Catch block pattern verified |
| B01–B10 source tests pass | **Test design inspected** | 10 structural checks, execution reported |
| CONC-01..07 PostgreSQL execution | **Test design inspected; execution reported** | Raw log at `docs/audit/WLA-008B-concurrency-raw.txt`; not independently reproduced |
| RETRY-01..04 behavioral tests pass | **Test design inspected; execution reported** | Tests invoke `withSerializableRetry` directly with real P2034 errors |
| HTTP-01 (409 with 3 tx calls) passes | **Test design inspected; execution reported** | Mocked Prisma; asserts `toHaveBeenCalledTimes(3)` |
| HTTP-02 (201 success) passes | **Test design inspected; execution reported** | Mocked Prisma |

---

## Sub-finding WLA-008-C — Combined booking: rate-limit mitigation

**Route:** `app/api/bookings/combined/route.ts`  
**Fix commit:** `2dc5d81a`  
**Classification:** Abuse-prevention mitigation; not an ownership fix

| Claim | Status | Notes |
|---|---|---|
| `bookingRateLimit` imported | **Source verified** at `2dc5d81a` | Reviewed on GitHub |
| `checkRateLimit` called before any DB query | **Source verified** | `checkRateLimit` appears before `prisma.` in handler |
| 429 returned on limit exceeded | **Source verified** | Status code in handler |
| C01–C05 source tests pass | **Test design inspected** | Source-pattern checks |
| Fail-open limitation documented | **Accepted** | `checkRateLimit` explicitly fail-open; documented in tracker and test header |
| PostgreSQL execution | **Not tested** | Rate limit is Redis-backed; not exercised against PostgreSQL |

---

## Sub-finding WLA-008-TENANT — Quote submission route IDOR

**Route:** `app/api/instructor/quotes/[bookingId]/submit/route.ts`  
**Fix commit:** `0ddace9e` (route scoped query + passes providerId), `0bccc0bb` (mandatory)

| Claim | Status | Notes |
|---|---|---|
| Route uses `findFirst({ where: { id: bookingId, providerId: session.user.providerId } })` | **Source verified** at `0bccc0bb` | Reviewed on GitHub |
| Post-fetch `booking.providerId !== session.user.providerId` check removed | **Source verified** | 403 branch absent |
| `providerId: session!.user!.providerId` passed to `submitQuote()` | **Source verified** | T01 source test; line visible on GitHub |
| T01 source test passes | **Test design inspected** | Checks `findFirst`, `prisma.*.findUnique` absent, `booking.providerId !==` absent |

---

## Sub-finding WLA-008-TENANT-1 — `submitQuote()` service boundary

**Service:** `lib/services/booking-service.ts`  
**Fix commits:** `5f309c06` (optional, with guard), `0bccc0bb` (mandatory, unconditional)

| Claim | Status | Notes |
|---|---|---|
| `QuoteInput.providerId` is `string` (required, no `?`) | **Source verified** at `0bccc0bb` | Reviewed on GitHub; field declaration inspected |
| `findFirst({ where: { id: bookingId, providerId: callerProviderId } })` used unconditionally | **Source verified** at `0bccc0bb` | No conditional guard; `bookingWhere` removed |
| `booking.update({ where: { id: bookingId, providerId: booking.providerId } })` scoped | **Source verified** | Update inside `$transaction` inspected |
| SQ01–SQ05 source tests pass | **Test design inspected** | SQ02 asserts no `?`; SQ04 asserts no `if (callerProviderId)` guard |
| NEG-01: Provider A attempt throws BOOKING_NOT_FOUND | **Test design inspected; PostgreSQL execution reported** | Test calls `submitQuote()` directly with `providerNegAId`; raw log committed |
| NEG-02: zero Quote rows after failed attempt | **Test design inspected; PostgreSQL execution reported** | `$queryRawUnsafe` count assertion |
| NEG-03: Provider B booking status unchanged | **Test design inspected; PostgreSQL execution reported** | `findUnique` status assertion |
| PostgreSQL execution independently reproduced | **Outstanding** | Log at `docs/audit/WLA-008B-concurrency-raw.txt`; not re-run by reviewer |

---

## 13-route ownership review

**Review commit:** `0bccc0bb`–`b8fd4d63`

| Route | Claimed classification | Verification status |
|---|---|---|
| `/api/instructor/clients/[id]` | ✅ SECURED — `bookings.some` pre-scoped | **Source verified** (T02 test inspected; GitHub source inspected at `0bccc0bb`) |
| `/api/instructor/invoices/[transactionId]` | ✅ FIXED | **Source verified** (see WLA-008-A-txt above) |
| `/api/instructor/invoices/[transactionId]/data` | ✅ FIXED | **Source verified** (see WLA-008-A-data above) |
| `/api/instructor/quotes/[bookingId]/submit` | ✅ FIXED | **Source verified** (see WLA-008-TENANT above) |
| `/api/bookings` POST | ✅ SECURED — session-scoped | **Source not independently inspected** — reported by implementation team |
| `/api/bookings/[id]` GET/PATCH/DELETE | ✅ SECURED — `bookingWhere.providerId` | **Source not independently inspected** — R01 test inspected |
| `/api/bookings/batch` POST | ✅ SECURED — session-scoped | **Source not independently inspected** — R02 test inspected |
| `/api/bookings/combined` POST | ✅ MITIGATED (rate limit) | **Source verified** (see WLA-008-C above) |
| `/api/bookings/mobile` POST | ✅ FIXED | **Source verified** (see WLA-008-B above) |
| `/api/client/schedule-package-hours` | ✅ SECURED — session-scoped | **Source not independently inspected** — R03 test inspected |
| `/api/client/quotes/request` | ✅ BY DESIGN | **Source not independently inspected** — T03 test inspected |
| `/api/client/bookings/create-bulk` | ✅ BY DESIGN | **Source not independently inspected** — T05 test inspected |
| `/api/client/bookings/[id]` | ✅ SECURED — `customerId: { in: clientIds }` | **Source not independently inspected** — T04 test inspected |
| `/api/business/branding` | ✅ SECURED — session-scoped | **Source not independently inspected** — T06 test inspected |

---

## Test evidence summary

| Test suite | File | Count | Source inspected | Execution |
|---|---|---|---|---|
| Source inspection | `wla-008-cross-provider-isolation.test.ts` | 37 | Yes — structure reviewed | Reported at `b8fd4d63`; not independently re-run |
| Concurrency + negative-access | `wla-008-b-wallet-concurrency.test.ts` | 10 | Yes — design reviewed | Reported; raw log committed; not independently re-run |
| Retry behavioral | `wla-008-b-mobile-route-http.test.ts` | 4 | Yes — design reviewed | Reported; not independently re-run |
| Route HTTP | `wla-008-b-mobile-route-http.test.ts` | 2 | Yes — design reviewed | Reported; not independently re-run |

---

## Outstanding verification items

The following require independent reproduction before WLA-008 can be closed:

1. **PostgreSQL concurrency test** (CONC-01..07): Re-run `run-wla-008b-concurrency-tests.bat` against PostgreSQL 16.4 at `127.0.0.1:5433` from the reviewer's environment. Verify balance = $20, exactly 1 CONFIRMED booking, 1 debit.

2. **PostgreSQL negative-access test** (NEG-01..03): Re-run the same bat file. Verify `submitQuote()` with Provider A's ID against Provider B's booking throws `BOOKING_NOT_FOUND`, creates no Quote, leaves booking unchanged.

3. **Seven route source inspections** (7 routes not yet independently inspected at `0bccc0bb`):
   - `/api/bookings` POST
   - `/api/bookings/[id]` GET/PATCH/DELETE
   - `/api/bookings/batch` POST
   - `/api/client/schedule-package-hours` POST
   - `/api/client/quotes/request` POST
   - `/api/client/bookings/[id]` GET
   - `/api/business/branding` GET/PUT

4. **Mobile route serialization HTTP behavior**: Confirm HTTP-01 (P2034 → 409) by invoking the route handler with a real or instrumented Prisma client that injects P2034 rather than a mock.

---

## Cross-finding deployment dependencies (tracked separately)

The following deployment checks are not direct WLA-008 tenant-isolation verifications. They relate to separate findings and are listed here only as cross-references.

| Deployment check | Parent finding |
|---|---|
| WLA-007 partial unique index `Provider_customDomain_domainVerified_unique` applied to production DB | WLA-007 |
| WLA-001 `paymentMode` guard schema fields present in production | WLA-001 |

These should be verified under their respective finding IDs, not as WLA-008 closure criteria.

---

## Summary verdict

| Area | Verification status |
|---|---|
| Invoice text + data IDOR fix | Source verified |
| Mobile customer ownership | Source verified |
| Mobile wallet SERIALIZABLE isolation | Source verified |
| Mobile withSerializableRetry + P2034→409 | Source verified |
| Quote route + service mandatory ownership | Source verified |
| PostgreSQL concurrency outcome | Reported; not independently reproduced |
| PostgreSQL negative-access outcome | Reported; not independently reproduced |
| 7 route classifications (see section above) | Reported; direct source inspection by reviewer outstanding |
| WLA-008 overall | **OPEN — implementation complete; independent verification outstanding** |
