# WLA-018 — Public Branding Claims Audit

**Audit date:** 2026-11-05  
**Source inspected:** 31a3ada0 (WLA-018 v4 fix commit)  
**Evidence sync:** 79792512  
**Status:** ✅ FIX-VERIFIED (source level) — reviewer accepted 2026-11-06  
**Qualifications:** (1) Committed source inspected; deployed production website not independently verified. (2) Checkout/payment flows not independently executed. (3) No automated tests — finding concerns marketing and configuration consistency. (4) Lessons page retains informational 3.6% default with explanatory note.

---

## v4 Corrections (in addition to v1-v3)

### Remaining fee terminology corrected

The v3 review found additional "processing fee" references in customer-facing surfaces. All have been corrected:

| File | Old wording | New wording | Surface |
|---|---|---|---|
| `app/api/bookings/send-payment-link/route.ts` (table row) | "Platform processing fee" | "DriveBook platform fee" | Customer payment-link email |
| `app/api/bookings/send-payment-link/route.ts` (footer) | "platform processing fee" | "DriveBook platform fee" | Same email footer |
| `app/client-dashboard/help/page.tsx` (FAQ question) | "What is the platform processing fee?" | "What is the DriveBook platform fee?" | Customer help FAQ |
| `app/client-dashboard/help/page.tsx` (payment link answer) | "lesson cost + processing fee" | "lesson cost + DriveBook platform fee" | Customer help FAQ |
| `app/instructor-terms/page.tsx` (clause 11) | "platform processing fee" | "DriveBook platform fee" | Instructor terms (2 instances) |
| `lib/config/packages.ts` (comment) | "platform processing fee" | "DriveBook platform fee" | Code comment |
| `components/admin/PricingSettingsForm.tsx` | "Processing fee charged to clients" | "DriveBook platform fee charged to clients" | Admin settings |
| `components/BulkBookingForm.tsx` (2 instances) | "Platform fee (3.6%)" | "DriveBook platform fee (3.6%)" | Customer bulk booking form |
| `components/BookingFormNew.tsx` | "includes 3.6% platform fee" | "includes DriveBook platform fee" | Customer booking form |

### Lessons page hardcoded 3.6%

**Issue:** `app/lessons/page.tsx` is a client component — cannot fetch server-side platform fee.

**Resolution:** Retained 3.6% as the displayed default with an added note: "(The actual rate is configurable by DriveBook and is shown at checkout.)" This makes clear that the displayed rate is informational and the authoritative rate is applied at checkout from `PlatformSettings`.

### Invoice "Processing fees" at $0.00

**Assessment:** Invoice components (`InvoiceLayout.tsx`, `ReceiptH_WeeklyEarnings.tsx`, `ReceiptI_InstructorInvoice.tsx`) display "Processing fees: $0.00". These are a separate concept from the DriveBook platform fee — they represent Stripe's processing charges (currently $0 in this pricing model). No change needed.

**Source evidence:** `lib/services/receipt/builder.ts` classifies line items by type:
- `LineItemType.PLATFORM_FEE` → `SupplierType.PLATFORM`, always taxable — this is the DriveBook 3.6% fee
- `LineItemType.COMMISSION` → `SupplierType.PLATFORM`, always taxable — this is the tier commission (10-15%)
- `LineItemType.FVV` → `SupplierType.NONE`, never taxable — free-value-void items
- `LineItemType.SERVICE` → `SupplierType.PROVIDER`, taxable if provider GST-registered

The invoice display components use separate line items: "Platform commission (12%)" for the commission and "Processing fees: $0.00" for Stripe processing charges. The DriveBook platform fee is not displayed in these instructor-facing invoices because it is charged to the customer, not deducted from the instructor's earnings. These are genuinely separate accounting fields, not hardcoded placeholders.

### Internal documentation corrected

- `docs/DOCROLEBASE/03-instructor/BOOKINGS.md`: "Platform processing fee" → "DriveBook platform fee"
- `docs/INDEX.md`: "Platform Fee" → "DriveBook Platform Fee" with "(charged to customer, admin-configurable)" qualifier

---

## v3 Corrections (in addition to v1 white-label wording and v2 multi-professional removal)

### Fee description corrected

**Issue:** "platform processing fee" implies it's Stripe's charge. The 3.6% is DriveBook platform fee revenue, charged to the customer in addition to the service price.

**Corrections applied:**
- `app/pricing/page.tsx`: "platform processing fee" → "DriveBook platform fee" on all three cards
- `app/lessons/page.tsx`: "Platform fee: 3.6%..." → "DriveBook platform fee: 3.6% applied at checkout, charged to the customer in addition to the service price..."
- `app/client-dashboard/help/page.tsx`: "platform processing fee (3.6%)" → "DriveBook platform fee (currently 3.6%)" (two instances)
- `app/help/instructors/page.tsx`: "Platform takes 3.6% fee" → "Platform takes DriveBook platform fee (currently 3.6%)"

### Hardcoded 3.6% replaced with dynamic value

**Issue:** `app/pricing/page.tsx` hardcoded "3.6%" but the actual fee is admin-configurable via `PlatformSettings.platformFeePercentage` (default 3.6%).

**Correction applied:**
- `app/pricing/page.tsx` converted to async server component
- Imports `getPlatformFeeRate` from `lib/services/platform-pricing.ts`
- Fetches the actual platform fee percentage from `PlatformSettings` (DB) or falls back to 3.6% if DB unavailable
- All three pricing cards now display `{platformFeePct}%` instead of hardcoded "3.6%"

### Audit references updated

- `WLA-018-AUDIT.md`: source inspected changed to `a24a26ee`
- Tracker WLA-018 row: fix commit updated to `a24a26ee`, version 6.32

### Public surfaces inspected for fee terminology

| File | Old wording | New wording | Status |
|---|---|---|---|
| `app/pricing/page.tsx` (3 cards) | "3.6% / platform processing fee" | Dynamic `{platformFeePct}% / DriveBook platform fee` | ✅ FIXED |
| `app/lessons/page.tsx` | "Platform fee: 3.6% applied at checkout. This covers secure payment processing..." | "DriveBook platform fee: 3.6% applied at checkout, charged to the customer in addition to the service price..." | ✅ FIXED |
| `app/client-dashboard/help/page.tsx` (2 instances) | "platform processing fee (3.6%)" / "A 3.6% fee..." | "DriveBook platform fee (currently 3.6%)" | ✅ FIXED |
| `app/help/instructors/page.tsx` | "Platform takes 3.6% fee" | "Platform takes DriveBook platform fee (currently 3.6%)" | ✅ FIXED |
| `app/instructor-terms/page.tsx` | "platform processing fee (currently 3.6%)" | No change — already correct wording with "currently" qualifier | ✅ Already correct |

---

## v2 Corrections (in addition to v1 white-label wording)

### STUDIO multi-professional claim

**Marketing location:** `app/pricing/page.tsx` STUDIO card — "👥 Multi-Professional" and "Team management"

**Actual entitlement:** `getAccountFeatures().multiInstructor = false` for all tiers. `subscriptions.ts` STUDIO `limits.providers: 1`. Multi-provider is not implemented.

**Correction applied:** Removed both items from the STUDIO pricing card. Replaced with the remaining accurate features (Custom Domain, Branded marketplace experience).

### Features page multi-professional claim

**Marketing location:** `app/features/calendar/page.tsx` — "Multi-Professional Support" heading with "Manage multiple team calendars from one dashboard."

**Actual entitlement:** Multi-provider not implemented.

**Correction applied:** Changed to "Business Profiles" with "Operate under your own business identity with custom branding. Multi-provider team management is coming soon for business accounts."

### Pricing percentage label

**Marketing location:** `app/pricing/page.tsx` — all three tiers show "3.6% per booking"

**Actual meaning:** 3.6% is the platform processing fee (covers Stripe payment processing), not the commission rate. Commission rates (15%/12%/11%/10%) are separate and shown in the subscription config features list. The pricing page does not show commission rates.

**Correction applied:** Changed "per booking" to "platform processing fee" on all three pricing cards.

### Instructor terms page

**Location:** `app/instructor-terms/page.tsx` line 142 — uses future tense: "DriveBook may introduce additional business management features in future releases, including multiple providers..."

**Assessment:** Correctly qualified as future. No change needed.

---

## Claims Found and Corrections Applied

### 1. STUDIO tier — "White-label experience"

**Marketing locations:**
- `lib/config/subscriptions.ts` STUDIO.features: `'White-label experience'`
- `app/pricing/page.tsx` STUDIO card: `<span>White-label experience</span>`

**Actual entitlement:** `getAccountFeatures.whiteLabel = false` for STUDIO. Only PREMIUM gets `whiteLabel = true`. STUDIO gets `customDomain = true` and `brandedPages = true` — branded booking page on a custom domain, but DriveBook remains the marketplace operator.

**Correction applied:**
- `subscriptions.ts`: `'White-label experience'` → `'Branded marketplace experience'`
- `pricing/page.tsx`: `<span>White-label experience</span>` → `<span>Branded marketplace experience</span>`

### 2. PREMIUM tier — "Full white-label experience"

**Marketing locations:**
- `lib/config/subscriptions.ts` PREMIUM.features: `'Full white-label experience'`
- `components/SubscriptionPlans.tsx`:
  - Line 398: `badge: 'WHITE LABEL'` for PREMIUM
  - Line 499: `'Full white-label, direct payments'` subtitle
  - Line 631: `'White label'` heading
  - Line 633: `'Premium: 0% commission, direct payments'` subtext

**Actual entitlement:** `getAccountFeatures.whiteLabel = true` for PREMIUM, but this is marketplace branding (business name in customer-facing surfaces, branded email sender), not SaaS white-label. `directPayments = false` (not implemented). `multiInstructor = false` (not implemented).

**Corrections applied:**
- `subscriptions.ts`: `'Full white-label experience'` → `'Enhanced marketplace branding'`
- `SubscriptionPlans.tsx`: `badge: 'WHITE LABEL'` → `badge: 'BRANDED'`
- `SubscriptionPlans.tsx`: `'Full white-label, direct payments'` → `'Enhanced marketplace branding'`
- `SubscriptionPlans.tsx`: `'White label'` heading → `'Branded'`
- `SubscriptionPlans.tsx`: `'Premium: 0% commission, direct payments'` → `'Premium: enhanced marketplace branding'`

### 3. Dashboard branding page — "White-labels your booking page"

**Location:** `app/dashboard/branding/page.tsx` line 546

**Actual:** This toggle controls `showBrandingOnBookingPage` which shows the provider's logo and colors on the booking page. Available at PRO+ tier. Not white-label.

**Correction applied:** `'White-labels your booking page with your brand'` → `'Brands your booking page with your logo and colors'`

### 4. PermissionGate — "White-label branding" / "Full white-label requires a Premium plan"

**Location:** `components/instructor/PermissionGate.tsx` lines 100-101

**Actual:** This gate checks `getAccountFeatures.whiteLabel` which is marketplace branding.

**Correction applied:** `'White-label branding'` → `'Branded marketplace experience'`; `'Full white-label requires a Premium plan'` → `'Enhanced marketplace branding requires a Premium plan'`

### 5. account.ts comments

**Location:** `lib/utils/account.ts` — `whiteLabel` interface comment and implementation comment

**Correction applied:** Comments updated to describe "Marketplace branding" and reference WLA-016 product contract. The boolean name `whiteLabel` is retained for code stability; comments clarify the distinction.

### 6. "Coming Soon" features (retained, no change)

- `subscriptions.ts` PREMIUM: `'Option for direct payments (0% commission)'` — marked "— Coming Soon —"
- `subscriptions.ts` PREMIUM: `'Multi-provider management (BUSINESS tier)'` — marked "— Coming Soon —"
- `SubscriptionPlans.tsx`: BUSINESS tier card has `badge: 'COMING SOON'`

These are correctly marked as coming soon. `directPayments = false` and `multiInstructor = false` in code. No customer can currently use these features.

---

## Summary of Changes

| File | Old text | New text | Rationale |
|---|---|---|---|
| `lib/config/subscriptions.ts` STUDIO | `'White-label experience'` | `'Branded marketplace experience'` | STUDIO does not get whiteLabel entitlement |
| `lib/config/subscriptions.ts` PREMIUM | `'Full white-label experience'` | `'Enhanced marketplace branding'` | PREMIUM is marketplace branding, not SaaS white-label |
| `app/pricing/page.tsx` | `White-label experience` | `Branded marketplace experience` | Match subscription config |
| `components/SubscriptionPlans.tsx` badge | `WHITE LABEL` | `BRANDED` | Not full white-label |
| `components/SubscriptionPlans.tsx` subtitle | `Full white-label, direct payments` | `Enhanced marketplace branding` | Direct payments not implemented |
| `components/SubscriptionPlans.tsx` heading | `White label` | `Branded` | Marketplace branding, not SaaS |
| `components/SubscriptionPlans.tsx` subtext | `Premium: 0% commission, direct payments` | `Premium: enhanced marketplace branding` | Direct payments not implemented |
| `app/dashboard/branding/page.tsx` | `White-labels your booking page` | `Brands your booking page with your logo and colors` | Available at PRO+, not white-label |
| `components/instructor/PermissionGate.tsx` | `White-label branding` / `Full white-label requires...` | `Branded marketplace experience` / `Enhanced marketplace branding requires...` | Marketplace branding, not SaaS white-label |
| `lib/utils/account.ts` comment | `Full white-label — no DriveBook branding on any customer-facing surface` | `Marketplace branding — provider's business name appears on customer-facing surfaces. DriveBook remains marketplace operator.` | Accurate description of actual entitlement |

---

## Remaining Limitations

1. **Boolean name `whiteLabel` retained** — changing it would require updating all call sites. Comments clarify it means marketplace branding, not SaaS white-label.
2. **"Coming Soon" features** — direct payments and multi-provider are correctly marked but may still create an impression of imminent availability. The "Coming Soon" marker is the standard approach for roadmap features.
3. **SaaS white-label not advertised** — no public page claims SaaS full white-label is currently available. The corrected wording reserves "white-label" for the future SaaS product.
4. **Tests not added** — this is a marketing copy correction, not a code logic change. Source-presence checks would verify the corrected strings exist, but that adds limited value beyond the diff itself.
