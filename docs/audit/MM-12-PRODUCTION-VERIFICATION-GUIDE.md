# MM-12: Production Verification Guide (v2)

**Status:** PENDING — production deployment required
**Gate:** This verification must pass before MM-12 moves to CLOSED
**Script:** `scripts/run-mm-12-production-verification.ps1`
**Evidence output:** `docs/audit/MM-12-PRODUCTION-VERIFICATION.txt`

---

## Corrections from v1 (per independent review)

| Finding | v1 defect | v2 correction |
|---------|-----------|---------------|
| #1 SHA verification | `Read-Host` — operator types claimed SHA | `/api/health` returns `VERCEL_GIT_COMMIT_SHA` from running application |
| #2 Cookie name | Only checked `next-auth.session-token` | Checks for both `__Secure-next-auth.session-token` (production) and `next-auth.session-token` (dev), matching actual `auth.ts` config |
| #3 Fixture documentation | Header claimed script creates fixtures automatically | Script clearly states fixtures are manually provisioned; parameters required |
| #4 DB constraint | Only queried for absence of duplicates | Query 8a checks `pg_indexes` catalog to confirm the unique index actually exists |
| #5 Step 7 / 8b separation | Combined into one pass/fail | Step 7 records HTTP response `[APP]`; Step 8b records DB evidence `[DB]`; evidence file labels each clearly |
| #6 Self-authentication | Guide said "reviewer does not need to re-run" | Guide now explicitly requires independent corroboration of SHA, DB results, and fixture identity |

---

## How the SHA is established

The `/api/health` endpoint now returns:

```json
{
  "status": "ok",
  "sha":    "638888f0329a24e8...",   // VERCEL_GIT_COMMIT_SHA from runtime env
  "env":    "production",
  "timestamp": "2026-09-22T..."
}
```

The script reads this value directly from the running application rather than
accepting operator input. The independent reviewer must still confirm that the
returned SHA corresponds to a commit containing `638888f0` in its ancestry via
the Vercel dashboard — the script records a `[SHA]` evidence line for this.

---

## Pre-deployment checklist

Before running verification:

- [ ] Commits `b7736603` and `638888f0` (or a later commit containing both) are
      merged to the deployed branch
- [ ] Migration `20260815000001_mm12d_admin_wallet_idempotency` has been applied
      to the production database — verify with:
      ```sql
      SELECT tablename FROM pg_tables WHERE tablename = 'AdminWalletIdempotencyKey';
      ```
      Expected: 1 row
- [ ] `VERCEL_GIT_COMMIT_SHA` is exposed as a runtime environment variable
      (Vercel sets this automatically for all deployments)
- [ ] Dedicated test fixtures have been provisioned (see below)
- [ ] No real customer wallet IDs will be used

---

## Test fixture setup (manual — run before script)

Connect to production DB via Supabase Studio or psql and run:

```sql
-- Create test user
INSERT INTO "User" (id, email, name, role, "emailVerified", "createdAt", "updatedAt")
VALUES (
  'mm12-prod-verify-user',
  'mm12-prod-verify@test.internal',
  'MM-12 Prod Verification',
  'CLIENT',
  true,
  NOW(), NOW()
);

-- Create wallet (balance starts at 0)
INSERT INTO "ClientWallet" (id, "userId", balance, "createdAt", "updatedAt")
VALUES ('mm12-prod-verify-wallet', 'mm12-prod-verify-user', 0, NOW(), NOW());

-- Create customer record
INSERT INTO "Customer" (id, "userId", name, email, phone, "createdAt", "updatedAt")
VALUES (
  'mm12-prod-verify-customer',
  'mm12-prod-verify-user',
  'MM-12 Prod Test',
  'mm12-prod-verify@test.internal',
  '000-0000',
  NOW(), NOW()
);
```

Pass these IDs to the script:
- `-TestCustomerId mm12-prod-verify-customer`
- `-TestWalletId   mm12-prod-verify-wallet`

---

## Running the script

```powershell
cd "E:\DOC\flowstate-wms\AI voice assistance - Copy - Copy - Copy\drivebook"

.\scripts\run-mm-12-production-verification.ps1 `
  -ProductionUrl        "https://drivebook.com.au" `
  -AdminEmail           "YOUR_TEST_ADMIN@example.com" `
  -AdminPassword        "YOUR_TEST_ADMIN_PASSWORD" `
  -TestCustomerId       "mm12-prod-verify-customer" `
  -TestWalletId         "mm12-prod-verify-wallet" `
  -ExpectedShaPrefix    "638888f0" `
  -OutputFile           "docs\audit\MM-12-PRODUCTION-VERIFICATION.txt"
```

`-ExpectedShaPrefix` causes the script to abort if the deployed SHA does not
begin with those characters. Set to `"638888f0"` for the verified fix commit,
or to the first 8 characters of whatever commit was deployed.

---

## Evidence types in the output file

The script labels each result line:

| Tag | Meaning |
|-----|---------|
| `[SHA]` | Deployment evidence — SHA read from running application via `/api/health` |
| `[APP]` | Application HTTP evidence — observed by the script from live server responses |
| `[DB]`  | Database evidence — operator-recorded SQL results; requires independent verification |

These are distinct evidence types. The `[DB]` entries are entered by the operator
after running queries against the production database directly. They are not
independently verified by the script.

---

## What the independent reviewer must verify

The reviewer **cannot** treat the evidence file as self-authenticating. Required
independent verifications:

1. **Deployed SHA** — Open the Vercel deployment dashboard and confirm the SHA
   returned by `/api/health` matches the SHA of the deployed commit, and that
   this commit's ancestry includes `638888f0`.

2. **DB results (8a–8d)** — Connect to the production database independently
   and re-run the four SQL queries. Confirm they match the operator-reported
   values in the evidence file.

3. **Transaction IDs** — Confirm Step 3 and Step 4 txId values are identical
   and that the transaction exists in `WalletTransaction` exactly once.

4. **Fixture identity** — Confirm the test customer/wallet IDs used are not
   real customer accounts. The prefixed IDs `mm12-prod-verify-*` are designed
   to be identifiable.

5. **Cleanup** — Confirm the test fixtures were deleted after the reviewer's
   inspection.

---

## Committing the evidence

After the script produces the output file and the reviewer has completed their
independent checks:

```powershell
git add docs\audit\MM-12-PRODUCTION-VERIFICATION.txt
git commit -m "MM-12: Production verification COMPLETE — all checks pass"
git push origin <branch>
```

Then update `AUDIT-MASTER-TRACKER.md`:
- Change MM-12 Status to `CLOSED`
- Add production verification commit SHA
- Update tracker version to 3.9

---

## Post-verification cleanup SQL

Run after the independent reviewer has completed their inspection:

```sql
DELETE FROM "AdminWalletIdempotencyKey" WHERE "walletId" = 'mm12-prod-verify-wallet';
DELETE FROM "WalletTransaction"         WHERE "walletId" = 'mm12-prod-verify-wallet';
DELETE FROM "ClientWallet"              WHERE id         = 'mm12-prod-verify-wallet';
DELETE FROM "Customer"                  WHERE id         = 'mm12-prod-verify-customer';
DELETE FROM "User"                      WHERE id         = 'mm12-prod-verify-user';
```
