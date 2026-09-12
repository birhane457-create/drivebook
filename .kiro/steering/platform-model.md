---
inclusion: always
---

# DriveBook Platform Mental Model â€” Read Before Any Change

This file is the source of truth for the core platform concepts. Before making any change to the codebase, verify your understanding against this document. Many bugs come from confusing the four independent dimensions below.

---

## Doc-Sync Rule â€” Non-Negotiable

**Every code change must be followed by a doc update in the same session.**

The DOCROLEBASE docs (`docs/DOCROLEBASE/`) describe the current state of the system â€” not history, not plans, not session logs. They must always reflect what the code actually does right now.

**What triggers a doc update:**

| Change type | Docs to update |
|-------------|---------------|
| New API endpoint or changed response shape | The relevant DOCROLEBASE doc for that area |
| Tier feature change | `07-subscriptions/TIERS.md`, `03-instructor/SUBSCRIPTION_TIERS.md` |
| New field on Provider/Customer/Booking | `08-technical/CODEBASE_MAP.md`, `00-overview/GLOSSARY.md` |
| Commission rate logic change | `06-payments/COMMISSIONS.md`, `06-payments/PLATFORM_RATE_CHANGES.md` |
| Webhook event added/changed | `08-technical/WEBHOOKS.md` |
| New feature gate or flag | `platform-model.md` (this file) |
| White-label surface added | `01-public/SUBDOMAIN_PAGE.md`, `03-instructor/BRANDING.md` |
| Payment flow change | `06-payments/WALLET.md`, `01-public/BOOKING_FLOW_COMPLETE.md` |
| New model or schema change | `08-technical/CODEBASE_MAP.md`, `00-overview/GLOSSARY.md` |
| Nav or routing change | `docs/NAVIGATION_ARCHITECTURE.md` |

**How to write the update:**
- State what IS, not what changed. "The bulk API returns a `voice` object with 9 fields" â€” not "we added voice fields today"
- Do not add a session date or "as of" qualifier. The doc is always current
- Do not create new markdown files unless asked â€” update the existing DOCROLEBASE file
- Verify the doc claim against the code before writing â€” no assumptions

**The test:** If someone reads the doc without any context, does it accurately describe what the code does today? If no, the doc is wrong.


---

## Audit Workflow — Standard Process

When conducting code audits or investigations:

### 1. Create Findings Document
- **Location**: `docs/DOCROLEBASE/{area}/AUDIT_FINDINGS_{YYYY_MM_DD}.md`
- **Content**: Document ALL issues found before implementing any fixes
- **Priority**: Label each issue as HIGH / MEDIUM / LOW
- **Cross-ref**: Link to relevant DOCROLEBASE docs

### 2. Create Implementation Plan
- **HIGH priority**: Implement immediately (security, financial integrity, data loss risks)
- **MEDIUM priority**: Implement in same session (bugs, UX issues, missing validation)
- **LOW priority**: Add to `docs/TODO.md` with cross-reference to audit findings

### 3. Implementation
- Fix HIGH → MEDIUM issues in order
- Update relevant DOCROLEBASE docs as you fix (same session)
- Mark issues as ✅ FIXED in the findings doc as you complete them

### 4. Archive After Completion
- Once all HIGH/MEDIUM fixed, move audit findings to `docs/DOCROLEBASE/{area}/archive/`
- Remove completed items from `TODO.md`
- Keep only LOW-priority future work in `TODO.md` with clear cross-refs

### 5. Update Living Docs
- Merge any new insights from audit into existing DOCROLEBASE docs
- Remove temporary findings/tracking files
- The audit doc becomes historical reference only

**Example Flow (Payment Audit)**:
1. Audit → `06-payments/AUDIT_FINDINGS_2026_09_01.md` (20 issues found)
2. Plan → 3 HIGH, 11 MEDIUM (implement), 8 LOW (→ TODO.md)
3. Fix → Update `WALLET.md`, `COMMISSIONS.md`, `PAYOUTS.md` as fixed
4. Archive → Move findings to `06-payments/archive/`
5. Clean → Remove from TODO.md, keep only LOW items

**Why This Works**:
- ✅ Clear separation: findings (temporary) vs living docs (permanent)
- ✅ NO noise on PR: audit docs archived after fixes merged
- ✅ Context preserved: historical audits available if needed
- ✅ TODO stays clean: only actionable future work, not completed items

---

## The Four Dimensions (Never Mix Them)

### 1. Subscription Tier â€” `Provider.subscriptionTier` (String)
What the provider PAYS for. Controls feature access and commission rate.

| Value | Price | Commission | Trial | Features |
|-------|-------|-----------|-------|---------|
| `BASIC` | $29/mo | 15% | 14 days | Bookings, calendar, email notifications |
| `PRO` | $79/mo | 12% | 14 days | + SMS, AI receptionist, custom slug, branding |
| `STUDIO` | $129/mo | 11% | 14 days | + Custom domain, branded booking page |
| `PREMIUM` | $199/mo | 10% | 30 days | + Business name white-label, direct payments (phase 2) |
| `BUSINESS` | TBD | TBD | TBD | **Coming Soon** â€” multi-provider, not yet implemented |

**Rules:**
- Check tier via `getAccountFeatures(provider)` in `lib/utils/account.ts` â€” never hard-code tier strings in product logic
- `PREMIUM` is a solo-provider tier. It is NOT multi-provider
- `BUSINESS` does NOT exist in `SUBSCRIPTION_PLANS` â€” it has no Stripe price IDs, no backend routes, shown as "Coming Soon" in UI only
- DB field name for PREMIUM commission is `businessCommissionRate` (legacy naming) â€” there is no `premiumCommissionRate`
- Tier values stored in DB: `BASIC`, `PRO`, `STUDIO`, `PREMIUM`

---

### 2. Account Type â€” `Provider.accountType` (String)
What KIND of account structure the provider has. Independent of tier.

| Value | Meaning |
|-------|---------|
| `INDIVIDUAL` | Single provider (default for everyone â€” instructors, tradies) |
| `BUSINESS` | Multi-provider organisation (future â€” not yet active) |

**Rules:**
- `accountType` values are always `INDIVIDUAL` or `BUSINESS` â€” never `PREMIUM`
- `accountType === 'BUSINESS'` is the check for multi-provider identity features
- Do NOT confuse `accountType: 'BUSINESS'` with the subscription `tier: 'BUSINESS'`
- In `lib/utils/account.ts`: `AccountType = 'INDIVIDUAL' | 'BUSINESS'`
- In `lib/branding/getDisplayIdentity.ts`: `isBusiness` checks `accountType === 'BUSINESS'` OR `subscriptionTier === 'PREMIUM'`

---

### 3. Payment Model â€” `Provider.paymentMode` (String)
How money flows. Independent of tier and account type.

| Value | Flow | Status |
|-------|------|--------|
| `PLATFORM` | Client â†’ DriveBook Stripe â†’ Provider payout | Live (all accounts) |
| `DIRECT` | Client â†’ Provider's own Stripe account (via Connect) | **Phase 2 â€” NOT implemented** |

**Rules:**
- Default is `PLATFORM` for every account
- `DIRECT` mode throws a runtime error via `assertPlatformPaymentMode()` in `lib/utils/account.ts`
- Do NOT set `paymentMode = 'DIRECT'` on any account â€” it will break checkout
- The 0% commission promise on PREMIUM requires `DIRECT` mode â€” this is why it's "phase 2"

---

### 4. Business Model â€” `Provider.businessModel` (String)
The commercial relationship model.

| Value | Meaning |
|-------|---------|
| `MARKETPLACE` | DriveBook owns the discovery + payment flow (driving school instructors) |
| `SAAS` | Provider brings own clients, DriveBook is just the platform (tradies, independent businesses) |

**Rules:**
- `businessModel` controls whether commission applies and how client relationships are tracked
- Most driving instructors are `MARKETPLACE`
- Tradies starting from PREMIUM are `SAAS`
- Do not use `businessModel` to gate subscription features â€” use `subscriptionTier`

---

## Multi-Vertical Support

DriveBook is NOT a driving-only platform. The Provider model is generic.

```
Provider { name, businessName, subscriptionTier, accountType, paymentMode, businessModel }
  â””â”€â”€ DrivingProviderProfile (driving-specific: vehicle, licence, insurance, PDA, voice line)
```

A plumber has a `Provider` record and NO `DrivingProviderProfile`.  
A driving instructor has both.

**Rules when writing code:**
- Never assume `isDriving` without checking `businessType` from session
- Driving-specific features (PDA, vehicle, licence docs) must be inside `isDriving` guards
- The `DashboardNav` `businessType` prop controls which nav items appear
- `isDriving = businessType === 'driving'` â€” check this before showing driving-specific UI
- Marketing Flyer and Business Cards nav items are driving-only (`isDriving` guard)
- Use terminology config (`BusinessTerminology`) for vertical-specific labels â€” never hardcode "instructor", "student", "lesson" in shared components

---

## String Literals That Look Alike But Are Not

This table exists because the blanket-replace accident on 2026-08-15 broke production by confusing these:

| String | Context | What It Is |
|--------|---------|-----------|
| `'PREMIUM'` | `subscriptionTier` comparison | Subscription tier value (DB) |
| `'BUSINESS'` | `subscriptionTier` comparison | Future tier (not in DB yet) |
| `'BUSINESS'` | `accountType` comparison | Account structure type (DB) |
| `'business'` | `DashboardNav` group key | UI nav section identifier â€” NOT a tier |
| `'business'` | `PricingSettingsForm` key | DB field prefix for `businessCommissionRate` â€” NOT a tier |
| `'business'` | `openMenu` state in `PublicNav` | Menu identifier string â€” NOT a tier |
| `'Business'` | Nav section label, providerGroup display | Human-readable UI label â€” NOT a tier |
| `'Business'` | `providerGroup` in terminology config | Display name for a group of providers â€” NOT a tier |
| `businessCommissionRate` | `PlatformSettings` DB field | The commission rate for the PREMIUM tier (legacy name) |

**The rule:** Before changing any string that contains the word "business", ask: is this a subscription tier value, an accountType value, a UI key/label, or a DB field name? Each is different and must not be conflated.

---

## Feature Gate Pattern â€” Always Use This

```typescript
// âœ… CORRECT â€” use the abstraction
import { getAccountFeatures } from '@/lib/utils/account'
const features = getAccountFeatures(provider)
if (features.customDomain) { ... }
if (features.whiteLabel) { ... }

// âŒ WRONG â€” don't check tier strings directly in product code
if (provider.subscriptionTier === 'PREMIUM' || provider.subscriptionTier === 'STUDIO') { ... }
```

Feature map (from `lib/utils/account.ts`):

| Feature | BASIC | PRO | STUDIO | PREMIUM |
|---------|-------|-----|--------|---------|
| `displayName` | âœ… | âœ… | âœ… | âœ… |
| `customSlug` | âŒ | âœ… | âœ… | âœ… |
| `multiInstructor` | âŒ | âœ… | âœ… | âœ… |
| `aiReceptionist` | âŒ | âœ… | âœ… | âœ… |
| `customDomain` | âŒ | âŒ | âœ… | âœ… |
| `whiteLabel` | âŒ | âŒ | âŒ | âœ… |
| `directPayments` | âŒ | âŒ | âŒ | âŒ (phase 2) |

---

## Display Name â€” Always Use getDisplayName()

```typescript
// âœ… CORRECT
import { getDisplayName } from '@/lib/utils/account'
const name = getDisplayName(provider)  // returns businessName if set, else name

// âŒ WRONG â€” never in customer-facing code
const name = provider.name
const name = instructor.name
```

`getDisplayName()` is wired in:
- `app/book/[instructorId]/page.tsx`
- `app/subdomain/[slug]/page.tsx`
- `app/api/public/bookings/bulk/route.ts`
- `lib/services/email.ts`
- `lib/services/sms.ts`
- `lib/services/notifications.ts`
- `lib/services/receipt-email.ts`
- All public-facing APIs

---

## Safe Find-Replace Rules

Before doing any codebase-wide string replacement:

1. **Search for context first** â€” run `Select-String` and read every hit before replacing anything
2. **Never use blanket replace on short words** â€” `'business'`, `'Business'`, `'BUSINESS'` each appear in 4+ different contexts
3. **Tier values only exist in these patterns:**
   - `subscriptionTier === 'X'`
   - `['X', 'Y'].includes(tier)`
   - `tier: 'X'` inside `SUBSCRIPTION_PLANS`
   - `case 'X':` inside `getCommissionRate`
4. **Everything else with the word "business" is probably a UI/DB concept** â€” verify before touching

---

## What Is NOT Implemented (Phase 2)

Do not build anything that assumes these exist:

- `paymentMode = 'DIRECT'` â€” throws runtime error, breaks checkout
- `BUSINESS` subscription tier â€” no Stripe price IDs, no backend validation, UI only
- Multi-provider management â€” `providers: 1` for ALL active tiers
- Role-based access (admin/manager/provider) â€” not built
- 0% commission â€” requires DIRECT mode which is phase 2

---

## Platform Quick Facts (Always Available)

| Property | Value |
|----------|-------|
| Timezone | `Australia/Perth` (AWST, UTC+8) â€” all dates/times in this zone unless stated |
| Currency | AUD |
| Database | PostgreSQL via Supabase |
| GST | 10% (included in displayed prices) |
| Platform fee | 3.6% on top of commission |
| Slot hold | 10 minutes (`PENDING_PAYMENT` â†’ auto-expires to `EXPIRED`) |
| Trial â€” BASIC/PRO/STUDIO | 14 days |
| Trial â€” PREMIUM | 30 days |
| Refund window | â‰¥48h = full refund / 24â€“48h = 50% / <24h = none |
| Payout frequency | Weekly (Tuesdays, 48h settlement) |
| Max idempotency key length | 255 chars |
| Wallet top-up min/max | $10 / $500 (configurable in PlatformSettings) |
| ABN withholding (no ABN) | 47% withheld, remitted to ATO |

---

## Doc Structure

The canonical docs live at `docs/DOCROLEBASE/`. Navigate by folder:

```
00-overview/    â† system overview, glossary, flows, state machines
01-public/      â† public booking, subdomain, SEO
02-student/     â† student dashboard
03-instructor/  â† instructor dashboard
04-business/    â† multi-provider (Coming Soon â€” BUSINESS tier)
05-admin/       â† admin panel
06-payments/    â† wallet, commissions, payouts, receipts
07-subscriptions/ â† tiers, billing, trial
08-technical/   â† webhooks, codebase map, API reference
```

Planning notes (not living docs): `docs/newplan/`
Agent steering: `.kiro/steering/`

---

## Key Files

| Concern | File |
|---------|------|
| Feature flags | `lib/utils/account.ts` â†’ `getAccountFeatures()` |
| Display name | `lib/utils/account.ts` â†’ `getDisplayName()` |
| Payment mode guard | `lib/utils/account.ts` â†’ `assertPlatformPaymentMode()` |
| Subscription plans | `lib/config/subscriptions.ts` â†’ `SUBSCRIPTION_PLANS` |
| Commission rates | `lib/services/platform-pricing.ts` â†’ `getCommissionRate()` |
| Multi-vertical types | `lib/core/types.ts` |
| Provider schema | `prisma/schema.prisma` â†’ `model Provider` |
| Driving extension | `prisma/schema.prisma` â†’ `model DrivingProviderProfile` |
| Nav groups | `components/DashboardNav.tsx` â†’ `getNavGroups()` |
| Public nav menus | `components/PublicNav.tsx` â†’ `openMenu` state |


---

## Theming & Visual Design Strategy

### Light vs Dark Mode by Page Type

**Rule:** Public pages use light mode. Authenticated pages respect user theme preference.

#### Public Pages (Always Light Mode)
Use: `className="light min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50"`

**Rationale:**
- Better SEO (search engines prefer light backgrounds)
- Higher conversion rates (visitors expect light marketing pages)
- Professional first impression
- Accessibility (easier to read for most users)

**Pages:**
- `/` â€” Home/landing page
- `/login` â€” Login page
- `/register` â€” Registration
- `/forgot-password` â€” Password reset request
- `/reset-password` â€” Password reset form
- `/set-password` â€” First-time password setup
- `/auth/**` â€” All auth flows
- `/about`, `/contact`, `/pricing` â€” Marketing pages
- `/features/**` â€” Feature pages
- `/blog/**` â€” Blog posts
- `/learn-to-drive`, `/for-instructors` â€” Public content
- `/instructors/**` â€” Browse instructors
- `/driving-lessons/**` â€” SEO location pages
- `/book`, `/subdomain/[slug]` â€” Public booking pages

#### Authenticated Pages (Theme-Aware)
Use: `className="min-h-screen bg-background text-foreground"`

**Rationale:**
- Respect user preference (some users prefer dark mode for extended sessions)
- Reduce eye strain for dashboard work
- Modern app experience
- Accessibility (users can choose what works for them)

**Pages:**
- `/dashboard/**` â€” Provider dashboard
- `/client-dashboard/**` â€” Client dashboard
- `/admin/**` â€” Admin panel
- `/onboarding` â€” Post-registration setup

#### Hybrid Pages (Context-Dependent)
Some pages are public but lead to authenticated flows:
- `/manage-booking` â€” Light mode (public link, unauthenticated access)
- `/payment/**` â€” Light mode (payment pages should be reassuring, bright)
- `/booking/**` â€” Light mode (public booking confirmation)

### Implementation Guidelines

1. **Never mix modes within a user flow**
   - Auth flow: all light until authenticated
   - Dashboard: all theme-aware after login

2. **Component library compatibility**
   - Tailwind CSS variables: `bg-background`, `text-foreground`, `border-border`
   - These adapt automatically when `light` class is present vs absent

3. **Testing checklist**
   - [ ] Public pages render in light mode on all devices
   - [ ] Dashboard respects browser/OS theme preference
   - [ ] Theme toggle (if implemented) works in authenticated pages only
   - [ ] No flash of wrong theme on page load (use `className="light"` on HTML element for public pages)

4. **Future: Per-user theme preference**
   - Store theme preference in user profile
   - Apply theme class dynamically in authenticated layouts
   - Respect system preference as default

### Color Palette

**Public Pages (Light Mode):**
- Background: `from-slate-50 via-white to-slate-50`
- Text: `text-gray-900`
- Accent: `purple-600`, `violet-600`, `pink-600` gradients
- Cards: `bg-white`, `border-gray-200`

**Authenticated Pages (Theme-Aware):**
- Background: `bg-background` (white in light, slate-950 in dark)
- Text: `text-foreground` (gray-900 in light, gray-50 in dark)
- Accent: Same purple/violet/pink gradients (work in both modes)
- Cards: `bg-card`, `border-border` (adapt to theme)

---

## Code Patterns

### âŒ Wrong (breaks public pages):
```tsx
// Auth page â€” should be light, not theme-aware
<div className="min-h-screen bg-background">
```

### âœ… Correct:
```tsx
// Public auth page â€” always light
<div className="light min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
  <form>...</form>
</div>

// Authenticated dashboard â€” theme-aware
<div className="min-h-screen bg-background text-foreground">
  <DashboardNav />
  <main>...</main>
</div>
```

---

**Last Updated:** August 15, 2026  
**Status:** Theming strategy standardized across all pages


### Light Mode Form Styling (Public Pages)

**âŒ Wrong (poor contrast):**
```tsx
className="bg-secondary border border-white/20 text-foreground placeholder-white/50"
// Issues: white placeholder on light bg, theme-aware colors on forced light page
```

**âœ… Correct (high contrast):**
```tsx
className="bg-white border border-gray-200 text-gray-900 placeholder-gray-400"
// Clear, readable, WCAG AA compliant
```

**Text Color Guide for Light Mode:**
- Primary text (headings, labels): `text-gray-900` or `text-gray-700`
- Secondary text (descriptions): `text-gray-600`
- Tertiary text (hints, meta): `text-gray-500`
- Placeholder text: `placeholder-gray-400`
- Links: `text-violet-600 hover:text-violet-700`

**Never use on light backgrounds:**
- âŒ `text-foreground/60` (theme-aware, can be invisible)
- âŒ `placeholder-white/30` (invisible on light)
- âŒ `bg-secondary` on pages with `className="light"`
- âŒ `text-purple-300` (too light, low contrast)



---

## State Machine References

Quick links to state flow diagrams in DOCROLEBASE - Booking: PENDING_PAYMENT to CONFIRMED to COMPLETED or CANCELLED - Payout: PENDING to MANUAL_REQUIRED or PROCESSING to PAID or FAILED - Package Cancellation: CANCELLATION_PENDING to APPROVED or REJECTED - WalletTransaction: PENDING to CONFIRMED or FAILED or REFUNDED - Subscription: TRIALING to ACTIVE to PAST_DUE to CANCELED

Critical transitions: Booking expires after 10 minutes. Payout requires Stripe Connect. Package Cancel requires admin approval. Wallet PENDING becomes CONFIRMED after Stripe webhook.

---

## Data Consistency Rules

Wallet: Balance = SUM(CREDIT) - SUM(DEBIT). Re-verify balance inside transaction. Package refunds MUST debit wallet when issuing Stripe refund. Never allow negative balance.

Booking: price = per-lesson rate, packageTotalPaid = total package cost. Use lockedHourlyRate NOT provider.hourlyRate. Store commissionRate at booking time.

Ledger: Every transaction creates WalletTransaction or FinancialLedger entry. Use idempotencyKey max 255 chars. Daily reconciliation alerts if drift over $10. Never delete financial records.

---

## API Design Patterns

Response Shape: Success {success: true, data}, Error {error: CODE, message}. Idempotency: Use unique key, check before creating. Pagination: page, limit, total, hasNext, hasPrev. Webhook: Always verify Stripe signature.

---

## Security Considerations

Wallet: Validate expectedAmount matches calculated. Re-check balance inside transaction. Verify refund <= original payment. Use idempotencyKey. Verify Stripe webhooks.

Payout: 24-hour fraud buffer. Stripe Connect required. No open disputes. Use frozen commissionRate. Manual review if over $5000.

Access: Provider isolation. Client isolation. Log admin actions. Never return sensitive fields in public APIs.

Auth: Check getServerSession on every protected route. Verify role. CSRF protection. Rate limiting on public APIs.

---

## Common Error Codes

INSUFFICIENT_WALLET_BALANCE, PAYMENT_INTENT_FAILED, AMOUNT_MISMATCH, SLOT_EXPIRED, DUPLICATE_BOOKING, NO_STRIPE_CONNECT, PAYOUT_TOO_SOON, OPEN_DISPUTE, SLOT_UNAVAILABLE, INVALID_PACKAGE, UNAUTHORIZED, FORBIDDEN, SESSION_EXPIRED, INVALID_TOKEN

---

## Testing Quick Reference

Test users in docs/TEST_USERS.md - Admin, Instructor BASIC, Instructor PREMIUM, Client. Key scenarios: Package flow, Payout flow, Package integrity, Revenue reconciliation.

---

## Emergency Procedures

Financial Discrepancy: Check archive, run reconciliation manually, compare Stripe vs ledger, check webhooks, pause if drift over $100.

Webhook Failure: Check Stripe logs, manually trigger, verify secret, check PENDING transactions, manually confirm/fail.

Payout Blocked: Check eligibility, process manual if needed, verify Stripe Connect, check disputes, mark FAILED with reason if unclear.