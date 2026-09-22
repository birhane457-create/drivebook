# MM-12-B: Admin Wallet Idempotency — HTTP Baseline Execution Evidence

**Status:** EXECUTION VERIFIED  
**Date:** 2026-08-15  
**Branch:** audit/int-m03a-test-verified  
**Commit:** 4889babd  

---

## 1. Executive Summary

All 7 hostile baseline tests pass against the real production route handlers via actual
HTTP requests through the Next.js server connected to an isolated PostgreSQL database.
The tests confirm that both admin wallet routes lack idempotency protection and that
concurrent deductions can race against the balance check.

---

## 2. Test Architecture

```
Vitest (test runner)
  ↓  HTTP requests via supertest
Next.js dev server  localhost:3001
  ↓  full middleware + NextAuth + headers() context
app/api/admin/clients/[id]/wallet/add-credit/route.ts
app/api/admin/clients/[id]/wallet/deduct-credit/route.ts
  ↓  Prisma Client
PostgreSQL  localhost:5433/drivebook_test  (Docker: drivebook-test-db)
```

**Authentication:** Real NextAuth credentials flow.  
- Test admin created in isolated DB with bcrypt password  
- GET `/api/auth/csrf` → CSRF token + cookie  
- POST `/api/auth/callback/credentials` with CSRF cookie echoed back → session cookie  
- Session cookie attached to all subsequent API requests  
- No mocks, no production bypasses  

---

## 3. Production Sources Under Test

| Route | File | Role |
|-------|------|------|
| POST add-credit | `app/api/admin/clients/[id]/wallet/add-credit/route.ts` | Credits admin wallet |
| POST deduct-credit | `app/api/admin/clients/[id]/wallet/deduct-credit/route.ts` | Debits admin wallet |

**Production source SHA at time of testing:** `4889babd`  
(No changes to production wallet logic — routes tested exactly as deployed)

---

## 4. Test Results

### B1 — Sequential Duplicate Credit (VULNERABLE)

| Metric | Value |
|--------|-------|
| Credit A response | HTTP 200 |
| Credit B response (identical) | HTTP 200 |
| Transactions created | 2 |
| Ledger-derived balance | $100 |
| Expected with idempotency | 1 transaction, balance $50 |

**Observation:** Two identical sequential credit requests each create a separate
`WalletTransaction` row and both update the balance. No duplicate detection exists.

---

### B4 — Concurrent Duplicate Credit (VULNERABLE)

| Metric | Value |
|--------|-------|
| Credit A response | HTTP 200 |
| Credit B response (concurrent, identical) | HTTP 200 |
| Transactions created | 2 |
| Ledger-derived balance | $150 |
| Expected with idempotency | 1 transaction, balance $75 |

**Observation:** `Promise.all` of two identical requests both succeed and both persist.
The route has no mechanism to detect or reject concurrent duplicate credits.

---

### B7 — Concurrent Deduction Race / TOCTOU (CONFIRMED)

| Metric | Value |
|--------|-------|
| Starting balance | $60 |
| Debit A ($50) response | HTTP 200 |
| Debit B ($50) response | HTTP 200 |
| Transactions created | 2 |
| Final ledger-derived balance | -$40 |
| Persisted ClientWallet.balance | -40 |

**Observation:** Both concurrent $50 debits passed the balance check and committed.
The `getWalletBalance` read-then-write pattern is not atomic. Under concurrent load,
both reads observe the pre-deduction balance ($60), both pass the `>= amount` check,
and both writes succeed, producing a negative balance of -$40.

This is the TOCTOU (Time Of Check To Time Of Use) race.

---

### B8 — Sequential Deductions Respect Balance (CONTROL)

| Metric | Value |
|--------|-------|
| Starting balance | $40 |
| Debit 1 ($30) response | HTTP 200 |
| Debit 2 ($50) response | HTTP 400 (insufficient balance) |
| Final balance | $10 |

**Observation:** Sequential operations correctly enforce the balance check. The race
only occurs under concurrent execution where both reads precede both writes.

---

### B10 — True Duplicate Retry (NO IDEMPOTENCY)

| Metric | Value |
|--------|-------|
| Original request ($100) | HTTP 200 |
| Retry (identical, after success) | HTTP 200 |
| Transactions created | 2 |
| Balance | $200 |

**Observation:** A client retrying after a confirmed successful operation creates a
second transaction. There is no idempotency key mechanism to detect and reject
the duplicate.

---

### B12 — Ambiguous Response Retry (DUPLICATE CREATED)

| Metric | Value |
|--------|-------|
| Original request ($50, reason: "Payment ref ABC123") | HTTP 200 |
| Retry (identical body, client simulating lost response) | HTTP 200 |
| Transactions created | 2 |
| Balance | $100 |

**Observation:** When a client retries because it did not receive the original response
(network timeout, load balancer drop), the server treats it as a new request. The
`reason` field carries no idempotency semantics.

---

### B13 — Legitimate Distinct Operations (PASS — CORRECT)

| Metric | Value |
|--------|-------|
| Credit A ($75, "Service A refund") | HTTP 200 |
| Credit B ($50, "Service B refund") | HTTP 200 |
| Transactions created | 2 |
| Balance | $125 |

**Observation:** Two genuinely different credits both succeed as expected. Any
idempotency fix must not block legitimate distinct operations with different amounts
or business reasons.

---

## 5. Root Cause Summary

Both routes share the same pattern:

```typescript
// add-credit/route.ts (lines 17–60, no idempotency check)
const session = await getServerSession(authOptions);
const check = await checkPermission(session, PERM.FINANCE_CREDITS_MANAGE);
const { amount, reason } = await req.json();
// ... no idempotency key lookup ...
const wallet = await getOrCreateWallet(params.id);
const tx = await prisma.walletTransaction.create({ ... });
await prisma.clientWallet.update({ balance: { increment: amount } });
```

There is no:
- Idempotency key field in the request body or headers
- `WalletTransaction` uniqueness constraint that could reject duplicates
- Atomic read-check-write transaction wrapping the balance deduction

The deduction route uses `getWalletBalance` (a plain SELECT) then `$executeRaw`
UPDATE — two separate operations with no serialization between them.

---

## 6. What MM-12-B Does NOT Prove

- It does not prove the vulnerability is exploitable in production under current load
- B7 reproduces under local test concurrency; production behavior under Supabase
  connection pooling may serialize some concurrent requests
- The negative balance in B7 is the worst-case race outcome; some concurrent runs
  may serialize and produce a 400 for the second debit

These qualifications do not change the finding: the code contains no protection
against any of these cases.

---

## 7. Next Steps

MM-12-B is EXECUTION VERIFIED. The correct sequence continues:

```
MM-12-A  VERIFIED (source — no idempotency mechanism)
   ↓
MM-12-B  EXECUTION VERIFIED (HTTP baseline — duplicates confirmed, TOCTOU confirmed)
   ↓
MM-12-C  Design verification  ← next
   ↓
MM-12-D  Implementation
   ↓
MM-12-E  Independent verification
   ↓
Production verification
   ↓
CLOSED
```

Service-layer extraction remains OFF the table until MM-12-C design is approved.

---

## 8. Reproducibility

```bat
cd "E:\DOC\flowstate-wms\AI voice assistance - Copy - Copy - Copy\drivebook"

rem Start test DB
docker start drivebook-test-db

rem Run all MM-12-B HTTP tests
powershell -File scripts\run-mm-12b-http-tests.ps1
```

Requires: Docker Desktop running, drivebook-test-db container present, port 3001 free.
