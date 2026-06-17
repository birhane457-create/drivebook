# Pricing Configuration & Management Guide

**Date:** June 15, 2026  
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
  - BUSINESS tier commission rate
- **Range:** 0-50%
- **What It Does:** Platform's cut of every booking

#### New Student Bonuses Section
- **Fields by Tier:**
  - BASIC tier first booking bonus
  - PRO tier first booking bonus
  - BUSINESS tier first booking bonus
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
             (15% BASIC, 12% PRO, 10% BUSINESS)

New Student Bonus = (Booking Amount) × Bonus Rate by Tier
                    (8% BASIC, 10% PRO, 12% BUSINESS)
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

**Status:** ✅ Complete pricing reference for development & administration  
**Last Updated:** June 15, 2026

