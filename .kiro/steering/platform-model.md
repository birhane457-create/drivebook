---
inclusion: always
---

# DriveBook Platform Mental Model — Read Before Any Change

This file is the source of truth for the core platform concepts. Before making any change to the codebase, verify your understanding against this document. Many bugs come from confusing the four independent dimensions below.

---

## Doc-Sync Rule — Non-Negotiable

**Every code change must be followed by a doc update in the same session.**

The DOCROLEBASE docs (`docs/DOCROLEBASE/`) describe the current state of the system — not history, not plans, not session logs. They must always reflect what the code actually does right now.

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
- State what IS, not what changed. "The bulk API returns a `voice` object with 9 fields" — not "we added voice fields today"
- Do not add a session date or "as of" qualifier. The doc is always current
- Do not create new markdown files unless asked — update the existing DOCROLEBASE file
- Verify the doc claim against the code before writing — no assumptions

**The test:** If someone reads the doc without any context, does it accurately describe what the code does today? If no, the doc is wrong.


---

## Audit Workflow � Standard Process

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
- Fix HIGH ? MEDIUM issues in order
- Update relevant DOCROLEBASE docs as you fix (same session)
- Mark issues as ? FIXED in the findings doc as you complete them

### 4. Archive After Completion
- Once all HIGH/MEDIUM fixed, move audit findings to `docs/DOCROLEBASE/{area}/archive/`
- Remove completed items from `TODO.md`
- Keep only LOW-priority future work in `TODO.md` with clear cross-refs

### 5. Update Living Docs
- Merge any new insights from audit into existing DOCROLEBASE docs
- Remove temporary findings/tracking files
- The audit doc becomes historical reference only

**Example Flow (Payment Audit)**:
1. Audit ? `06-payments/AUDIT_FINDINGS_2026_09_01.md` (20 issues found)
2. Plan ? 3 HIGH, 11 MEDIUM (implement), 8 LOW (? TODO.md)
3. Fix ? Update `WALLET.md`, `COMMISSIONS.md`, `PAYOUTS.md` as fixed
4. Archive ? Move findings to `06-payments/archive/`
5. Clean ? Remove from TODO.md, keep only LOW items

**Why This Works**:
- ? Clear separation: findings (temporary) vs living docs (permanent)
- ? NO noise on PR: audit docs archived after fixes merged
- ? Context preserved: historical audits available if needed
- ? TODO stays clean: only actionable future work, not completed items

---

## The Four Dimensions (Never Mix Them)

### 1. Subscription Tier — `Provider.subscriptionTier` (String)
What the provider PAYS for. Controls feature access and commission rate.

| Value | Price | Commission | Trial | Features |
|-------|-------|-----------|-------|---------|
| `BASIC` | $29/mo | 15% | 14 days | Bookings, calendar, email notifications |
| `PRO` | $79/mo | 12% | 14 days | + SMS, AI receptionist, custom slug, branding |
| `STUDIO` | $129/mo | 11% | 14 days | + Custom domain, branded booking page |
| `PREMIUM` | $199/mo | 10% | 30 days | + Business name white-label, direct payments (phase 2) |
| `BUSINESS` | TBD | TBD | TBD | **Coming Soon** — multi-provider, not yet implemented |

**Rules:**
- Check tier via `getAccountFeatures(provider)` in `lib/utils/account.ts` — never hard-code tier strings in product logic
- `PREMIUM` is a solo-provider tier. It is NOT multi-provider
- `BUSINESS` does NOT exist in `SUBSCRIPTION_PLANS` — it has no Stripe price IDs, no backend routes, shown as "Coming Soon" in UI only
- DB field name for PREMIUM commission is `businessCommissionRate` (legacy naming) — there is no `premiumCommissionRate`
- Tier values stored in DB: `BASIC`, `PRO`, `STUDIO`, `PREMIUM`

---

### 2. Account Type — `Provider.accountType` (String)
What KIND of account structure the provider has. Independent of tier.

| Value | Meaning |
|-------|---------|
| `INDIVIDUAL` | Single provider (default for everyone — instructors, tradies) |
| `BUSINESS` | Multi-provider organisation (future — not yet active) |

**Rules:**
- `accountType` values are always `INDIVIDUAL` or `BUSINESS` — never `PREMIUM`
- `accountType === 'BUSINESS'` is the check for multi-provider identity features
- Do NOT confuse `accountType: 'BUSINESS'` with the subscription `tier: 'BUSINESS'`
- In `lib/utils/account.ts`: `AccountType = 'INDIVIDUAL' | 'BUSINESS'`
- In `lib/branding/getDisplayIdentity.ts`: `isBusiness` checks `accountType === 'BUSINESS'` OR `subscriptionTier === 'PREMIUM'`

---

### 3. Payment Model — `Provider.paymentMode` (String)
How money flows. Independent of tier and account type.

| Value | Flow | Status |
|-------|------|--------|
| `PLATFORM` | Client → DriveBook Stripe → Provider payout | Live (all accounts) |
| `DIRECT` | Client → Provider's own Stripe account (via Connect) | **Phase 2 — NOT implemented** |

**Rules:**
- Default is `PLATFORM` for every account
- `DIRECT` mode throws a runtime error via `assertPlatformPaymentMode()` in `lib/utils/account.ts`
- Do NOT set `paymentMode = 'DIRECT'` on any account — it will break checkout
- The 0% commission promise on PREMIUM requires `DIRECT` mode — this is why it's "phase 2"

---

### 4. Business Model — `Provider.businessModel` (String)
The commercial relationship model.

| Value | Meaning |
|-------|---------|
| `MARKETPLACE` | DriveBook owns the discovery + payment flow (driving school instructors) |
| `SAAS` | Provider brings own clients, DriveBook is just the platform (tradies, independent businesses) |

**Rules:**
- `businessModel` controls whether commission applies and how client relationships are tracked
- Most driving instructors are `MARKETPLACE`
- Tradies starting from PREMIUM are `SAAS`
- Do not use `businessModel` to gate subscription features — use `subscriptionTier`

---

## Multi-Vertical Support

DriveBook is NOT a driving-only platform. The Provider model is generic.

```
Provider { name, businessName, subscriptionTier, accountType, paymentMode, businessModel }
  └── DrivingProviderProfile (driving-specific: vehicle, licence, insurance, PDA, voice line)
```

A plumber has a `Provider` record and NO `DrivingProviderProfile`.  
A driving instructor has both.

**Rules when writing code:**
- Never assume `isDriving` without checking `businessType` from session
- Driving-specific features (PDA, vehicle, licence docs) must be inside `isDriving` guards
- The `DashboardNav` `businessType` prop controls which nav items appear
- `isDriving = businessType === 'driving'` — check this before showing driving-specific UI
- Marketing Flyer and Business Cards nav items are driving-only (`isDriving` guard)
- Use terminology config (`BusinessTerminology`) for vertical-specific labels — never hardcode "instructor", "student", "lesson" in shared components

---

## String Literals That Look Alike But Are Not

This table exists because the blanket-replace accident on 2026-08-15 broke production by confusing these:

| String | Context | What It Is |
|--------|---------|-----------|
| `'PREMIUM'` | `subscriptionTier` comparison | Subscription tier value (DB) |
| `'BUSINESS'` | `subscriptionTier` comparison | Future tier (not in DB yet) |
| `'BUSINESS'` | `accountType` comparison | Account structure type (DB) |
| `'business'` | `DashboardNav` group key | UI nav section identifier — NOT a tier |
| `'business'` | `PricingSettingsForm` key | DB field prefix for `businessCommissionRate` — NOT a tier |
| `'business'` | `openMenu` state in `PublicNav` | Menu identifier string — NOT a tier |
| `'Business'` | Nav section label, providerGroup display | Human-readable UI label — NOT a tier |
| `'Business'` | `providerGroup` in terminology config | Display name for a group of providers — NOT a tier |
| `businessCommissionRate` | `PlatformSettings` DB field | The commission rate for the PREMIUM tier (legacy name) |

**The rule:** Before changing any string that contains the word "business", ask: is this a subscription tier value, an accountType value, a UI key/label, or a DB field name? Each is different and must not be conflated.

---

## Feature Gate Pattern — Always Use This

```typescript
// ✅ CORRECT — use the abstraction
import { getAccountFeatures } from '@/lib/utils/account'
const features = getAccountFeatures(provider)
if (features.customDomain) { ... }
if (features.whiteLabel) { ... }

// ❌ WRONG — don't check tier strings directly in product code
if (provider.subscriptionTier === 'PREMIUM' || provider.subscriptionTier === 'STUDIO') { ... }
```

Feature map (from `lib/utils/account.ts`):

| Feature | BASIC | PRO | STUDIO | PREMIUM |
|---------|-------|-----|--------|---------|
| `displayName` | ✅ | ✅ | ✅ | ✅ |
| `customSlug` | ❌ | ✅ | ✅ | ✅ |
| `multiInstructor` | ❌ | ✅ | ✅ | ✅ |
| `aiReceptionist` | ❌ | ✅ | ✅ | ✅ |
| `customDomain` | ❌ | ❌ | ✅ | ✅ |
| `whiteLabel` | ❌ | ❌ | ❌ | ✅ |
| `directPayments` | ❌ | ❌ | ❌ | ❌ (phase 2) |

---

## Display Name — Always Use getDisplayName()

```typescript
// ✅ CORRECT
import { getDisplayName } from '@/lib/utils/account'
const name = getDisplayName(provider)  // returns businessName if set, else name

// ❌ WRONG — never in customer-facing code
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

1. **Search for context first** — run `Select-String` and read every hit before replacing anything
2. **Never use blanket replace on short words** — `'business'`, `'Business'`, `'BUSINESS'` each appear in 4+ different contexts
3. **Tier values only exist in these patterns:**
   - `subscriptionTier === 'X'`
   - `['X', 'Y'].includes(tier)`
   - `tier: 'X'` inside `SUBSCRIPTION_PLANS`
   - `case 'X':` inside `getCommissionRate`
4. **Everything else with the word "business" is probably a UI/DB concept** — verify before touching

---

## What Is Implemented

### RBAC � Granular Permission System

DriveBook has a complete role-based access control system for admin operations.

**Key Files:**
- `lib/rbac/permissions.ts` � 50+ granular permissions (PERM.*)
- `lib/auth/requireRole.ts` � requirePermission(), requireAdmin(), requireSuperAdmin()
- `prisma/schema.prisma` � StaffMember model with permissions JSON array

**Pattern:**
```typescript
import { requirePermission } from '@/lib/auth/requireRole'
import { PERM } from '@/lib/rbac/permissions'

const deny = await requirePermission(session, PERM.FINANCE_PAYOUTS_PROCESS)
if (deny) return deny
```

**Do NOT:** Hard-code `role === 'ADMIN'` checks � always use requirePermission()

---

## What Is NOT Implemented (Phase 2)

Do not build anything that assumes these exist:

- `paymentMode = 'DIRECT'` — throws runtime error, breaks checkout
- `BUSINESS` subscription tier — no Stripe price IDs, no backend validation, UI only
- Multi-provider management — `providers: 1` for ALL active tiers
- 0% commission — requires DIRECT mode which is phase 2

---

## Platform Quick Facts (Always Available)

| Property | Value |
|----------|-------|
| Timezone | `Australia/Perth` (AWST, UTC+8) — all dates/times in this zone unless stated |
| Currency | AUD |
| Database | PostgreSQL via Supabase |
| GST | 10% (included in displayed prices) |
| Platform fee | 3.6% on top of commission |
| Slot hold | 10 minutes (`PENDING_PAYMENT` → auto-expires to `EXPIRED`) |
| Trial — BASIC/PRO/STUDIO | 14 days |
| Trial — PREMIUM | 30 days |
| Refund window | ≥48h = full refund / 24–48h = 50% / <24h = none |
| Payout frequency | Weekly (Tuesdays, 48h settlement) |
| Max idempotency key length | 255 chars |
| Wallet top-up min/max | $10 / $500 (configurable in PlatformSettings) |
| ABN withholding (no ABN) | 47% withheld, remitted to ATO |

---

## Doc Structure

The canonical docs live at `docs/DOCROLEBASE/`. Navigate by folder:

```
00-overview/    ← system overview, glossary, flows, state machines
01-public/      ← public booking, subdomain, SEO
02-student/     ← student dashboard
03-instructor/  ← instructor dashboard
04-business/    ← multi-provider (Coming Soon — BUSINESS tier)
05-admin/       ← admin panel
06-payments/    ← wallet, commissions, payouts, receipts
07-subscriptions/ ← tiers, billing, trial
08-technical/   ← webhooks, codebase map, API reference
```

Planning notes (not living docs): `docs/newplan/`
Agent steering: `.kiro/steering/`

---

## Key Files

| Concern | File |
|---------|------|
| Feature flags | `lib/utils/account.ts` → `getAccountFeatures()` |
| Display name | `lib/utils/account.ts` → `getDisplayName()` |
| Payment mode guard | `lib/utils/account.ts` → `assertPlatformPaymentMode()` |
| Subscription plans | `lib/config/subscriptions.ts` → `SUBSCRIPTION_PLANS` |
| Commission rates | `lib/services/platform-pricing.ts` → `getCommissionRate()` |
| Multi-vertical types | `lib/core/types.ts` |
| Provider schema | `prisma/schema.prisma` → `model Provider` |
| Driving extension | `prisma/schema.prisma` → `model DrivingProviderProfile` |
| Nav groups | `components/DashboardNav.tsx` → `getNavGroups()` |
| Public nav menus | `components/PublicNav.tsx` → `openMenu` state |


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
- `/` — Home/landing page
- `/login` — Login page
- `/register` — Registration
- `/forgot-password` — Password reset request
- `/reset-password` — Password reset form
- `/set-password` — First-time password setup
- `/auth/**` — All auth flows
- `/about`, `/contact`, `/pricing` — Marketing pages
- `/features/**` — Feature pages
- `/blog/**` — Blog posts
- `/learn-to-drive`, `/for-instructors` — Public content
- `/instructors/**` — Browse instructors
- `/driving-lessons/**` — SEO location pages
- `/book`, `/subdomain/[slug]` — Public booking pages

#### Authenticated Pages (Theme-Aware)
Use: `className="min-h-screen bg-background text-foreground"`

**Rationale:**
- Respect user preference (some users prefer dark mode for extended sessions)
- Reduce eye strain for dashboard work
- Modern app experience
- Accessibility (users can choose what works for them)

**Pages:**
- `/dashboard/**` — Provider dashboard
- `/client-dashboard/**` — Client dashboard
- `/admin/**` — Admin panel
- `/onboarding` — Post-registration setup

#### Hybrid Pages (Context-Dependent)
Some pages are public but lead to authenticated flows:
- `/manage-booking` — Light mode (public link, unauthenticated access)
- `/payment/**` — Light mode (payment pages should be reassuring, bright)
- `/booking/**` — Light mode (public booking confirmation)

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

### ❌ Wrong (breaks public pages):
```tsx
// Auth page — should be light, not theme-aware
<div className="min-h-screen bg-background">
```

### ✅ Correct:
```tsx
// Public auth page — always light
<div className="light min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
  <form>...</form>
</div>

// Authenticated dashboard — theme-aware
<div className="min-h-screen bg-background text-foreground">
  <DashboardNav />
  <main>...</main>
</div>
```

---

**Last Updated:** August 15, 2026  
**Status:** Theming strategy standardized across all pages


### Light Mode Form Styling (Public Pages)

**❌ Wrong (poor contrast):**
```tsx
className="bg-secondary border border-white/20 text-foreground placeholder-white/50"
// Issues: white placeholder on light bg, theme-aware colors on forced light page
```

**✅ Correct (high contrast):**
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
- ❌ `text-foreground/60` (theme-aware, can be invisible)
- ❌ `placeholder-white/30` (invisible on light)
- ❌ `bg-secondary` on pages with `className="light"`
- ❌ `text-purple-300` (too light, low contrast)



---

## State Machine References

Quick links to state flow diagrams in DOCROLEBASE - Booking: PENDING_PAYMENT to CONFIRMED to COMPLETED or CANCELLED - Payout: PENDING to MANUAL_REQUIRED or PROCESSING to PAID or FAILED - Package Cancellation: CANCELLATION_PENDING to APPROVED or REJECTED - WalletTransaction: PENDING to CONFIRMED or FAILED or REFUNDED - Subscription: TRIALING to ACTIVE to PAST_DUE to CANCELED

Critical transitions: Booking expires after 10 minutes. Payout requires Stripe Connect. Package Cancel requires admin approval. Wallet PENDING becomes CONFIRMED after Stripe webhook.

---

## Data Consistency Rules

**Transaction Retry Pattern (P2034):**

PostgreSQL SERIALIZABLE transactions abort on conflict (Prisma error P2034). Use `withSerializableRetry()` from `lib/utils/transaction-retry.ts`:

```typescript
import { withSerializableRetry } from '@/lib/utils/transaction-retry'

const result = await withSerializableRetry(
  () => prisma.$transaction(async (tx) => {
    // your transaction logic
  }, { isolationLevel: 'Serializable' }),
  { operationName: 'create-booking' }
)
```

**Rules:**
- Retries P2034 conflicts with exponential backoff (50ms base, 400ms cap, max 2 retries)
- Does NOT retry business errors: SLOT_TAKEN, INSUFFICIENT_BALANCE, WALLET_INSUFFICIENT
- Re-executes entire callback from top on retry — business logic must be idempotent

**Do NOT:** Retry business validation failures — they indicate correct snapshot behavior

---

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