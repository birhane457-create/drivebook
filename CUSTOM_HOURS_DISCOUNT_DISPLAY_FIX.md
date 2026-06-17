# Custom Hours Discount NOT Showing in Booking Summary - FIXED

## Problem Found
When users selected custom hours (e.g., 8 hours) from the "Or choose custom hours" dropdown:
- **Frontend UI**: Correctly displayed discount badge "(5% off)" ✅
- **Booking Summary**: Showed NO discount line, charged full price ❌
- **Database**: Standard packages (6%, 10%, 15%) applied correctly, but CUSTOM always 0%

### Root Cause
Three places were NOT applying dynamic discount thresholds for CUSTOM hours:

**1. Static Function - lib/config/packages.ts**
```typescript
// BEFORE
CUSTOM: {
  hours: 0,
  discount: 0,  // ❌ Always 0, no threshold logic
}
```

**2. Dynamic Function - lib/config/packages.ts**  
```typescript
// BEFORE - CUSTOM type always used discount: 0
const pkg = packages[packageType];
const discountPercentage = pkg.discount;
// ❌ For CUSTOM type, would always be 0
```

**3. Booking Context - lib/contexts/BookingContext.tsx**
```typescript
// BEFORE
const discountMap: Record<string, number> = {
  PACKAGE_6: s.package6Discount,
  PACKAGE_10: s.package10Discount,
  PACKAGE_15: s.package15Discount,
  CUSTOM: 0,  // ❌ HARDCODED TO 0!
};
```

---

## Solution Implemented

### 1. lib/config/packages.ts - Static Function
Added logic to calculate discount based on hour thresholds for CUSTOM type:
```typescript
// AFTER
let discountPercentage = pkg.discount;
if (packageType === 'CUSTOM') {
  if (hours >= 15) discountPercentage = DEFAULT_SETTINGS.package15Discount;
  else if (hours >= 10) discountPercentage = DEFAULT_SETTINGS.package10Discount;
  else if (hours >= 6) discountPercentage = DEFAULT_SETTINGS.package6Discount;
  else discountPercentage = 0;
}
```

### 2. lib/config/packages.ts - Dynamic Function  
Added new helper function `getDiscountForCustomHours()` and used it in `calculatePackagePriceDynamic()`:
```typescript
// NEW HELPER
export async function getDiscountForCustomHours(hours: number): Promise<number> {
  const settings = await getPricingSettings();
  
  if (hours >= 15) return settings.package15Discount;
  if (hours >= 10) return settings.package10Discount;
  if (hours >= 6) return settings.package6Discount;
  return 0;
}

// UPDATED
let discountPercentage = pkg.discount;
if (packageType === 'CUSTOM') {
  discountPercentage = await getDiscountForCustomHours(hours);
}
```

### 3. lib/contexts/BookingContext.tsx - Pricing Calculation
Fixed the `calculatePricing()` function to apply dynamic thresholds:
```typescript
// AFTER
let discountPercentage = 0;
if (state.packageType === 'CUSTOM') {
  // For custom hours, apply dynamic thresholds
  if (state.hours >= 15) discountPercentage = s.package15Discount;
  else if (state.hours >= 10) discountPercentage = s.package10Discount;
  else if (state.hours >= 6) discountPercentage = s.package6Discount;
  else discountPercentage = 0;
} else {
  // For standard packages, use fixed discount
  const discountMap: Record<string, number> = {
    PACKAGE_6: s.package6Discount,
    PACKAGE_10: s.package10Discount,
    PACKAGE_15: s.package15Discount,
  };
  discountPercentage = discountMap[state.packageType] ?? 0;
}
```

---

## Flow - How It Works Now

### When User Selects Custom Hours

1. **PackageSelector.tsx** (Frontend UI)
   - User selects "8 hrs" from dropdown
   - Calculates: `getDiscountForHours(8)` → 5%
   - Displays: "8 hrs — $570 (5% off)" ✅

2. **BookingContext.tsx** (Pricing Calculation)
   - State updates: `{ packageType: 'CUSTOM', hours: 8 }`
   - `calculatePricing()` runs
   - For CUSTOM: applies thresholds → 5% discount ✅
   - Sets pricing: `{ discountPercentage: 5, discount: $30.00, ... }`

3. **BookingSummary.tsx** (Display)
   - Reads from context: `bookingState.pricing`
   - Renders: "Discount (5%) -$30.00" ✅

4. **Backend API** (Bulk Booking)
   - Receives: `{ packageType: 'CUSTOM', hours: 8, pricing: {...} }`
   - `calculatePackagePriceDynamic()` runs
   - Calculates same way → Final price matches frontend ✅

---

## Discount Thresholds
| Hours | Discount | Example Price @ $75/hr |
|-------|----------|----------------------|
| 1-5   | 0%       | 5h = $375.00        |
| 6-9   | 5%       | 8h = $570.00 (-$30) |
| 10-14 | 10%      | 12h = $810.00 (-$90)|
| 15+   | 12%      | 20h = $1,320.00 (-$180) |

---

## Example: 8 Hours @ $75/hr

### Before Fix ❌
```
Subtotal:        $600.00
Discount (0%):   Not shown
Total:           $621.60 (+ $21.60 platform fee)
```

### After Fix ✅
```
Subtotal:        $600.00
Discount (5%):   -$30.00
After discount:  $570.00
Platform fee:    +$20.52
Total:           $590.52
```

---

## Files Changed

1. **lib/config/packages.ts**
   - Added `getDiscountForCustomHours()` helper function
   - Updated `calculatePackagePriceDynamic()` to use dynamic thresholds
   - Updated `calculatePackagePrice()` static version for consistency

2. **lib/contexts/BookingContext.tsx**
   - Fixed `calculatePricing()` function to apply dynamic thresholds for CUSTOM type

---

## Testing Verified

✅ Discount logic working at all thresholds:
- 5 hours: 0% discount
- 6-9 hours: 5% discount
- 10-14 hours: 10% discount
- 15+ hours: 12% discount

✅ Pricing calculation correct across all three places:
- Static function (BulkBookingForm client-side)
- Dynamic function (Backend bulk booking API)
- Booking context (Booking summary display)

✅ Summary now displays discount information correctly
✅ Backend validates pricing matches frontend calculation

---

## Related Fixes

This fixes the display issue for custom hours discounts. Related issues:

1. ✅ **PDA Config Deletion Persistence** (Fixed) - Deleted configs reappearing after reload
2. ✅ **Custom Hours Discount Calculation** (Fixed) - Backend wasn't applying thresholds
3. ✅ **Custom Hours Discount Display** (Fixed) - Booking summary wasn't showing discount
4. ⚠️ **Custom Package Discount** (Still Needs Fix) - Instructor custom packages store discount but backend ignores it

---

## Impact

- ✅ Customers now see correct total price in booking summary
- ✅ Frontend and backend pricing match
- ✅ No silent price discrepancies
- ✅ All three pricing calculation paths (static, dynamic, context) now consistent
