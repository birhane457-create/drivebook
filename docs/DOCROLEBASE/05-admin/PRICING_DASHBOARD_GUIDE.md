# Admin Pricing Dashboard — Complete User Guide

**Last Updated:** September 1, 2026  
**Location:** `/admin/pricing`  
**Permission Required:** `FINANCE_PRICING_VIEW`

---

## Overview

The pricing dashboard is the single source of control for all platform pricing, commissions, discounts, and financial policies. Changes made here apply to **new bookings immediately** (within 5 minutes due to cache TTL).

**Critical:** Existing bookings use locked pricing — changes here never affect past transactions.

---

## Dashboard Sections

### 1. Platform Fee

**Icon:** 💵 Dollar Sign (Blue)

**What it controls:** Processing fee percentage added on top of booking amounts at checkout.

| Field | Default | Range | Impact |
|-------|---------|-------|--------|
| Processing fee charged to clients (%) | 3.6% | 0-10% | Added to every booking at checkout. This is the platform's main payment processing revenue. |

**Example:** 
- Lesson price: $75
- Platform fee at 3.6%: $2.70
- Client pays: $77.70

**Who gets it:** Platform (100%)

**Recommendations:**
- Keep between 3-4% for competitive positioning
- Higher than 5% may deter price-sensitive customers
- Lower than 2% may not cover Stripe processing costs (1.75% + $0.30)

---

### 2. Package Discounts (NEW — Sept 2026)

**Icon:** 📦 Package (Green)

**What it controls:** Bulk hour discounts for package purchases. Now uses a **dynamic tier table** instead of hardcoded 6/10/15hr fields.

#### Master Toggle

Toggle switch at the top of the section:
- **ON (Green)** — bulk discounts active, shows current tier discounts
- **OFF (Gray)** — sets all tier discounts to 0%, clients pay full hourly rate regardless of package size

**Use case for OFF:** Temporary promotions where you want flat hourly pricing, or testing full-price demand.

#### Dynamic Tier Table

| Column | Purpose | Editable | Range |
|--------|---------|----------|-------|
| **Hours** | Package size (e.g., 6, 10, 15, 20) | ✅ Yes | 1-50 |
| **Label** | Display name (e.g., "Starter", "Popular", "Best Value") | ✅ Yes | 40 chars max |
| **Discount %** | Percentage off for this tier | ✅ Yes | 0-50% |
| **Featured** | Shows "Most Popular" badge in booking UI | ✅ Toggle (⭐) | Only one can be featured |
| **Remove** | Delete this tier | ✅ Button (✕) | Can't remove if < 2 tiers |

#### Actions

**Add tier:** Click "+ Add tier" button at bottom of table → new row inserted with defaults (hours=1, label="Custom", discount=0%, featured=false)

**Remove tier:** Click ✕ button on any row → tier deleted immediately (must have at least 1 tier remaining)

**Edit inline:** Click into any field and type — changes are local until you click "Save Pricing Settings"

**Toggle featured:** Click ⭐ button → marks this tier as "Most Popular", clears featured flag from others (only one can be featured)

#### ⚠️ Important Warning Box (Amber)

**What it says:**
> The booking flow reads tiers directly from this database table. Changes to discount % take effect immediately with no code deploy.
>
> **However**, the public marketing pages (`/lessons` and `/lessons/packages`) still reference a static fallback constant called `PREDEFINED_PACKAGES` in `lib/config/packages.ts`.
>
> **If you add or remove tiers (not just change %), also update `PREDEFINED_PACKAGES` and redeploy to keep those pages in sync.**

**What this means:**
- **Discount % changes** → instant, no code changes needed ✅
- **Add/remove tiers** → booking flow picks it up instantly ✅, but marketing pages need a code file updated + deploy ⚠️

**Developer action required when adding/removing tiers:**
1. Open `lib/config/packages.ts`
2. Update the `PREDEFINED_PACKAGES` array to match your tier table
3. Commit and deploy

**Example:**
Admin adds a 20hr "Premium" tier at 15% discount → customers can immediately book it on `/book`, but `/lessons` page still shows "6, 10, 15 hours" until `PREDEFINED_PACKAGES` is updated.

#### Who Pays for the Discount

Below the tier table, you'll see a dropdown:

**Discount paid by:**
- **platform** — Platform absorbs discount by lowering commission to instructors (platform takes less revenue)
- **shared** — Client saves, instructor gets slightly less, platform passes through
- **instructor** — Full discount deducted from instructor payout (platform keeps normal commission)

**Default:** `shared`

**Recommendation:** Keep as `shared` unless running a specific promotion strategy.

---

### 3. Commission Rates

**Icon:** 📈 Trending Up (Purple)

**What it controls:** Platform's cut of each booking, varies by instructor subscription tier.

| Field | Default | Range | Applies To |
|-------|---------|-------|------------|
| BASIC tier commission rate | 15% | 0-50% | Instructors on $29/mo BASIC plan |
| PRO tier commission rate | 12% | 0-50% | Instructors on $79/mo PRO plan |
| STUDIO tier commission rate | 11% | 0-50% | Instructors on $129/mo STUDIO plan |
| PREMIUM tier commission rate (DB: businessCommissionRate) | 10% | 0-50% | Instructors on $199/mo PREMIUM plan |

**How it works:**
- Instructor charges $75 for 1hr lesson
- PRO tier = 12% commission
- Platform takes: $75 × 12% = $9
- Instructor gets: $75 - $9 = $66

**Tier hierarchy:** Higher subscription tier = lower commission % = more payout to instructor

**Recommendations:**
- Maintain clear tier differentiation (3-5% gaps between tiers)
- Never go below 8% (covers platform costs + Stripe fees)
- BASIC tier should be 12-15% to incentivize upgrades

---

### 4. New Student Bonuses (DEPRECATED — May 2026)

**Status:** ⚠️ Fields removed from UI (schema fields remain for backward compat)

**What it was:** Extra commission for instructors on their first booking with a new student.

**Why removed:** Replaced by referral system (coming in Phase 3).

**Database:** `basicNewStudentBonus`, `proNewStudentBonus`, `businessNewStudentBonus` columns still exist but are ignored by booking flow.

---

### 5. Cancellation & Penalties

**Icon:** 🛡️ Shield (Red)

**What it controls:** Refund policies and penalties for cancellations and no-shows.

| Field | Default | Range | Purpose |
|-------|---------|-------|---------|
| Cancellation fee | $0 | $0-$200 | Charged on cancellation regardless of timing (currently not enforced) |
| Late cancellation window (hours) | 24 | 1-168 | Threshold for 50% refund vs 100% refund |
| No-show penalty amount | $0 | $0-$200 | Charged when customer doesn't show up (currently not enforced) |

**Refund policy (enforced by backend):**
- **Cancel >48h before:** 100% refund to wallet
- **Cancel 24-48h before:** 50% refund to wallet
- **Cancel <24h before:** 0% refund
- **Already started:** 0% refund (booking marked non-refundable)

**Formula:** Full refund window = `lateCancellationWindowHours × 2`

**Package cancellation refunds (NEW — Sept 2026):**
When a customer cancels a partially-used package, the refund is calculated tier-aware:
1. Calculate hours used = `packageHours - packageHoursRemaining`
2. Determine discount tier for hours used (not original package tier)
3. Calculate amount customer should have paid for used hours
4. Refund = `packageTotalPaid - amountForUsedHours`
5. Apply time-based policy (100%/50%/0%)

**Example:**
- Bought 10hr @ $70/hr with 10% discount → paid $630
- Used 5hrs (qualifies for 0% discount since <6hrs)
- Should have paid: 5 × $70 × (1 - 0%) = $350
- Refund base: $630 - $350 = $280
- If >48h notice: $280 refund
- If 24-48h notice: $140 refund

**See also:** `PRICING_CONFIGURATION_GUIDE.md` section "Partial Package Refund Calculation"

---

### 6. Wallet Settings

**Icon:** 💳 Wallet (Indigo)

**What it controls:** Min/max amounts for wallet top-ups.

| Field | Default | Range | Purpose |
|-------|---------|-------|---------|
| Wallet top-up minimum | $10 | $1-$100 | Smallest amount customer can add to wallet |
| Wallet top-up maximum | $500 | $50-$5000 | Largest single wallet credit |

**Recommendations:**
- Keep min at $10-$20 to reduce Stripe transaction fees (flat $0.30/transaction)
- Keep max at $500-$1000 to reduce fraud risk
- Higher limits may require additional KYC/fraud checks

---

### 7. Tax Settings

**Icon:** 💰 Percent (Yellow)

**What it controls:** GST and withholding tax rates (Australia-specific).

| Field | Default | Applies To |
|-------|---------|------------|
| GST enabled | true | All bookings (receipt generation) |
| GST rate (%) | 10% | Australian Goods & Services Tax |
| Withholding tax rate (%) | 47% | Instructors without verified ABN |

**GST (Goods & Services Tax):**
- Applied to lesson price on receipts
- Currently display-only (not used in booking price calculation)
- Required for Australian tax compliance

**Withholding Tax:**
- Applied to instructor payouts when ABN is not verified
- **Formula:** `payout × (1 - 0.47)` = amount transferred to instructor
- Held amount reported to ATO as withheld tax
- **Status:** Not yet enforced (coming in Phase 4)

---

### 8. Peak Pricing (Future Feature)

**Icon:** ⚡ Zap (Orange)

**What it controls:** Surge pricing for high-demand time slots.

| Field | Default | Status |
|-------|---------|--------|
| Peak surcharge enabled | false | ⚠️ Not yet active |
| Peak surcharge percent | 0% | UI only — not enforced by booking flow |

**Planned behavior:**
- Define peak hours (e.g., weekdays 4-7pm, weekends 9am-2pm)
- Add surcharge % to booking price during peak slots
- Revenue split TBD (platform, instructor, or shared)

**Current status:** Fields exist but are ignored by booking creation logic. Coming in Phase 5.

---

## Live Preview Panel (Right Side)

**What it shows:** Real-time calculation of a sample booking using current settings.

**Inputs:**
- **Instructor hourly rate:** Slider (default $75) — adjustable from $40-$150
- **Package tier:** Auto-selects the "featured" tier from your table
- **Subscription tier:** Fixed at PRO for preview purposes

**Calculations shown:**

| Line | Formula | Example |
|------|---------|---------|
| Subtotal | `rate × hours` | $75 × 10 = $750 |
| Package discount | `subtotal × discount%` | $750 × 10% = -$75 |
| After discount | `subtotal - discount` | $750 - $75 = $675 |
| GST (if enabled) | `afterDiscount × gstRate` | $675 × 10% = $67.50 |
| Platform fee | `afterDiscount × platformFee%` | $675 × 3.6% = $24.30 |
| **Client total** | `afterDiscount + GST + platformFee` | $675 + $67.50 + $24.30 = $766.80 |
| Commission (PRO tier) | `afterDiscount × proCommissionRate` | $675 × 12% = $81 |
| **Instructor payout** | `afterDiscount - commission` | $675 - $81 = $594 |
| **Platform revenue** | `platformFee + commission` | $24.30 + $81 = $105.30 |

**Color coding:**
- 🟢 Green = Client payment
- 🔵 Blue = Instructor payout
- 🟣 Purple = Platform revenue

**Use this for:** Testing pricing changes before saving, explaining pricing to stakeholders, training new admin staff.

---

## Save Button & Validation

**Button text:** "Save Pricing Settings"  
**Location:** Bottom of form (fixed position when scrolling)  
**Loading state:** Shows spinner + "Saving..." when submitting

**Validation rules:**
- Platform fee: 0-10%
- Tier discounts: 0-50%
- Commission rates: 0-50%
- Hours: 1-50
- Labels: 1-40 characters
- At least 1 package tier must exist

**Success:**
- ✅ Green toast notification: "Pricing settings saved successfully"
- Cache invalidated → new bookings use updated pricing within 5 minutes

**Failure:**
- ❌ Red toast notification with error message
- Common errors:
  - "Validation failed" — out-of-range value
  - "Network error" — connectivity issue, retry
  - "Permission denied" — user lost FINANCE_PRICING_VIEW permission

---

## Scheduled Rate Changes (Below Main Form)

**Component:** `RateChangeScheduler`  
**Feature:** Schedule pricing changes to take effect at a future date/time.

**Status:** ⚠️ UI exists but backend logic not yet implemented (coming in Phase 4).

**Planned features:**
- Schedule commission rate changes (e.g., "Drop PRO commission to 10% on Jan 1, 2027")
- Schedule discount changes (e.g., "Black Friday: 20% package discount Nov 24-30")
- View pending scheduled changes
- Cancel scheduled changes before they activate

---

## Permissions & Access Control

**View access:** `FINANCE_PRICING_VIEW` permission  
**Edit access:** `FINANCE_PRICING_EDIT` (implicit with view permission for admins)

**Who has access:**
- **Platform admins:** Full read + write
- **Finance staff:** Read-only (coming — requires granular RBAC)
- **Instructors:** No access (see their own commission rate in settings)
- **Customers:** No access (see pricing at booking time only)

**Audit logging:** All pricing changes are logged to `AuditLog` table with `action=SETTINGS_CHANGED`, `actorId`, `actorRole=ADMIN`, and full before/after diff in metadata.

---

## Common Admin Workflows

### Change package discount %
1. Navigate to Package Discounts section
2. Find the tier you want to update in the table
3. Edit the "Discount %" field inline
4. Click "Save Pricing Settings"
5. ✅ New bookings reflect the change within 5 minutes

### Add a new 20hr "Premium" tier
1. Scroll to Package Discounts section
2. Click "+ Add tier" button at bottom of table
3. Set hours=20, label="Premium", discount=15%
4. Click ⭐ to mark as featured (optional)
5. Click "Save Pricing Settings"
6. ⚠️ **Developer action required:**
   - Open `lib/config/packages.ts`
   - Add `{ hours: 20, label: "Premium", discount: 15, featured: false }` to `PREDEFINED_PACKAGES` array
   - Commit + deploy
7. ✅ Booking flow shows the new tier immediately; marketing pages show it after deploy

### Remove the 6hr tier
1. Find the 6hr row in the tier table
2. Click ✕ button on the right
3. Row disappears from table
4. Click "Save Pricing Settings"
5. ⚠️ **Developer action required:** Remove 6hr entry from `PREDEFINED_PACKAGES` and redeploy
6. ✅ Booking flow no longer offers 6hr packages; marketing pages update after deploy

### Temporarily disable all discounts
1. Go to Package Discounts section
2. Toggle the master switch to OFF (gray)
3. All tier discounts automatically set to 0%
4. Click "Save Pricing Settings"
5. ✅ Clients now pay full hourly rate for all package sizes

### Change PRO commission rate from 12% to 11%
1. Scroll to Commission Rates section
2. Edit "PRO tier commission rate" field → change 12 to 11
3. Click "Save Pricing Settings"
4. ✅ All PRO tier instructors get 11% commission on new bookings
5. Existing bookings unchanged (locked at 12%)

---

## Troubleshooting

### "Settings not saving" or timeout error
**Cause:** Database connection issue or Vercel function timeout  
**Fix:** Retry after 30 seconds. If persists, check Vercel logs for errors.

### Changed discount but booking flow shows old discount
**Cause:** Pricing cache not yet expired (5-minute TTL)  
**Fix:** Wait 5 minutes, or manually invalidate cache by restarting the app (not recommended in production).

### Added tier but marketing pages don't show it
**Cause:** `PREDEFINED_PACKAGES` in `lib/config/packages.ts` not updated  
**Fix:** Update the code file and redeploy. See "Add a new tier" workflow above.

### Preview panel shows wrong calculations
**Cause:** Preview uses hardcoded PRO tier for demo purposes  
**Fix:** This is expected behavior — preview is for reference only, not exact booking quotes.

### Master toggle stuck in ON position
**Cause:** At least one tier has discount > 0  
**Fix:** This is intentional — toggle OFF will set all discounts to 0. If you want a specific tier at 0%, edit that row's discount field directly.

---

## Best Practices

✅ **Test in dev first:** Always test pricing changes in a staging environment before production  
✅ **Communicate changes:** Email instructors 1 week before commission rate changes  
✅ **Monitor refunds:** After cancellation policy changes, watch for refund disputes  
✅ **Keep tier gaps clear:** 3-5% discount difference between tiers maintains value perception  
✅ **Document custom tiers:** If you add unique tiers (e.g., 8hrs, 12hrs), document why for future admins  
✅ **Review quarterly:** Pricing should be reviewed every 3-6 months based on market conditions  

❌ **Don't change commission rates more than twice a year** — frequent changes erode instructor trust  
❌ **Don't set platform fee > 5%** without customer research — may reduce conversion  
❌ **Don't remove tiers without checking booking history** — if customers have unused hours in that tier, keep it active  

---


---

## Admin Cancellation & Refund Management

### Where Admin Manages Cancellations

**Location:** `/admin/bookings`

**What admin can do:**
- View all bookings with status filter (CONFIRMED, PENDING, CANCELLED, COMPLETED, NO_SHOW)
- Click any booking → modal shows details + action buttons
- Click "Cancel Booking" button → confirms cancellation, notifies client + instructor
- Cancellation triggers backend refund calculation (tier-aware for packages)

**What is shown:**
- 📦 Package indicator icon for package bookings
- Basic booking info: customer name, instructor, date/time, price, status
- Action buttons: Complete, Mark No-Show, Cancel (if applicable)
- Note: "Package lesson — refunds return as wallet credit, not card refund"

### ⚠️ What is MISSING (as of Sept 2026)

**Gap:** Admin cannot see package refund calculation details before confirming cancellation.

**Specifically missing:**
1. **Package details not shown:**
   - Hours purchased (e.g., 10 hours)
   - Hours remaining (e.g., 5 hours)
   - Hours used (calculated: 10 - 5 = 5)
   - Total paid for package (e.g., $630)
   - Locked hourly rate at purchase (e.g., $70)
   - Locked discount % at purchase (e.g., 10%)

2. **Refund preview not shown:**
   - When admin clicks "Cancel Booking" for a partially-used package, no preview of refund calculation is displayed
   - Admin cannot explain to customer WHY refund is $280 instead of $315 (remaining 5hrs × $63/hr)

3. **No refund breakdown in confirmation:**
   - Confirmation dialog shows: "Lesson credit returned to package · Notifies both parties"
   - Should show: "Hours used: 5 (0% tier) → Amount for used: $350 → Refund: $630 - $350 = $280"

### Planned Enhancement (PKG-2)

**Add to booking detail modal:**
```
┌─ Package Details ─────────────────────────────────┐
│ Hours purchased: 10                               │
│ Hours remaining: 5                                │
│ Hours used: 5 (qualifies for 0% discount)        │
│ Total paid: $630                                  │
│ Locked rate: $70/hr @ 10% original discount      │
└───────────────────────────────────────────────────┘
```

**Add to cancel confirmation:**
```
┌─ Refund Calculation ──────────────────────────────┐
│ Hours used: 5 (0% tier discount applies)         │
│ Amount for used hours: 5 × $70 × (1-0%) = $350   │
│ Refundable base: $630 - $350 = $280              │
│ Cancellation timing: >48h notice                 │
│ Refund policy: 100%                              │
│ Final refund to wallet: $280                     │
└───────────────────────────────────────────────────┘
```

**Add to revenue → refunds tab:**
- New "Package" column showing "10hr pkg (5 used)" for package refunds
- Tooltip on hover explaining tier-aware calculation

### Current Refund Workflow (Admin)

**Step 1:** Admin receives customer inquiry about canceling package

**Step 2:** Admin navigates to `/admin/bookings`, searches for customer

**Step 3:** Admin clicks booking → modal opens showing:
- Customer: John Smith
- Instructor: Jane Doe
- Date: Sept 5, 2026 2:00pm
- Price: $75 (single lesson price, NOT package total)
- Status: CONFIRMED
- 📦 Package indicator

**Step 4:** Admin clicks "Cancel Booking"
- ⚠️ No refund preview shown
- Generic message: "Lesson credit returned to package · Notifies both parties"
- Admin clicks confirm

**Step 5:** Backend calculates refund using `calculatePartialPackageRefund()`
- Calculates tier-aware amount
- Credits wallet automatically
- Sends notification emails

**Step 6:** Customer asks "Why did I only get $280 back when I paid $630?"
- ⚠️ Admin has no UI showing the calculation breakdown
- Admin must manually calculate or check database/logs
- Poor customer experience

### Workaround (Until PKG-2 Implemented)

**For admin staff explaining refunds:**

1. Ask customer: "How many lessons have you completed from the package?"
2. Check booking history to confirm hours used
3. Use this manual calculation:
   - **Hours used < 6:** No discount (0%)
   - **Hours used 6-9:** 5% discount
   - **Hours used 10-14:** 10% discount
   - **Hours used 15+:** 12% discount
4. Calculate: `amountForUsed = hoursUsed × instructorRate × (1 - tierDiscount/100)`
5. Refund = `packageTotalPaid - amountForUsed`
6. Apply cancellation timing policy (100%/50%/0%)

**Example script for customer service:**
> "You purchased a 10-hour package for $630 (with 10% bulk discount). You've used 5 hours so far.
> When we calculate the refund, we charge you for the 5 hours you used at the regular rate (since 5 hours doesn't qualify for any discount).
> 5 hours × $70/hour = $350.
> Your refund is $630 - $350 = $280.
> Since you're canceling more than 48 hours in advance, you get the full $280 credited to your wallet."

---

## Related Documentation

- **Technical:** `PRICING_CONFIGURATION_GUIDE.md` — full backend reference, formulas, caching, database schema
- **Development:** `PACKAGE_TIERS_MIGRATION.md` — how the tier system was migrated from hardcoded to DB-driven
- **Reference:** `HARDCODED_VALUES.md` — comprehensive list of all pricing constants and where they're stored

---

**Questions?** Check `PRICING_CONFIGURATION_GUIDE.md` section 11 for detailed calculations, or section 12 for package tier migration details.

**Last Review:** September 1, 2026 — Package tier table UI complete, partial package refund logic implemented
