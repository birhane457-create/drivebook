# H-02 Closure Execution Log

**Tested commit:** `612acd1d82c4b368676844229e3a71d8e1c036f5`  
**Remote confirmed:** `https://github.com/birhane457-create/drivebook` — `main` identical to this commit  
**Test database:** PostgreSQL 16.4, `localhost:5433`, database `drivebook_test`  
**Node runtime:** Kiro.exe (`ELECTRON_RUN_AS_NODE=1`), Node v24.21.0  
**Schema state:** `prisma db push` confirmed "database already in sync" immediately before the runs  
**Raw output files:**  
- `docs/audit/H02-execution-child-612acd1d.txt` — full Vitest stdout/stderr for child-booking suite  
- `docs/audit/H02-execution-webhook-612acd1d.txt` — full Vitest stdout/stderr for webhook suite  

---

## Suite 1 — Child-booking pricing

**File:** `__tests__/integration/h02-child-booking-pricing.test.ts`  
**Command:**
```
Kiro.exe vitest.mjs run --config vitest.config.ts \
  __tests__/integration/h02-child-booking-pricing.test.ts --reporter=verbose
```
**Start at:** 2026-10-22T09:08:15Z  
**Duration:** 2.83s  
**Exit code:** 0

| # | Test | Result |
|---|---|---|
| T01 | Confirmation sets price = duration × current instructor rate | ✅ PASSED |
| T02 | Platform fee = 0 for wallet-funded lesson | ✅ PASSED |
| T03 | Provider payout = price × (1 − commission rate) | ✅ PASSED |
| T04 | Transaction record matches booking financials | ✅ PASSED |
| T05 | Wallet debited by lesson price | ✅ PASSED |
| T06 | Rate change — new booking uses instructor current rate | ✅ PASSED |
| T07 | Insufficient balance blocks booking after rate increase | ✅ PASSED |
| T08 | Multi-hour booking price = duration × current rate | ✅ PASSED |
| T09 | Different instructor rate applies to their booking | ✅ PASSED |
| T10 | Financial fields reconcile within rounding tolerance | ✅ PASSED |

**Result: 10/10 PASSED — Test Files 1 passed (1)**

---

## Suite 2 — Webhook package accounting

**File:** `__tests__/integration/h02-webhook-package-accounting.test.ts`  
**Command:**
```
Kiro.exe vitest.mjs run --config vitest.config.ts \
  __tests__/integration/h02-webhook-package-accounting.test.ts --reporter=verbose
```
**Start at:** 2026-10-22T09:38:31Z  
**Duration:** 3.38s  
**Exit code:** 0

| # | Test | Result |
|---|---|---|
| W01 | Book Now — wallet CREDIT = face value $700 (not $698.25) | ✅ PASSED |
| W02 | Book Now — PLATFORM_SUBSIDY present and NOT type CREDIT | ✅ PASSED |
| W03 | Book Now — PACKAGE_FEE Transaction, correct amount, Stripe PI link | ✅ PASSED |
| W04 | Book Now — first-lesson DEBIT entry = $70 | ✅ PASSED |
| W05 | Book Now — getWalletBalance() = $630 (face value minus first lesson) | ✅ PASSED |
| W06 | Book Now — duplicate delivery idempotent (no double credit) | ✅ PASSED |
| W07 | Book Later — wallet CREDIT = face value $700 | ✅ PASSED |
| W08 | Book Later — PLATFORM_SUBSIDY present and NOT type CREDIT | ✅ PASSED |
| W09 | Book Later — PACKAGE_FEE Transaction, correct amount | ✅ PASSED |
| W10 | Book Later — no first-lesson DEBIT (no lesson yet) | ✅ PASSED |
| W11 | Book Later — getWalletBalance() = $700 (PLATFORM_SUBSIDY excluded) | ✅ PASSED |
| W11b | Book Later — duplicate delivery idempotent | ✅ PASSED |
| W12 | Missing sealed metadata falls back to amountPaid credit | ✅ PASSED |

**Result: 13/13 PASSED — Test Files 1 passed (1)**

---

## Combined result

| Suite | Tests | Passed | Exit |
|---|---|---|---|
| Child-booking pricing | 10 | **10** | 0 |
| Webhook package accounting | 13 | **13** | 0 |
| **Total** | **23** | **23** | **0** |

---

## Notes on W06/W11b fix

W06 failed in the previous run (12/13) because the duplicate event used a freshly computed `Math.floor(Date.now()/1000)` value. Since `idempotencyKey = {type}_{eventId}_{created}`, a 1-second boundary crossing produced a different key, causing the route to treat it as a new event. Fix in `612acd1d`: `bookNowCreated` / `bookLaterCreated` stored once in `beforeAll` and reused in both duplicate events. No business logic changed.

---

## Policy assertions verified at runtime

| Policy rule | Assertion in tests | Verified |
|---|---|---|
| Face-value wallet credit ($700, not $698.25) | W01, W07 | ✅ |
| PLATFORM_SUBSIDY ($1.75) non-spendable, not type CREDIT | W02, W08 | ✅ |
| PLATFORM_SUBSIDY excluded from getWalletBalance() | W05 ($630), W11 ($700) | ✅ |
| PACKAGE_FEE ($33.25) linked to Stripe PI | W03, W09 | ✅ |
| platformFee=0 on Book Now first lesson (no double fee) | T02 | ✅ |
| Lesson price = duration × instructor current rate | T01, T06, T08, T09 | ✅ |
| Rate change only affects future bookings | T06 | ✅ |
| Insufficient balance → 402 + code field | T07 | ✅ |
| No first-lesson debit on Book Later | W10 | ✅ |
| Duplicate webhook delivery → deduplicated, no double credit | W06, W11b | ✅ |
| Fallback to amountPaid when sealed metadata absent | W12 | ✅ |

**Approved policy:** `docs/audit/PACKAGE-ACCOUNTING-POLICY.md` v1.0 (2026-10-18)
