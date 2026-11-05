# WLA-018 — Public Branding Claims Audit

**Audit date:** 2026-11-05  
**Source inspected:** 2d581584 (WLA-018 v1 fix commit)  
**Status:** FIX APPLIED (v2) — white-label wording corrected; multi-professional and pricing labels corrected; pending review

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
