# H-01 Implementation Execution Log

**Finding:** H-01 — Package partial-refund formula uses stale `packageHoursRemaining` counter  
**Status at time of execution:** IMPLEMENTATION COMPLETE — awaiting independent review  
**Policy reference:** docs/audit/PACKAGE-ACCOUNTING-POLICY.md §4 (2026-10-18)

---

## Decisions implemented

| Decision | Choice | Rationale |
|---|---|---|
| A — tier recovery | Path A: add `lockedDiscountMinHours Decimal?` to schema | Clean field; legacy rows get `null` → discount unconditionally retained (documented compat rule) |
| B — missing PACKAGE_FEE | Path A: hard error blocking automatic refund | Prevents unverified refund calculation; admin uses `adminOverrideAmount` for manual cases |

---

## Files changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Added `lockedDiscountMinHours Decimal? @db.Decimal(8,2)` to Booking model |
| `lib/config/packages.ts` | Added `getDiscountMinHoursForPct()` helper; `calculatePackagePriceDynamic()` now returns `discountMinHours` |
| `app/api/public/bookings/bulk/route.ts` | Populates `lockedDiscountMinHours` at Book Now purchase time |
| `lib/services/booking-service.ts` | Rewrote `calculatePartialPackageRefund()` as async; fixed all 5 defects; updated 3 callers to `await` |
| `__tests__/integration/h01-partial-package-refund.test.ts` | 13 behavioral tests covering all policy cases |

---

## Defects fixed

| # | Old behaviour | New behaviour |
|---|---|---|
| 1 | Used `packageHoursRemaining` (stale counter) | Uses `SUM(child Booking.price WHERE status IN [CONFIRMED,COMPLETED])` |
| 2 | Applied hardcoded tier thresholds (6/10/15h, 5/10/12%) to USED hours | Uses `lockedDiscountPct` from purchase record; re-qualifies REMAINING hours against `lockedDiscountMinHours` |
| 3 | `packageTotalPaid = null` silently treated as 0, producing negative refund | Throws error with message; requires `adminOverrideAmount` override |
| 4 | Platform fee not separated; could refund more than cash paid | Fetched from authoritative `PACKAGE_FEE` Transaction row; capped at `packageTotalPaid − platformFee` |
| 5 | No floor guard | `Math.max(0, ...)` applied; result never negative |

---

## Test run — 2026-10-23

### H-01 new tests

```
Command: run-h01-tests.bat (verbose)
Database: postgresql://postgres:testpass@localhost:5433/drivebook_test
Node runtime: Kiro.exe (ELECTRON_RUN_AS_NODE=1, Node v24.21.0)
Vitest: v1.6.1
Pre-commit HEAD: 7b17e314
```

| Test | Name | Result |
|---|---|---|
| H01-T01 | 0 lessons used → refund = maxStripeRefund ($630) | ✅ PASS |
| H01-T02 | all lessons used → refund = 0 | ✅ PASS |
| H01-T03 | 5 of 10hrs used, null lockedDiscountMinHours → discount retained | ✅ PASS |
| H01-T04 | 5 of 10hrs used, lockedDiscountMinHours=10 → discount VOIDED | ✅ PASS |
| H01-T05 | 0hrs consumed, remaining ≥ threshold → discount retained | ✅ PASS |
| H01-T06 | legacy row (null) with 7hrs consumed → discount retained | ✅ PASS |
| H01-T07 | refund capped at maxStripeRefund | ✅ PASS |
| H01-T08 | error thrown when packageTotalPaid is null | ✅ PASS |
| H01-T09 | error thrown when PACKAGE_FEE Transaction not found | ✅ PASS |
| H01-T10 | Book Later — PACKAGE_FEE found via stripePaymentIntentId | ✅ PASS |
| H01-T11 | floor guard — never negative | ✅ PASS |
| H01-T12 | rounding — no floating-point accumulation | ✅ PASS |
| H01-STALE | stale packageHoursRemaining counter NOT used | ✅ PASS |

**Total: 13/13 PASS**

### H-02 regression (24 tests)

```
Command: run-h02-regression.bat (verbose)
```

| Suite | Tests | Result |
|---|---|---|
| h02-child-booking-pricing | 10/10 | ✅ All pass |
| h02-webhook-package-accounting | 14/14 | ✅ All pass |

**Total: 24/24 PASS — no regressions**

---

## Schema migration

```
prisma db push (drivebook_test) — exit 0
"Your database is now in sync with your Prisma schema. Done in 297ms"
New column: Booking.lockedDiscountMinHours DECIMAL(8,2) NULL
```

---

## Gate status

H-01 remains **OPEN**. This log records implementation and first-party test execution only.  
Independent reviewer must verify: exact diff, migration, all call sites, and this execution log  
before status may change to FIX-VERIFIED.

---

## Reviewer corrections — 2026-10-23 (H01-RV-01, H01-RV-02)

### H01-RV-01 — Formula analysis

Independent reviewer raised that `drivebookPromotion = faceValue - packageTotalPaid` may be wrong
because `packageTotalPaid = discountedBase + platformFee` (real purchase contract).

**Analysis:** The formula IS correct. `drivebookPromotion` represents the **non-cash-backed gap**
between wallet credit and cash paid — i.e., what DriveBook actually subsidised above the student's
payment. When `packageTotalPaid = discountedBase + platformFee`, this gap equals:

```
faceValue - (discountedBase + platformFee)
= faceValue × discountPct/100 - discountedBase × platformFeePct/100
```

The reviewer's example ($35 discount, $33.25 fee → gap=$1.75) is arithmetically correct;
the promotional credit is $1.75, not $35. Only $1.75 of the wallet credit is non-cash-backed.

**Action taken:** Formula kept unchanged. Test fixtures updated from simplified values
(platformFee=$35) to realistic values (platformFee=discountedBase×3.6%). Added `H01-RV-REALISTIC`
test that explicitly asserts the formula is correct for the reviewer's $698.25 scenario,
and that voidedPromo = $1.75, NOT the full discount $35.

### H01-RV-02 — Tier threshold sealing

Independent reviewer correctly identified that `getDiscountMinHoursForPct()` (reverse-lookup by
discount percentage) is ambiguous when multiple tiers share the same percentage.

**Action taken:** Added `resolveDiscountTierMinHours(purchasedHours)` — finds the highest tier
threshold ≤ purchasedHours, unambiguous regardless of tier configuration. `calculatePackagePriceDynamic`
now uses this function. `getDiscountMinHoursForPct` retained but marked `@deprecated`. Added
`H01-RV-02` test asserting the sealing is correct.

### Test run after reviewer corrections — 2026-10-23

```
Command: run-h01-tests.bat (verbose)
Database: postgresql://postgres:testpass@localhost:5433/drivebook_test
Node: Kiro.exe (ELECTRON_RUN_AS_NODE=1, Node v24.21.0)
Vitest: v1.6.1
Pre-commit HEAD: 6179c380
```

| Test | Name | Result |
|---|---|---|
| H01-T01 | 0 lessons → maxStripeRefund ($630) | ✅ PASS |
| H01-T02 | all lessons used → 0 | ✅ PASS |
| H01-T03 | 5hrs used, null min → discount retained | ✅ PASS |
| H01-T04 | 5hrs used, min=10 → discount VOIDED | ✅ PASS |
| H01-T05 | 0hrs consumed, min set, ≥ threshold | ✅ PASS |
| H01-T06 | legacy row, 7hrs consumed → discount retained | ✅ PASS |
| H01-T07 | refund capped at maxStripeRefund | ✅ PASS |
| H01-T08 | error on null packageTotalPaid | ✅ PASS |
| H01-T09 | error on missing PACKAGE_FEE Transaction | ✅ PASS |
| H01-T10 | Book Later PACKAGE_FEE via PI lookup | ✅ PASS |
| H01-T11 | floor guard — never negative | ✅ PASS |
| H01-T12 | rounding — no float accumulation | ✅ PASS |
| H01-STALE | stale counter NOT used | ✅ PASS |
| H01-RV-REALISTIC | reviewer scenario ($698.25 total) — $1.75 promo void | ✅ PASS |
| H01-RV-02 | tier threshold sealing unambiguous | ✅ PASS |

**Total: 15/15 PASS**

H-02 regression: 24/24 PASS (no regressions).

---

## Purchase-path audit — 2026-10-23 (response to reviewer RV-02 follow-up)

### Reviewer concern
`resolveDiscountTierMinHours()` calls `getPackageTiers()` which reads live DB configuration.
If admins change tier thresholds after purchase, historical refunds might be evaluated against
new terms.

### Finding: architecture is correct — sealed at purchase, never re-read

`resolveDiscountTierMinHours()` is called in exactly **one** source location:
`calculatePackagePriceDynamic()` in `lib/config/packages.ts`. The returned value
(`discountMinHours`) is written immediately to `Booking.lockedDiscountMinHours` at purchase time.

The refund function `calculatePartialPackageRefund()` reads **only** from `booking.lockedDiscountMinHours`
(the stored DB field). It contains no call to `resolveDiscountTierMinHours`, `getPackageTiers`,
or any live settings lookup. Admin tier changes after purchase have zero effect on historical refunds.

### Package creation path audit

Every `booking.create` call in the codebase was searched for `isPackageBooking`, `packageHours`,
`packageTotalPaid`. Only one route sets these fields:

| Route | Creates package booking? | Writes `lockedDiscountMinHours`? |
|---|---|---|
| `app/api/public/bookings/bulk/route.ts` | ✅ Yes — only route that does | ✅ Yes (line ~807) |
| `app/api/bookings/route.ts` | ❌ Single lessons only | N/A |
| `app/api/bookings/batch/route.ts` | ❌ No package fields | N/A |
| `app/api/bookings/combined/route.ts` | ❌ No package fields | N/A |
| `app/api/bookings/offline/route.ts` | ❌ No package fields | N/A |
| `app/api/bookings/mobile/route.ts` | ❌ No package fields | N/A |
| `app/api/client/bookings/create-bulk/route.ts` | ❌ Wallet-funded lessons, no package fields | N/A |
| `app/api/admin/bookings/route.ts` | ❌ No package fields | N/A |
| `app/api/public/bookings/route.ts` | ❌ No package fields | N/A |

### New tests added

| Test | What it proves |
|---|---|
| H01-SEAL-IMMUTABLE | Mutating stored `lockedDiscountMinHours` changes refund; live tier config has no effect |
| H01-SEAL-ZERO | `lockedDiscountMinHours=0` (no qualifying tier) → discount always retained |

### Test run — 2026-10-23 (third run)

```
Pre-commit HEAD: 27333c5b
```

**H-01: 17/17 PASS. H-02 regression: 24/24 PASS.**
