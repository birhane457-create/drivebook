# P0-01A/B Docker Local Evidence

**Date:** September 25, 2026
**Evidence tier:** Local Docker integration
**Final authorization:** Not sufficient alone; isolated staging execution remains required
**Application changes:** None

## Environment

- Existing local container: `drivebook-test-db`
- PostgreSQL: 16 Alpine image
- Database: `drivebook_test`
- Host endpoint: `localhost:5433`
- Prisma direct and pooled URLs pointed to the Docker database
- Database was reset locally and all 32 repository migrations were applied
- The P0-01B migration `20260911000000_add_wallet_transaction_payment_intent_unique` was applied
- Synthetic users and PaymentIntent IDs only; no customer funds or suspected credentials used

## Command

```powershell
$env:DATABASE_URL = 'postgresql://postgres:testpass@localhost:5433/drivebook_test'
$env:DIRECT_URL = $env:DATABASE_URL
npx vitest run app/api/client/wallet-add/__tests__/p0-01-ownership.test.ts app/api/client/wallet-add/__tests__/p0-01b-concurrent.test.ts
```

## Result

```text
Test Files  2 passed (2)
Tests       12 passed (12)
Duration    6.56s
Exit code   0
```

### P0-01A ownership scenario

The actual `wallet-add` route test executes this required direction:

- User A owns a succeeded PaymentIntent.
- User B submits User A's PaymentIntent to the route.
- The route returns HTTP `403`.
- The database query finds no `WalletTransaction` for User B and that PaymentIntent.
- User B's balance remains `0`.
- The route logs an ownership violation and does not create a credit.

The same file also passed the legitimate User A path, missing metadata rejection, wallet mismatch rejection, status/amount validation, sequential idempotency, and missing-wallet edge case.

### P0-01B concurrent scenario

The concurrent route tests use `Promise.all()` against the real route and Docker PostgreSQL. They passed:

- two concurrent requests for one PaymentIntent: exactly one `WalletTransaction` row;
- triple concurrent requests: the database unique expression index blocks duplicate credit;
- losing requests are handled as duplicate/conflict behavior rather than producing duplicate rows;
- sequential requests with different PaymentIntents both succeed.

## Local limitation

The route attempts receipt email delivery, but no local SMTP service was running. The test output recorded non-fatal `ECONNREFUSED 127.0.0.1:1025` receipt-email errors; all wallet assertions still passed. Staging evidence should either provide the test SMTP dependency or record the same non-critical behavior explicitly.

## Disposition

This is strong local integration evidence for P0-01A/B, not final closure evidence. The findings remain `OPEN` until the exact tested artifact is deployed to isolated staging and the HTTP, database, migration, and deployment evidence is independently verified.
