# White-Label — Complete Status Record

**Last updated:** 2026-08-20  
**Principle:** "Powered by DriveBook" is shown by default (free platform promotion).  
Instructors opt out surface by surface. Full white-label is an active choice, not the default.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Done — implemented and in production |
| ⚠️ | Partial — something is branded but something else still shows DriveBook |
| ❌ | Not done |
| 🔮 | Future — requires significant infrastructure (SCHOOL tier, custom SMTP, etc.) |

---

## Surface-by-Surface Status

### 1. Booking Page (`*.drivebook.com.au` / custom domain)

| Element | Status | Detail |
|---------|--------|--------|
| Nav logo | ✅ | Shows `brandLogo` when `showBrandingOnBookingPage: true`, otherwise DriveBook car icon |
| Nav name | ✅ | Shows `businessName` when branding enabled, otherwise "DriveBook" |
| Nav "Powered by DriveBook" text | ✅ | Hidden when `showBrandingOnBookingPage: true` OR `hidePoweredBy: true` |
| Hero gradient | ✅ | Always uses `brandColorPrimary` → `brandColorSecondary` (all tiers) |
| CTA buttons | ✅ | Always use `brandColorPrimary` (all tiers) |
| Instructor display name | ✅ | `getDisplayName()` used everywhere — shows `businessName` for BUSINESS/PREMIUM |
| Footer copyright | ✅ | Shows `© YEAR BusinessName` when `hasBranding` or `hidePoweredBy`; otherwise `· Powered by DriveBook` |
| Page `<title>` / SEO meta | ⚠️ | Title includes instructor name but never business name. Should use `displayName` |
| Page favicon | ❌ | Always DriveBook favicon. Needs dynamic `<link rel="icon">` per instructor |
| "How booking works" strip | ⚠️ | Static text always says "DriveBook" in no visible place currently — OK |
| Booking wizard overlay (modal) | ✅ | Uses `primary` color for all buttons and accents |

---

### 2. Account Setup Email (first email a new student ever receives)

| Element | Status | Detail |
|---------|--------|--------|
| From display name | ✅ | `formatBrandedSender()` → `"BusinessName Bookings <bookings@drivebook.com.au>"` |
| From email domain | ❌ | Always `@drivebook.com.au` — custom sending domain not supported |
| Subject line | ✅ | `"Set up your [BusinessName] account"` |
| Email header | ✅ | `"Welcome to [BusinessName]"` |
| Button color | ✅ | Uses `brandColorPrimary` |
| Footer | ✅ | Shows `[BusinessName] — Your Driving Instructor Platform` |

---

### 3. Account Setup SMS (setup link sent to student phone)

| Element | Status | Detail |
|---------|--------|--------|
| SMS prefix | ✅ | `"[BusinessName]: Set up your account..."` when white-label |
| SMS sender number | ❌ | Always DriveBook Twilio number — cannot be per-school without Twilio sub-accounts |

---

### 4. Booking Notification Email ("Reserved — complete payment")

| Element | Status | Detail |
|---------|--------|--------|
| From display name | ✅ | `formatBrandedSender()` used |
| From email domain | ❌ | Always `@drivebook.com.au` |
| Subject | ✅ | Uses `instructorName` (display-name aware) |
| Body | ✅ | Uses `getDisplayName(instructor)` |

---

### 5. Instructor-Creates-Booking-For-Student Email ("Reserved — action required")

| Element | Status | Detail |
|---------|--------|--------|
| From display name | ✅ | `formatBrandedSender()` used |
| From email domain | ❌ | Always `@drivebook.com.au` |
| Subject | ✅ | Uses `getDisplayName(instructor)` |
| Body | ✅ | Uses `getDisplayName(instructor)` |

---

### 6. Batch Booking Email

| Element | Status | Detail |
|---------|--------|--------|
| From display name | ✅ | `formatBrandedSender()` used |
| From email domain | ❌ | Always `@drivebook.com.au` |
| Instructor name in body | ✅ | Uses `getDisplayName(instructor)` |

---

### 7. Package Purchase Receipt (after card payment via webhook)

| Element | Status | Detail |
|---------|--------|--------|
| From display name | ✅ | `brandedSender` param passed from webhook |
| From email domain | ❌ | Always `@drivebook.com.au` |
| Email header | ✅ | Shows `[BusinessName] — Tax Receipt` when branded |
| Body instructor name | ✅ | Uses `getDisplayName(instructor)` |
| "Powered by DriveBook" in receipt body | ⚠️ | Footer of receipt HTML still says "DriveBook" — needs `platformName` variable |

---

### 8. Single Lesson Receipt (after card payment via webhook)

| Element | Status | Detail |
|---------|--------|--------|
| From display name | ✅ | `brandedSender` param passed from webhook |
| From email domain | ❌ | Always `@drivebook.com.au` |
| Email header | ✅ | Shows `[BusinessName] — Tax Receipt` when branded |
| Body instructor name | ✅ | Uses `getDisplayName(instructor)` |
| "Powered by DriveBook" in receipt body | ⚠️ | Footer of receipt HTML still says "DriveBook" |

---

### 9. Wallet Lesson Receipt (instructor books, wallet deducted)

| Element | Status | Detail |
|---------|--------|--------|
| From display name | ❌ | Hardcoded `"DriveBook Payments"` — wallet receipts not white-labeled |
| Body | ❌ | Always says "DriveBook" — this is an internal wallet transaction, lower priority |
| Notes | This receipt goes to the student for wallet bookings (instructor-initiated). Still needs branding. |

---

### 10. Payment Page (`/booking/[id]/payment`)

| Element | Status | Detail |
|---------|--------|--------|
| School name shown above form | ✅ | Shows `businessName` in `brandColorPrimary` when `showBranding: true` |
| Instructor avatar fallback | ✅ | Uses `brandColorPrimary` background |
| Page background | ❌ | Always `bg-gray-50` — no brand color applied to page background |
| Page `<title>` | ❌ | Always "Complete Your Booking" — no business name |
| "Powered by Stripe" in footer | ⚠️ | Shows "💳 Powered by Stripe" — this is Stripe's requirement, cannot remove |
| "256-bit SSL" trust footer | ⚠️ | Generic DriveBook trust signals — acceptable |

---

### 11. Confirmation Page (`/booking/[id]/confirmation`)

| Element | Status | Detail |
|---------|--------|--------|
| School logo | ✅ | Shows `brandLogo` above ✅ icon when `showBranding: true` and logo set |
| Instructor avatar fallback | ✅ | Uses `brandColorPrimary` background |
| Instructor display name | ✅ | Uses `displayName` (business name when applicable) |
| "Back to school" button | ✅ | Shows when `?from=subdomain.drivebook.com.au` param is present |
| Confirmation URL domain | ⚠️ | URL is always `drivebook.com.au/booking/[id]/confirmation` — the page itself is not on the school's domain |
| "What's Next" text | ❌ | Always says "Log in with the email you used to book" — no school branding |
| Support email in footer | ❌ | Always `support@drivebook.com.au` — should be instructor's email for white-label |

---

### 12. SMS Booking Confirmation (sent after payment)

| Element | Status | Detail |
|---------|--------|--------|
| Instructor name in body | ✅ | Uses `getDisplayName(data.provider)` |
| "DriveBook" in body text | ⚠️ | Some templates have no DriveBook reference (good). Others have "Ref:" with booking ID — no DriveBook mention. Acceptable. |
| Sender number | ❌ | Always DriveBook Twilio number |

---

### 13. Lesson Reminder SMS (24h before lesson)

| Element | Status | Detail |
|---------|--------|--------|
| Instructor name | ✅ | Uses `getDisplayName(data.provider)` |
| "DriveBook" mention | ✅ | None — message is clean |
| Sender number | ❌ | Always DriveBook Twilio number |

---

### 14. Instructor Dashboard (`/dashboard/...`)

| Element | Status | Detail |
|---------|--------|--------|
| Nav logo / name | ❌ | Always "DriveBook" — dashboard is always DriveBook-branded |
| Sidebar | ❌ | Always DriveBook colors and name |
| Page title in browser tab | ❌ | Always "DriveBook \| ..." |
| Notes | For PREMIUM solo tier this is acceptable. For a school buying white-label, their admin portal should show their brand. SCHOOL tier future work. |

---

### 15. Client Dashboard (`/client-dashboard/...`)

| Element | Status | Detail |
|---------|--------|--------|
| Nav | ❌ | Always "DriveBook" |
| Page | ❌ | Always DriveBook colors |
| Notes | Students log in at `drivebook.com.au/login`. No school-scoped login or portal. SCHOOL tier future work. |

---

### 16. Login Page (`/login`)

| Element | Status | Detail |
|---------|--------|--------|
| Branding | ❌ | Always DriveBook — no per-school login page |
| Notes | Would require routing `sarah.drivebook.com.au/login` to a branded login page. Medium effort. |

---

### 17. Branding Settings Dashboard (`/dashboard/branding`)

| Control | Status | Detail |
|---------|--------|--------|
| Business name input | ✅ | All tiers |
| Brand logo upload | ✅ | All tiers |
| Primary color picker | ✅ | All tiers |
| Secondary color picker | ✅ | All tiers |
| "Show logo & colors on booking page" toggle | ✅ | Enables full nav branding |
| "Hide Powered by DriveBook" toggle | ✅ | Opt-out with honest description |
| Custom slug (`slug.drivebook.com.au`) | ✅ | All tiers |
| Custom domain (`www.yourown.com.au`) | ✅ | PRO / PREMIUM / STUDIO only — requires DNS CNAME |
| Domain verification wizard | ✅ | Step-by-step Cloudflare guide |
| Preview of how page looks | ❌ | No live preview in the settings panel |

---

## Schema Fields (all on `Instructor` model)

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `businessName` | `String?` | null | Trading/school name — all tiers |
| `accountType` | `String?` | null | `BUSINESS`/`PREMIUM` — gates display-name features |
| `brandLogo` | `String?` | null | Logo URL |
| `brandColorPrimary` | `String?` | null | Hex color |
| `brandColorSecondary` | `String?` | null | Hex color |
| `showBrandingOnBookingPage` | `Boolean` | false | Master switch |
| `hidePoweredBy` | `Boolean` | false | Opt-out of "Powered by DriveBook" badge |
| `customSlug` | `String?` | null | `slug.drivebook.com.au` |
| `customDomain` | `String?` | null | Custom domain |
| `domainVerified` | `Boolean` | false | DNS verification status |

---

## What "Full White-Label" Actually Requires

For a school to have zero DriveBook visibility to their students, they need:

1. Custom domain ✅ (built)
2. No "Powered by DriveBook" badge ✅ (built — `hidePoweredBy`)
3. Branded booking page logo + colors ✅ (built)
4. Branded email sender name ✅ (built — `formatBrandedSender`)
5. Branded email sender domain ❌ (needs Resend/SES custom domain verification per school)
6. Branded SMS sender ❌ (needs Twilio sub-account per school)
7. Branded confirmation page URL ⚠️ (partial — page is on drivebook.com.au but has "back to school" button)
8. Branded instructor dashboard ❌ (SCHOOL tier only)
9. Branded student dashboard / login ❌ (SCHOOL tier only)
10. Custom favicon on booking page ❌ (needs dynamic `<head>` per instructor subdomain)

**Current honest position:** We have ~60% of a white-label experience for the student-facing booking flow. The instructor and student management dashboards are not white-labeled and won't be until SCHOOL tier.

---

## Remaining Work — Prioritised

### P1 — Should be done soon (low-medium effort, high impact)

| # | What | Where | Effort |
|---|------|-------|--------|
| 1 | Receipt footer still says "DriveBook" | `lib/services/receipt-email.ts` — add `platformName` to footer function | 1 hour |
| 2 | Wallet lesson receipt not branded at all | `sendWalletLessonReceipt` — add `brandedSender` param, pass from `/api/bookings/route.ts` | 2 hours |
| 3 | Confirmation page support email | `app/booking/[id]/confirmation/page.tsx` — show instructor email instead of `support@drivebook.com.au` | 30 min |
| 4 | Confirmation page "What's Next" text | Remove "DriveBook account" reference, make generic | 30 min |
| 5 | Custom favicon per subdomain | Add `<link rel="icon">` tag from `brandLogo` in subdomain page `<head>` area | 1 hour |
| 6 | Live branding preview in settings | Show a mini-preview of the booking page with selected colors/logo | 4 hours |

### P2 — Medium effort, needed before "full white-label" marketing claim

| # | What | Where | Effort |
|---|------|-------|--------|
| 7 | Custom email sending domain | Integrate Resend domain API — verify per-school sending domain | 2-3 days |
| 8 | Branded login page for subdomain | Route `slug.drivebook.com.au/login` to branded login | 1 day |
| 9 | Confirmation page on school's domain | Pass `from` through entire booking flow so confirmation renders on school's host | 2 days |
| 10 | Booking page `<title>` uses business name | Already has `generateMetadata` — just use `displayName` in title | 30 min |

### Future — SCHOOL tier only

| # | What | Effort |
|---|------|--------|
| 11 | Instructor dashboard white-label | Complete rebrand — significant |
| 12 | Student portal white-label | School-scoped login, school-scoped client dashboard | Large |
| 13 | Per-school SMS sender (WhatsApp Business) | Twilio sub-accounts or Meta WABA | Large |

---

## Tier Matrix

| Feature | BASIC | PRO | PREMIUM | STUDIO | SCHOOL (future) |
|---------|-------|-----|---------|--------|-----------------|
| Business name | ✅ | ✅ | ✅ | ✅ | ✅ |
| Brand colors on booking page | ✅ | ✅ | ✅ | ✅ | ✅ |
| Brand logo on booking page | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom subdomain | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hide "Powered by DriveBook" | ✅ | ✅ | ✅ | ✅ | ✅ |
| Branded email sender display name | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom domain | ❌ | ✅ | ✅ | ✅ | ✅ |
| Branded confirmation page | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ |
| Custom email sending domain | ❌ | ❌ | ❌ | 🔮 | 🔮 |
| Branded instructor dashboard | ❌ | ❌ | ❌ | ❌ | 🔮 |
| Branded student dashboard/login | ❌ | ❌ | ❌ | ❌ | 🔮 |
| Per-school SMS number | ❌ | ❌ | ❌ | ❌ | 🔮 |
