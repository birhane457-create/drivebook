# Pricing Configuration & Management Guide

**Date:** September 1, 2026 (Updated: Package Tiers Migration)  
**Purpose:** Complete reference for where pricing, discounts, fees, and subscription rates are determined, stored, and adjusted

---

## 1. WHERE PRICING IS STORED

### Database Model: `PlatformSettings`

**Location:** `prisma/schema.prisma` (lines 488-530)

**Key Fields:**
```
┌─────────────────────────────────────────────────────────┐
│         PlatformSettings (Single Record)                 │
├─────────────────────────────────────────────────────────┤
│  Pricing:                                                │
│  • platformFeePercentage: 3.6% (charge to clients)      │
│  • gstEnabled: true/false                               │
│  • gstRate: 10% (Australian GST)                        │
│                                                          │
│  Discounts (Package Bulk Rates):                        │
│  • package6Discount: 5% (6-hour package)               │
│  • package10Discount: 10% (10-hour package)            │
│  • package15Discount: 12% (15-hour package)            │
│  • discountPaidBy: 'platform'|'shared'|'instructor'   │
│                                                          │
│  Commission Rates (By Subscription Tier):               │
│  • basicCommissionRate: 15% (BASIC tier)               │
│  • proCommissionRate: 12% (PRO tier)                   │
│  • businessCommissionRate: 10% (BUSINESS tier)         │
│                                                          │
│  Bonuses (First Booking):                              │
│  • basicNewStudentBonus: 8%                            │
│  • proNewStudentBonus: 10%                             │
│  • businessNewStudentBonus: 12%                        │
│                                                          │
│  Services:                                              │
│  • drivingTestPackagePrice: $225                       │
│  • cancellationFee: $0                                  │
│  • lateCancellationWindowHours: 24                      │
│  • noShowPenaltyAmount: $0                              │
│                                                          │
│  Wallet:                                                │
│  • walletTopUpMin: $10                                  │
│  • walletTopUpMax: $500                                 │
│                                                          │
│  Taxes (Australia):                                     │
│  • withholdingTaxRate: 47%                              │
│                                                          │
│  Peak Pricing (Future):                                 │
│  • peakSurchargeEnabled: false                          │
│  • peakSurchargePercent: 0%                             │
└─────────────────────────────────────────────────────────┘
```

---

## 2. WHERE PRICING IS READ/CACHED

### Configuration Layer: `lib/config/packages.ts`

**Purpose:** Reads from database and provides pricing functions to application

**Key Functions:**

#### `getPricingSettings()`
```typescript
// Reads from PlatformSettings table
// Caches for 5 minutes to reduce database queries
// Falls back to DEFAULT_SETTINGS if database unavailable
```

**Usage Example:**
```typescript
const settings = await getPricingSettings();
console.log(settings.platformFeePercentage);  // 3.6
console.log(settings.package10Discount);      // 10
```

#### `getHourPackages()`
```typescript
// Returns package definitions with current discounts from database
const packages = await getHourPackages();
// {
//   PACKAGE_6: { hours: 6, discount: 5, name: "6 Hour Package" },
//   PACKAGE_10: { hours: 10, discount: 10, name: "10 Hour Package" },
//   PACKAGE_15: { hours: 15, discount: 12, name: "15 Hour Package" },
//   CUSTOM: { hours: 0, discount: 0, name: "Custom Hours" }
// }
```

#### `calculatePackagePriceDynamic(hourlyRate, hours, packageType, includeTestPackage)`
```typescript
// Main pricing calculation function
// Returns: { subtotal, discount, discountPercentage, testPackage, platformFee, total, installments }

const pricing = await calculatePackagePriceDynamic(
  75,           // instructor hourly rate
  10,           // requested hours
  'PACKAGE_10', // package type
  true          // include test package?
);
// Result:
// {
//   subtotal: 750,
//   discount: 75,
//   discountPercentage: 10,
//   testPackage: 225,
//   platformFee: 35.1,
//   total: 1035.1,
//   installments: 258.775
// }
```

#### `getDiscountForCustomHours(hours)`
```typescript
// For custom packages: determines discount based on hour thresholds
// >= 15 hours: 12% discount
// >= 10 hours: 10% discount
// >= 6 hours: 5% discount
// < 6 hours: 0% discount
```

#### `calculateBulkCommission(instructorId, totalAmount, isFirstBooking, tier)`
```typescript
// Calculates platform revenue & instructor payout
// Returns: { platformFee, commissionRate, platformCommission, newStudentBonus, totalPlatformRevenue, instructorPayout }
```

---

## 3. WHERE PRICING IS ADJUSTED (Admin Interface)

### Admin UI: `components/admin/PricingSettingsForm.tsx`

**Location:** `/admin/pricing`

**Form Sections:**

#### Platform Fee Section
- **Field:** Processing fee charged to clients (%)
- **Current:** 3.6%
- **Range:** 0-10%
- **What It Does:** Added on top of every booking amount at checkout
- **Who Gets It:** Platform (payment processing costs)

#### Package Discounts Section
- **Master Toggle:** Enable/disable all bulk discounts
- **Fields:**
  - 6-lesson package discount (0-30%)
  - 10-lesson package discount (0-30%)
  - 15-lesson package discount (0-30%)
- **Who Pays:** Dropdown selector:
  - `platform`: Platform absorbs discount cost (lowers commission to instructors)
  - `shared`: Client saves, instructor gets slightly less
  - `instructor`: Full discount from instructor's payout

#### Commission Rates Section
- **Fields by Tier:**
  - BASIC tier commission rate
  - PRO tier commission rate
  - PREMIUM tier commission rate (DB field: businessCommissionRate)
- **Range:** 0-50%
- **What It Does:** Platform's cut of every booking

#### New Student Bonuses Section
- **Fields by Tier:**
  - BASIC tier first booking bonus
  - PRO tier first booking bonus
  - PREMIUM tier first booking bonus (field removed May 2026 — see newStudentBonus deprecation)
- **What It Does:** Extra commission for instructors on their first student booking

#### Other Services
- **Driving Test Package Price:** Default $225
- **Cancellation Fee:** Amount charged for cancellations
- **Late Cancellation Window:** Hours before booking to charge fee
- **No Show Penalty:** Amount for no-shows

#### Wallet Settings
- **Min Top-Up:** Minimum wallet credit purchase ($10)
- **Max Top-Up:** Maximum single purchase ($500)

#### Tax Settings
- **GST Enabled:** Enable Australian GST
- **GST Rate:** 10%
- **Withholding Tax Rate:** 47% (Australian tax on contractor earnings)

#### Peak Pricing (Future)
- **Enable Peak Surcharge:** Toggle for peak hours
- **Peak Surcharge %:** Extra fee during peak times

### Form Submission

**Endpoint:** `POST /api/admin/pricing`

**What Happens:**
1. Admin submits form via PricingSettingsForm
2. Client sends to `/api/admin/pricing` endpoint
3. Backend updates `PlatformSettings` record in database
4. Cache invalidated (5-minute TTL)
5. New prices used on next pricing calculation
6. Success toast notification shown

---

## 4. PRICING CALCULATION FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│                   BOOKING CREATION (Client Side)                 │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                        ┌───────────────┐
                        │ Select Package│
                        │  (6/10/15/hr) │
                        └───────────────┘
                                ↓
            ┌───────────────────────────────────────┐
            │ Client selects hours & options        │
            │ Frontend calculates preview price     │
            │ Uses: calculatePackagePrice() static  │
            │ (hardcoded defaults if offline)       │
            └───────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND PRICING VERIFICATION                        │
│              (app/api/public/bookings/bulk/route.ts)            │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                    ┌─────────────────────┐
                    │ calculatePackage    │
                    │ PriceDynamic()      │
                    │ • Reads DB settings │
                    │ • Recalculates      │
                    │ • Authoritative     │
                    └─────────────────────┘
                                ↓
                    ┌─────────────────────┐
                    │ Validate Match      │
                    │ (client vs server)  │
                    │ Total within 1 cent?│
                    └─────────────────────┘
                                ↓
                    ┌─────────────────────┐
                    │ Create Stripe PI    │
                    │ Use SERVER total    │
                    │ Lock prices to DB   │
                    └─────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                PAYMENT WEBHOOK (Stripe)                          │
│              (app/api/stripe/webhook/route.ts)                  │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                    ┌─────────────────────┐
                    │ Calculate Payout    │
                    │ calculateBulk       │
                    │ Commission()        │
                    │ • Reads settings    │
                    │ • Calculates split  │
                    │ • Locks rates       │
                    └─────────────────────┘
                                ↓
                    ┌─────────────────────┐
                    │ Store in DB:        │
                    │ • lockedHourlyRate  │
                    │ • lockedDiscountPct │
                    │ • packageTotalPaid  │
                    └─────────────────────┘
```

---

## 5. PRICING CALCULATION FORMULA

### For Clients (What They Pay)

```
Subtotal = Hourly Rate × Hours

Discount = Subtotal × Discount%
           (0% for custom <6h, 5% for 6h, 10% for 10h, 12% for 15h)

After Discount = Subtotal - Discount + (Test Package Price if included)

Platform Fee = After Discount × Platform Fee%
               (3.6% standard)

Total = After Discount + Platform Fee

Installments = Total ÷ 4  (for payment plans)
```

**Example:** 10-hour package at $75/hr
```
Subtotal:          $750
Discount (10%):    -$75
After Discount:    $675
Platform Fee (3.6%): +$24.30
Total:             $699.30
Per Installment:   $174.83 (÷4)
```

### For Platform (What We Get)

```
Platform Fee = Total × Platform Fee%
               (3.6% from client payment)

Commission = (Booking Amount) × Commission Rate by Tier
             (15% BASIC, 12% PRO, 11% STUDIO, 10% PREMIUM)

New Student Bonus = (Booking Amount) × Bonus Rate by Tier
                    (removed May 2026 — newStudentBonus deprecated)
                    (Only if first booking from this instructor)

Total Platform Revenue = Platform Fee + Commission + New Student Bonus
```

**Example:** $700 payment from new BASIC tier instructor
```
Platform Fee:      $700 × 3.6% = $25.20
Commission:        $700 × 15% = $105
New Student Bonus: $700 × 8% = $56
Total Platform:    $186.20
```

### For Instructors (What They Get)

```
Instructor Payout = Booking Amount - Commission - New Student Bonus

Example with above:
$700 - $105 - $56 = $539
```

---

## 6. DISCOUNT DISTRIBUTION MODELS

**Who Pays for the Discount?**

Admin can choose: `discountPaidBy` setting

### Model 1: Platform Absorbs (`platform`)
```
Platform adjusts commission downward to cover discount
Example: Instead of 15%, platform takes 10% commission
Client gets: Full discount
Instructor gets: Full amount minus lower commission
Platform gets: Less revenue
```

### Model 2: Shared (`shared`)
```
Client savings ÷ by 2, split between platform & instructor
Example: 10% discount = $5 saved
Client saves: $5
Instructor loses: $5
Platform loses: $0 (pass through)
```

### Model 3: Instructor Absorbs (`instructor`)
```
Full discount amount deducted from instructor payout
Client gets: Full discount
Instructor pays: Entire discount amount
Platform gets: Same commission as usual
```

**Current Setting:** `shared` (default)

---

## 7. WHERE PRICING IS USED IN CODE

### Booking Creation
- `app/api/public/bookings/bulk/route.ts` - Calculates & validates pricing

### Payment
- `app/api/payments/create-intent/route.ts` - Creates Stripe PaymentIntent with final total
- `app/api/stripe/webhook/route.ts` - Confirms payment & splits revenue

### Frontend Display
- `lib/contexts/BookingContext.tsx` - Displays pricing in booking summary
- `components/BookingSummary.tsx` - Shows breakdown to user
- `components/BookingDetailsForm.tsx` - Time slot pricing display
- `components/PackageSelector.tsx` - Package price options

### Admin Dashboard
- `components/admin/PricingSettingsForm.tsx` - Settings form with live preview
- `components/admin/BookingPaymentStatus.tsx` - Shows platform fees collected

### Reports & Analytics
- `app/api/admin/revenue/route.ts` - Revenue calculations
- `app/admin/revenue/page.tsx` - Revenue dashboard
- `docs/DOCROLEBASE/05-admin/REVENUE.md` - Revenue documentation

---

## 8. PRICING CONFIGURATION CHECKLIST

**When adjusting pricing, verify:**

- [ ] Platform fee% is between 0-10%
- [ ] Package discounts are between 0-30%
- [ ] Commission rates reflect tier differences (higher tier = lower %)
- [ ] New student bonuses exist for all tiers
- [ ] Discount paid-by model matches business strategy
- [ ] GST rate is correct for jurisdiction (10% for Australia)
- [ ] Wallet top-up limits are sensible (min $10, max $500)
- [ ] Test package price reflects service value ($225 default)
- [ ] Pricing has been tested end-to-end (booking → payment → payout)

---

## 9. HOW TO CHANGE PRICING

### Step 1: Access Admin Panel
```
Go to: /admin/pricing
Requires: Admin role
```

### Step 2: Update Setting
```
Example: Increase 10-hour package discount from 10% to 15%
1. Find "10-lesson package (%)" field
2. Change value from 10 to 15
3. Watch live preview calculate new prices
```

### Step 3: Save
```
1. Click "Save Pricing Settings" button
2. Wait for success toast
3. New prices active immediately for new bookings
4. Existing bookings use locked prices (no retroactive changes)
```

### Step 4: Verify
```
1. Create test booking
2. Verify pricing breakdown shows new rates
3. Check admin dashboard for accuracy
```

---

## 10. CACHING & PERFORMANCE

**Pricing Settings Cache:**
- Duration: 5 minutes
- Invalidation: Automatic after 5 min or on settings update
- Fallback: DEFAULT_SETTINGS if database unavailable
- Impact: Reduces database queries for pricing calculations

**When Changes Take Effect:**
- Immediately for new bookings (after cache expiry)
- Existing bookings use locked prices (unchangeable)
- Cache can be manually invalidated by restarting application

---

## 11. TROUBLESHOOTING

### Pricing Not Updating
**Symptom:** Changed admin settings but bookings still use old prices  
**Cause:** Cache not yet expired (5-minute TTL)  
**Fix:** Wait 5 minutes or restart application

### Test Package Not Appearing
**Symptom:** Test package price shows but isn't selectable  
**Cause:** Instructor's `offersTestPackage` flag is false  
**Fix:** Enable in instructor settings

### Discount Not Applied
**Symptom:** User selected package but no discount shown  
**Cause:** Could be multiple issues:
1. Package discount set to 0% in settings
2. Custom hours < 6 hours (no discount for small custom)
3. Discount model set to 'instructor' but display doesn't reflect it
**Fix:** Check PlatformSettings and package discount values

### Commission Calculation Wrong
**Symptom:** Instructor payout doesn't match calculation  
**Cause:** Using old commission rates (locked at booking time)  
**Fix:** Check `booking.lockedDiscountPct` - rates don't change retroactively

---


---

## 11. DECIMAL PRECISION & ROUNDING

### Background

**Problem:** JavaScript's native `Number` type uses binary floating-point (IEEE 754), which cannot represent decimal fractions like 0.1 exactly. This causes rounding errors in financial calculations:

```javascript
0.1 + 0.2 === 0.3  // false — actually 0.30000000000000004
75.00 * 0.1        // 7.500000000000001
```

**Impact:** Payment amounts, commission splits, and wallet balances can drift by 1-2 cents due to accumulation of floating-point errors.

**Solution:** Use `decimal.js` library for all financial calculations.

### Configuration

**Location:** `lib/utils/decimal.ts`

```typescript
import Decimal from 'decimal.js';

// Global configuration — applied once at module load
Decimal.set({
  precision: 20,              // 20 significant digits
  rounding: Decimal.ROUND_HALF_UP,  // Standard financial rounding (0.5 rounds up)
});
```

**What this does:**
- `precision: 20` — enough digits for $999,999,999,999.99 with full cent precision
- `ROUND_HALF_UP` — matches accounting standards (0.5 → 1, not 0)
- Applied globally — all `new Decimal()` instances use these settings

### When to Use Decimal vs Number

| Use `Decimal` | Use `Number` |
|---------------|--------------|
| Money amounts (prices, fees, payouts) | Quantities (hours, counts) |
| Percentages in calculations (3.6% fee) | Display percentages (already calculated) |
| Commission splits | Iteration counters, array indices |
| Wallet balances | Timestamps |
| Refund calculations | Boolean checks (0 vs non-zero) |

### Helper Functions

All financial operations go through `lib/utils/decimal.ts` helpers:

```typescript
toDecimal(value: number | string | Decimal): Decimal
  // Converts to Decimal safely

addAmounts(a: Decimal, b: Decimal): Decimal
  // a + b

subtractAmounts(a: Decimal, b: Decimal): Decimal
  // a - b

multiplyAmount(a: Decimal, multiplier: number | Decimal): Decimal
  // a × multiplier

divideAmount(a: Decimal, divisor: number | Decimal): Decimal
  // a ÷ divisor

roundAmount(value: Decimal, decimalPlaces: number = 2): Decimal
  // Rounds to N decimal places using ROUND_HALF_UP

toNumber(value: Decimal): number
  // Converts back to JS number for storage/display
```

### Example: Commission Calculation

**❌ Wrong (floating-point drift):**
```typescript
const amount = 75.00;
const rate = 0.12;
const commission = amount * rate;  // 9.000000000000002
```

**✅ Correct (exact decimal math):**
```typescript
const amount = toDecimal(75.00);
const rate = toDecimal(0.12);
const commission = multiplyAmount(amount, rate);
const rounded = roundAmount(commission, 2);  // Decimal(9.00)
const stored = toNumber(rounded);  // 9.00 (safe for DB)
```

### Where Decimal Is Used

**Booking creation:**
- `app/api/public/bookings/bulk/route.ts` — price calculation, discount application
- `lib/contexts/BookingContext.tsx` — client-side pricing preview

**Payment processing:**
- `app/api/stripe/webhook/route.ts` — commission splits, instructor payouts
- `lib/services/payment.ts` — all Stripe amount conversions (cents ↔ dollars)

**Wallet operations:**
- `app/api/wallet/credit/route.ts` — balance additions
- `app/api/wallet/deduct/route.ts` — balance subtractions
- `app/api/bookings/route.ts` — wallet payment deductions

**Refunds:**
- `lib/services/refund-service.ts` — refund amount calculations
- All refund API routes

**Payouts:**
- `app/api/cron/weekly-payouts/route.ts` — batch payout calculations
- `app/api/admin/payouts/route.ts` — manual payout amounts

### Testing Decimal Math

**Test cases in `__tests__/utils/decimal.test.ts`:**
- ✅ Addition/subtraction/multiplication/division
- ✅ Rounding edge cases (0.5, 0.995, 0.005)
- ✅ Precision retention through multi-step calculations
- ✅ Currency conversion (cents ↔ dollars)

**Verified scenarios:**
- 10-hour package with 10% discount + 3.6% platform fee → exact $699.30
- Commission split: $675 × 12% → exact $81.00 (not $81.0000000001)
- Wallet deduction: $150.50 - $75.25 → exact $75.25

### Common Pitfalls

**❌ Don't use `Number` arithmetic on money:**
```typescript
const total = booking.price * (1 - discount / 100);  // WRONG
```

**✅ Use Decimal helpers:**
```typescript
const price = toDecimal(booking.price);
const discountPct = toDecimal(discount);
const multiplier = toDecimal(1).minus(discountPct.dividedBy(100));
const total = roundAmount(multiplyAmount(price, multiplier), 2);
```

**❌ Don't compare Decimals with `===`:**
```typescript
if (balance === toDecimal(0)) { ... }  // WRONG — comparing object references
```

**✅ Use `.equals()` or `.isZero()`:**
```typescript
if (balance.isZero()) { ... }  // CORRECT
if (balance.equals(toDecimal(100))) { ... }  // CORRECT
```

**❌ Don't store Decimal objects in DB:**
```typescript
await prisma.booking.create({ price: myDecimal });  // Type error
```

**✅ Convert to number first:**
```typescript
await prisma.booking.create({ price: toNumber(myDecimal) });  // CORRECT
```

### Partial Package Refund Calculation

**Background:** When a customer cancels a package booking after using some hours, the refund must be calculated fairly by determining what the customer should have paid for the consumed hours based on tier discounts.

**Problem Example:**
- Customer buys **10hr package** at $70/hr with **10% discount** → pays **$630 total**
- Uses **5 lessons** (5hrs consumed, 5hrs remain)
- Requests cancellation

**Wrong calculation** (old logic):
- Refund = Single lesson price — **incorrect, ignores package context**

**Correct calculation** (new logic):
1. Hours used = 10 - 5 = **5 hours**
2. Tier discount for 5 hours = **0%** (need 6+ hours for 5% discount)
3. Amount for used hours = 5 × $70 × (1 - 0%) = **$350**
4. Refundable base = $630 - $350 = **$280**
5. Apply time-based policy: if >48h notice → 100% × $280 = **$280 refund**

**Tier thresholds:**
- **< 6 hours:** 0% discount
- **6-9 hours:** 5% discount
- **10-14 hours:** 10% discount
- **15+ hours:** 12% discount

**Implementation:** Function `calculatePartialPackageRefund(booking)` in `lib/services/booking-service.ts`

**Edge Cases Handled:**
- ✅ No hours used yet → refund full package amount
- ✅ All hours used → refund $0
- ✅ Not a package booking → refund single lesson price
- ✅ Decimal precision maintained throughout

**Database Fields Used:** `packageHours`, `packageHoursRemaining`, `packageTotalPaid`, `lockedHourlyRate`

---

### Migration History

**September 1, 2026** — Partial package refund fix
- **Problem:** Canceling a partially-used package refunded incorrectly (based on single lesson price)
- **Fix:** Added `calculatePartialPackageRefund()` helper that recalculates tier-appropriate discount for consumed hours
- **Impact:** Fair refunds for partial package cancellations — customer pays full rate for under-threshold usage
- **Files changed:** `lib/services/booking-service.ts`
- **Backward compat:** Applies to all future cancellations; existing completed cancellations unaffected

**August 30, 2026** — Decimal.js precision fix applied
- **Problem:** Booking totals off by 1-2 cents in ~5% of transactions
- **Root cause:** Default `decimal.js` precision (20) was correct, but rounding mode was `ROUND_DOWN` instead of `ROUND_HALF_UP`
- **Fix:** Set global config `Decimal.set({ rounding: Decimal.ROUND_HALF_UP })`
- **Impact:** All new calculations now match accounting standards
- **Backward compat:** Existing bookings unaffected (locked pricing)

**Files changed:**
- `lib/utils/decimal.ts` — added `Decimal.set()` at module top
- No other changes needed (helpers already wrapped all operations)

### Troubleshooting

**Issue:** Booking total doesn't match Stripe charge amount  
**Cause:** Floating-point drift in calculation  
**Fix:** Verify all intermediate steps use Decimal helpers, not raw `*` or `+`

**Issue:** Commission split is 1 cent off  
**Cause:** Rounding applied at wrong step  
**Fix:** Only round at the final step, keep intermediate values as Decimal

**Issue:** Wallet balance shows $100.0000000001  
**Cause:** Direct Number arithmetic somewhere in the chain  
**Fix:** Trace calculation, replace with Decimal helpers

---

## 12. PACKAGE TIERS MIGRATION (SEPTEMBER 2026)

### Overview

**Migration Date:** September 1, 2026  
**Status:** ✅ Complete — Booking flow fully DB-driven

Package tier configuration (hours, labels, discounts) moved from hardcoded constants to database storage. Admin can now manage tier structure from the pricing dashboard.

### What Changed

**Before:**
- Tier structure hardcoded in `lib/config/packages.ts` and 6 other files
- Changing "6/10/15 hours" to "8/12/20 hours" required editing 7 files + deploy
- Discount % changes required code changes

**After:**
- Single source of truth: `PlatformSettings.packageTiers` (JSONB column)
- Admin edits tiers from `/admin/pricing` UI (add/remove/edit rows)
- Discount % changes apply instantly (no deploy)
- Tier structure changes apply to booking flow instantly, marketing pages need one-file code update

### Database Schema

```typescript
PlatformSettings.packageTiers: Array<{
  hours:    number;   // e.g. 6, 10, 15, 20
  label:    string;   // e.g. "Starter", "Popular", "Best Value", "Premium"
  discount: number;   // percent, e.g. 10 = 10% off
  featured: boolean;  // true = shows "Most Popular" badge in UI
}>
```

**Example:**
```json
[
  { "hours": 6,  "label": "Starter",    "discount": 5,  "featured": false },
  { "hours": 10, "label": "Popular",    "discount": 10, "featured": true  },
  { "hours": 15, "label": "Best Value", "discount": 12, "featured": false }
]
```

### Admin Dashboard UI

**Location:** `/admin/pricing` → Package Discounts section

**New Features:**
- **Dynamic tier table** with columns: Hours | Label | Discount % | Featured | Remove
- **Add tier button** — click "+ Add tier" to insert new row
- **Remove tier button** — click ✕ on any row to delete
- **Inline editing** — type directly into hours/label/discount fields
- **Featured toggle** — click ★ to mark tier as "Most Popular" (only one can be featured)
- **Master toggle** — turn all discounts on/off globally

**⚠️ Prominent Warning Shown to Admin:**
> Booking flow reads tiers from this database table. Discount % changes apply instantly.  
> **However**, marketing pages (`/lessons`, `/lessons/packages`) reference a static constant `PREDEFINED_PACKAGES` in code.  
> **If you add or remove tiers**, also update `lib/config/packages.ts` and redeploy to keep those pages in sync.

### Price Locking (Critical)

**Pricing is immutable once purchased** — this did NOT change with the migration.

When customer buys a package:
```typescript
// Stored in Booking table at purchase time:
lockedHourlyRate: instructor.hourlyRate,    // $75
lockedDiscountPct: serverPricing.discountPercentage,  // 10%
```

All future operations use these locked values:
- Receipt emails
- Wallet deductions
- Booking edits/extensions
- Payout calculations
- Admin reports

**Example:**
1. Customer buys 10hr package on Sept 1 at 10% discount
2. Admin changes 10hr discount to 15% on Sept 2
3. Customer's package still uses 10% forever (locked at purchase)
4. New purchases from Sept 2 onward get 15%

### Data Flow

```
┌────────────────────────────────────────────────┐
│  Admin edits tier in pricing dashboard         │
└────────────────────────────────────────────────┘
                     ↓
         POST /api/admin/pricing
                     ↓
    prisma.platformSettings.upsert({ packageTiers })
                     ↓
         invalidatePricingCache()
                     ↓
┌────────────────────────────────────────────────┐
│  Booking flow (LIVE, instant updates)          │
└────────────────────────────────────────────────┘
    BookingContext → GET /api/public/pricing
         → getPlatformPricing() returns packageTiers
              → PackageSelector renders live tiers
              → Discount calc uses tier-aware helper
                     ↓
┌────────────────────────────────────────────────┐
│  Marketing pages (static fallback)             │
└────────────────────────────────────────────────┘
    /lessons, /lessons/packages
         → import PREDEFINED_PACKAGES from code
              → Needs manual update if tier structure changes
```

### Backward Compatibility

**Safe migration — no breaking changes:**

1. **Named columns preserved:**
   - `package6Discount`, `package10Discount`, `package15Discount` remain in schema
   - If `packageTiers` is null, code falls back to named columns
   - No data loss, no destructive schema changes

2. **Fallback behavior:**
   ```typescript
   const tiers = settings.packageTiers ?? [
     { hours: 6,  discount: settings.package6Discount,  ... },
     { hours: 10, discount: settings.package10Discount, ... },
     { hours: 15, discount: settings.package15Discount, ... },
   ];
   ```

3. **Rollback path:**
   - Set `packageTiers` to `null` in DB
   - Code automatically uses named columns
   - No code deploy needed for rollback

### Files Modified

| File | Change | Risk |
|------|--------|------|
| `prisma/schema.prisma` | Added `packageTiers Json?` column | Zero (additive, nullable) |
| `lib/config/packages.ts` | Added `getPackageTiers()`, `invalidatePricingCache()` | Low (backward compat fallback) |
| `lib/services/platform-pricing.ts` | `getPlatformPricing()` now includes `packageTiers` | Low (returns additional field) |
| `app/api/admin/pricing/route.ts` | POST accepts `packageTiers`, invalidates cache | Low (Zod validates input) |
| `app/api/public/pricing/route.ts` | GET returns `packageTiers` | Zero (additive response) |
| `components/admin/PricingSettingsForm.tsx` | Replaced 3 fields with dynamic table | Medium (UI only, no logic risk) |
| `components/PackageSelector.tsx` | Reads from `packageTiers`, falls back to named columns | Low (graceful fallback) |
| `lib/contexts/BookingContext.tsx` | Discount calc uses tier helper, same fallback | Low (same calculation, new source) |

**Untouched (intentional):**
- `app/lessons/page.tsx` — still uses static `PREDEFINED_PACKAGES`
- `app/lessons/packages/page.tsx` — same
- `package6Discount` / `package10Discount` / `package15Discount` columns — kept as fallback

### Testing Performed

✅ Schema migration applied via `prisma db execute`  
✅ Prisma client regenerated  
✅ Admin UI loads tier table with seeded data  
✅ Add tier → save → booking flow shows new tier  
✅ Remove tier → save → booking flow no longer shows it  
✅ Change discount % → save → new bookings reflect immediately  
✅ Toggle featured → "Most Popular" badge moves to correct tier  
✅ Old bookings verified — still show locked pricing  
✅ Receipts use locked values  
✅ Wallet deductions use locked rate  

### Admin Workflow

**Change discount % (instant, no deploy):**
1. Go to `/admin/pricing`
2. Edit discount field in tier table
3. Click Save
4. New bookings reflect change immediately

**Add new tier (e.g. 20hr "Premium"):**
1. Go to `/admin/pricing`
2. Click "+ Add tier"
3. Set hours=20, label="Premium", discount=15%, featured=false
4. Click Save
5. Booking flow shows new tier instantly
6. **Also update** `lib/config/packages.ts` → add to `PREDEFINED_PACKAGES` array
7. Deploy code update for marketing pages

**Remove existing tier (e.g. drop 6hr):**
1. Go to `/admin/pricing`
2. Click ✕ on the 6hr row
3. Click Save
4. Booking flow no longer offers 6hr package
5. **Also update** `lib/config/packages.ts` → remove from `PREDEFINED_PACKAGES`
6. Deploy code update for marketing pages

### Known Limitation

**Marketing pages drift until code deploy:**

Problem:
- Admin adds 20hr tier in dashboard
- Booking flow shows it instantly ✅
- Marketing pages (`/lessons`, `/lessons/packages`) still show "6, 10, 15 hours" until `PREDEFINED_PACKAGES` updated in code + deploy ⚠️

Why:
- Marketing pages import static constant for SEO/SSG compatibility
- Can't call async DB functions at module scope in those pages

Mitigation:
- Prominent amber warning in admin dashboard explains this
- Documentation (this section) clearly states the workflow
- Future: convert marketing pages to async server components (eliminates static constant)

### Cache Behavior

- **Pricing settings cache:** 5 minutes TTL
- **Tier data cache:** shares same 5-minute window
- **Invalidation:** automatic after save via `invalidatePricingCache()`
- **Impact:** discount % changes visible within 5 minutes or on next page load

### Support & Troubleshooting

**Issue:** Changed tier in admin but booking flow doesn't show it  
**Cause:** Cache not yet expired  
**Fix:** Wait 5 minutes or restart app (cache cleared)

**Issue:** Removed tier but customers can still see it  
**Cause:** Browser cache or CDN edge cache  
**Fix:** Hard refresh (Ctrl+Shift+R), clear browser cache

**Issue:** Marketing pages show wrong tiers  
**Cause:** `PREDEFINED_PACKAGES` not updated in code  
**Fix:** Update `lib/config/packages.ts` → `PREDEFINED_PACKAGES` array and deploy

**Issue:** Old booking showing new discount  
**Cause:** Bug — this should never happen  
**Fix:** Check `booking.lockedDiscountPct` in DB — if null, that's the root cause  
**Action:** File bug report, locked pricing is immutable

### Migration Documentation

Full technical details: `docs/PACKAGE_TIERS_MIGRATION.md`

**Status:** ✅ Complete pricing reference for development & administration  
**Last Updated:** September 1, 2026 — Package Tiers Migration Complete

