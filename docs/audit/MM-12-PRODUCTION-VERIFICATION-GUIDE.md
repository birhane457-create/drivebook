# MM-12: Production Verification Guide

**Status:** PENDING — production deployment required  
**Gate:** This verification must pass before MM-12 moves to CLOSED  
**Checklist location:** `docs/audit/MM-12-E_EXECUTION_LOG.txt` (steps 1–9)  
**Script:** `scripts/run-mm-12-production-verification.ps1`

---

## What must be deployed first

The following commits on branch `audit/int-m03a-test-verified` must be merged
to main and deployed before this verification can run:

| Commit | Description |
|--------|-------------|
| `b7736603` | MM-12-D: schema + migration + route fix + frontend |
| `638888f0` | MM-12-D: fix tx-scoped balance read in add-credit |

Critical file in the deployment:
- `prisma/migrations/20260815000001_mm12d_admin_wallet_idempotency/migration.sql`

This migration creates the `AdminWalletIdempotencyKey` table. It must be applied
to the production database before the routes are exercised.

---

## Pre-deployment checklist

Before merging and deploying:

- [ ] Confirm `638888f0` is the commit being deployed (or a later commit that
      includes all of its changes)
- [ ] Confirm the migration file is included in the deployment
- [ ] Confirm `prisma db push` or `prisma migrate deploy` will run as part of
      the deployment pipeline (Vercel build step: `prisma generate && next build`)
      — Note: `prisma migrate deploy` applies pending migrations; `prisma db push`
      does not track migration history. Use `prisma migrate deploy` for production.
- [ ] Confirm no real customer wallet will be used in the verification run

---

## Test account setup (before running script)

Create these records directly in the production database via Supabase Studio
or psql. Do NOT register through the UI to avoid creating a real user account.

```sql
-- 1. Test user (CLIENT role, no real email needed)
INSERT INTO "User" (id, email, name, role, "emailVerified", "createdAt", "updatedAt")
VALUES (
  'mm12-prod-test-user',
  'mm12-prod-verification@test.internal',
  'MM-12 Prod Verification',
  'CLIENT',
  true,
  NOW(), NOW()
);

-- 2. Wallet
INSERT INTO "ClientWallet" (id, "userId", balance, "createdAt", "updatedAt")
VALUES ('mm12-prod-test-wallet', 'mm12-prod-test-user', 0, NOW(), NOW());

-- 3. Customer record
INSERT INTO "Customer" (id, "userId", name, email, phone, "createdAt", "updatedAt")
VALUES (
  'mm12-prod-test-customer',
  'mm12-prod-test-user',
  'MM-12 Prod Test',
  'mm12-prod-verification@test.internal',
  '000-0000',
  NOW(), NOW()
);
```

Record the customer ID (`mm12-prod-test-customer` above, or whatever cuid was
generated) — this is the `$testCustomerId` parameter for the script.

The script will use `$1` amounts to keep financial impact minimal and traceable.

---

## Running the verification

```powershell
cd "E:\DOC\flowstate-wms\AI voice assistance - Copy - Copy - Copy\drivebook"

.\scripts\run-mm-12-production-verification.ps1 `
  -ProductionUrl   "https://drivebook.com.au" `
  -AdminEmail      "YOUR_TEST_ADMIN@example.com" `
  -AdminPassword   "YOUR_TEST_ADMIN_PASSWORD" `
  -DbConnectionString "postgresql://..." `
  -OutputFile      "docs\audit\MM-12-PRODUCTION-VERIFICATION.txt"
```

The script will:
1. Verify health endpoint reachable
2. Authenticate via real NextAuth credentials flow
3. Run all 6 HTTP checks with real concurrent requests
4. Prompt for manual SQL query results (Steps 8a/8b/8c)
5. Write `docs/audit/MM-12-PRODUCTION-VERIFICATION.txt`

---

## Post-verification cleanup

After the verification passes, remove the test records:

```sql
DELETE FROM "AdminWalletIdempotencyKey" WHERE "walletId" = 'mm12-prod-test-wallet';
DELETE FROM "WalletTransaction" WHERE "walletId" = 'mm12-prod-test-wallet';
DELETE FROM "ClientWallet" WHERE id = 'mm12-prod-test-wallet';
DELETE FROM "Customer" WHERE id = 'mm12-prod-test-customer';
DELETE FROM "User" WHERE id = 'mm12-prod-test-user';
```

---

## Committing the evidence

After the script produces `docs/audit/MM-12-PRODUCTION-VERIFICATION.txt`:

```powershell
git add docs\audit\MM-12-PRODUCTION-VERIFICATION.txt
git commit -m "MM-12: Production verification COMPLETE — all 6 checks pass"
git push origin <branch>
```

Then update `AUDIT-MASTER-TRACKER.md`:
- Change MM-12 Status from `READY FOR PRODUCTION VERIFICATION` to `CLOSED`
- Add the production verification commit SHA to the Fix-Verified field
- Update tracker version to 3.9

---

## What the independent reviewer needs to verify

The output file `MM-12-PRODUCTION-VERIFICATION.txt` should contain:

| Evidence item | Where it appears |
|---|---|
| Deployed commit SHA | "Deployed SHA: ..." |
| Test account/wallet IDs | "Test customer ID: ..." |
| Step 3: same-key concurrent → 1 tx | "Request A: status=200 txId=X" + "Request B: status=200 txId=X" |
| Step 4: replay → same txId | "Replay txId: X" (matches Step 3) |
| Step 5: distinct keys → distinct txIds | Two different txIds, both 200 |
| Step 6: concurrent deductions safe | One 200, one 400 |
| Step 7: failed op → 400 | status=400 |
| Step 8a: no duplicate key tuples | "0 rows" |
| Step 8b: no orphan key for failed deduction | "0 rows" |
| Step 8c: ledger = cache | matching values within 0.01 |
| Timestamp | execution timestamp at top of file |

The reviewer does not need to independently re-run the checks — the output file
and the commit timestamp together constitute the production evidence record.
