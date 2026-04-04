# Public Booking Flow

**Routes:** `/book` and `/book/[instructorId]`  
**Auth required:** No  
**Files:** `app/book/page.tsx`, `app/book/[instructorId]/page.tsx`, `components/BulkBookingForm.tsx`

---

## Step 1 — Location Search (`/book`)

The entry point for new students. No API calls on this page.

**What it shows:**
- Location search input (Google Maps autocomplete)
- "Find Instructors Near Me" CTA
- Brief value proposition copy

**What it does:**
- On submit, redirects to `/book?location=...&lat=...&lng=...` or directly to an instructor profile if only one result

---

## Step 2 — Instructor Profile (`/book/[instructorId]`)

**API calls:**
- `GET /api/availability/slots?instructorId=&date=&duration=` — fetches available time slots
- `GET /api/public/bookings` — checks existing bookings for conflict display
- `POST /api/payments/create-intent` — called after form submission

**What it shows:**
- Instructor name, photo, rating, years experience, car details, languages
- Hourly rate and available lesson durations (from `instructor.allowedDurations`)
- Package pricing (6h, 10h, 15h discounts) + instructor custom add-on packages
- Available time slots via `SlotPicker` component
- `BulkBookingForm` — the main booking form

### BulkBookingForm

A multi-step form (`components/BulkBookingForm.tsx`) that handles:

1. **Package selection** — standard packages (6/10/15 hrs with platform discounts) + optional instructor add-on packages (fixed price, no platform discount)
2. **Book Now / Book Later** — student chooses whether to schedule now or load wallet and book from dashboard
3. **Schedule** (Book Now only) — date picker + slot grid + duration selector. Slots are duration-aware — a 3hr slot at 9am is blocked if 10am is already booked. Local overlap check prevents scheduling two lessons that overlap.
4. **Client details** — name, email, phone, pickup address
5. **Password creation** — for new users only (min 6 chars)
6. **Review & confirm** — price breakdown with order summary

**Instructor add-on packages:**
- Set by instructor in Settings → Custom Lesson Packages
- Fixed price — no platform bulk discount applied
- Shown as optional checkboxes below standard packages
- Can be combined with a standard package or selected alone
- `customPackageId` sent in booking payload; server looks up price from DB

**Pricing calculation (client-side preview):**
```
standardLesson = instructor.hourlyRate × hours × (1 − discountPct/100)
addonPackage   = pkg.price (fixed, no discount)
platformFee    = (standardLesson + addonPackage) × platformFeePercentage/100
total          = standardLesson + addonPackage + platformFee
```
Discount rates and platform fee fetched live from `GET /api/public/pricing` (sourced from `PlatformSettings` in DB). Configurable via `/admin/pricing`.

**Rate & discount locking:**
When a package is purchased, the instructor's current `hourlyRate` and the applied `discountPercentage` are stored on the `Booking` record as `lockedHourlyRate` and `lockedDiscountPct`. All future lesson deductions from that package use these locked values — instructor rate changes after purchase do not affect the student's remaining hours.

Wallet-only top-ups (not yet booked) are not locked — they are plain money. If the instructor raises their rate before the student books, the booking uses the current rate at booking time. The UI shows a tip: "Book all lessons now to lock in the current rate."

---

## Step 3 — Booking Creation

On form submit, calls `POST /api/public/bookings/bulk`.

**What the API does:**
1. Rate-limits by IP + email + instructorId
2. Validates instructor exists, is approved, and is not suspended
3. Checks if email already has an account:
   - New user → creates `User` with hashed password
   - Existing user → links booking to their account
4. Finds or creates a `Client` record for this instructor
5. Calculates pricing **server-side** — client-submitted total is validated against server calculation (rejects if >$0.01 difference)

**Book Later path (`bookingType: later`):**
- No booking record created
- Creates a `WalletTransaction (PENDING)` for the full package amount
- Returns `{ transactionId }` — no `bookingId`
- Payment page: `/payment/wallet/[transactionId]` (opens in new tab from subdomain)
- On payment success: webhook confirms the wallet transaction → balance available immediately
- Student books individual lessons from their dashboard using wallet credits

**Book Now path (`bookingType: now`):**
- Atomic slot claim — conflict check + booking create in a single `$transaction`
- Creates booking with `status: PENDING_PAYMENT` — holds slot for 10 minutes
- Returns `{ bookingId, total }`
- Payment page: `/booking/[id]/payment`

**On 409 (slot taken):** "This slot was just taken — please choose another time"

**On 409 (price changed):** server recalculates at submission time. If client total differs by >$0.01, returns `{ serverTotal }`. Wizard shows updated price and asks student to confirm.

---

## Step 4 — Payment

**From subdomain:** payment page opens in a **new blank tab** — the subdomain page stays open underneath. The wizard shows "Payment page opened!" with a "Start a new booking" option.

**From public flow:** student is redirected to the payment page in the same tab.

**Book Now payment page** (`/booking/[id]/payment`):
- Fetches booking from `/api/public/bookings/[id]`
- Uses `lockedHourlyRate` and `lockedDiscountPct` stored on the booking for the price breakdown
- Calls `POST /api/payments/create-intent` with `{ bookingId, amount }`
- On success: Stripe redirects to `/booking/[id]/confirmation`

**Book Later payment page** (`/payment/wallet/[transactionId]`):
- Calls `POST /api/payments/create-intent` with `{ transactionId }`
- Shows "Your wallet will be credited with $X"
- On success: Stripe redirects to `/payment/wallet/[transactionId]/confirmation`
- Confirmation page links to client dashboard and book-lesson page

**Receipt email:** fires from the Stripe webhook after `payment_intent.succeeded`.

---

## Slot Expiry

If the client does not complete payment within 10 minutes, the cron job (`/api/cron/cleanup-expired-bookings`) sets the booking to `EXPIRED` and releases the slot.

Short-notice `PENDING` bookings (awaiting instructor approval) expire after 2 hours if the instructor has not approved.

If the client returns to the payment page after expiry, they see a "Slot Expired — Go Back & Rebook" screen.

---

## Rate Limiting

All public booking endpoints use `bulkBookingRateLimit` + `checkRateLimitStrict`:
- Identifier: `bulk-booking:{email}:{instructorId}` + IP
- Exceeding limit → 429 with `X-RateLimit-*` headers
- Strict mode: fails closed if the rate limiter itself fails (financial endpoint protection)

---

## Production Checklist

Before going live with public bookings:
- [ ] `STRIPE_WEBHOOK_SECRET` set to real value from Stripe Dashboard
- [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set for real rate limiting (falls back to in-memory in dev)
- [ ] Test full flow: search → instructor → package → register → pay → confirm
- [ ] Verify wallet credit + debit after webhook fires

---

## Related

- [PAYMENT_PAGE.md](./PAYMENT_PAGE.md) — Step 4: Stripe payment
- [SUBDOMAIN_PAGE.md](./SUBDOMAIN_PAGE.md) — Alternative entry via instructor's branded page
- `docs/BOOKING_SYSTEM.md` — Full booking system reference
- `docs/PUBLIC_BOOKING_FLOW.md` — Voice service + rate limiting deep dive


# Landing Page — drivebook.com.au

**Route:** `/` (app/page.tsx)  
**Audience:** Learner drivers + parents (primary), instructors (secondary — footer only)  
**Last Updated:** March 2026  

---

## Page Structure (top to bottom)

| Section | Content | Notes |
|---------|---------|-------|
| Nav | Logo, About, Contact, Blog, For Instructors, Login, Sign Up | Mobile hamburger menu |
| Hero | "Pass Your Driving Test with Confidence" + 5 bullets + CTA | Learner-focused only |
| Trust Badge | Single green badge — background-checked, licensed & approved | One instance only — no repetition |
| AI Phone Booking | "Book by Phone — AI Answers 24/7" + AIReceptionistShowcase | Primary differentiator, above Why Choose |
| Why Choose DriveBook | 6 cards: Trusted & Approved, Book in Seconds, Flexible Packages, Smart Reminders, Track Progress, Test Prep | Learner-focused |
| Progress Dashboard | ProgressTrackingShowcase + explainer sentence | Explains HOW data is generated |
| How It Works | BookingFlowShowcase — 4 steps | Search → Book → Confirm → Track |
| Quick Summary | 4-step amber box | Mirrors the 4-step flow |
| What You Get | 4 feature tiles | Payment, Test Prep, Progress, Confirmation |
| Testimonials | Sarah M. (student), Linda R. (parent), Michael K. (student) | No instructor testimonials on this page |
| FAQ | 6 questions | Trust, cancellation, payment, packages, choice, contact |
| CTA | "Book Your First Lesson" + optional phone CTA | Instructor link in footer only |
| Footer | 4-column: DriveBook, Company, Legal, Get Started | Instructor link tucked here |

---

## Key Copy Decisions

### Hero bullets (5 items)
```
🎯 Smart booking with real-time availability — no waiting, no phone tag
📍 Location-based matching to find instructors who service your area
💰 Save up to 12% with bulk hour packages and test preparation bundles
📞 Book by phone — AI answers 24/7, no app download needed
📱 Manage everything 24/7 from your personal dashboard
```

### Trust — appears ONCE only
The green trust badge below the hero is the single authoritative trust signal. "Verified" does not appear in the hero subheading or bullets. Repeating the same claim triggers the overjustification effect.

### AI Phone Booking — positioned as primary differentiator
Sits immediately after the trust badge, before "Why Choose DriveBook". The "no app download required" message is the headline — this is the key friction reducer vs competitors.

### Progress Dashboard explainer
Below the section heading, a one-sentence explainer:
> "After every lesson, your instructor logs your performance directly into DriveBook — giving you personalised feedback on exactly what to work on next."

This grounds the dashboard data in human action (instructor logs it), not an algorithm.

### Testimonials — learner/parent only
- Sarah M., Perth — passed first try
- Linda R., Parent — safety and verification focus
- Michael K., New Driver — bulk package + SMS reminders

James T. (Driving Instructor) quote was removed. It belongs on `/teach-with-drivebook` as B2B copy.

### CTA button text
Hero: "Book Your First Lesson →"  
Bottom CTA section: "Find Your Instructor →"

---

## Components Used

| Component | File | Purpose |
|-----------|------|---------|
| AIReceptionistShowcase | `components/landing/AIReceptionistShowcase.tsx` | Animated AI phone booking demo |
| ProgressTrackingShowcase | `components/landing/ProgressTrackingShowcase.tsx` | 3-slide dashboard demo |
| BookingFlowShowcase | `components/landing/BookingFlowShowcase.tsx` | 5-step booking flow demo |

Note: `TrustSafetyShowcase` and `PackagePricingShowcase` are no longer rendered on the homepage (removed to reduce repetition and page weight).

---

## Instructor Acquisition

Instructors are NOT a primary audience on this page. The only instructor-facing touchpoints are:

1. "For Instructors" link in the nav → `/teach-with-drivebook`
2. Footer CTA: "Are you a driving instructor? Learn how DriveBook can grow your business →"

This keeps the learner conversion funnel uninterrupted.

---

## Currency & Pricing

All prices displayed in AUD with `$` symbol. No £ signs anywhere on the platform.

---

## What NOT to do

- Do not add instructor testimonials to this page
- Do not repeat the safety/verification claim more than once
- Do not add a "For Instructors" section in the main content flow
- Do not hardcode instructor counts in demo components (use "Instructors Near You" instead)


# Payment Page

**Route:** `/booking/[id]/payment`  
**Auth required:** No  
**File:** `app/booking/[id]/payment/page.tsx`

---

## Purpose

Collects Stripe payment for a booking that is in `PENDING_PAYMENT` status. The slot is held for 10 minutes from booking creation.

---

## Page Load

1. Fetches booking via `GET /api/public/bookings/[id]`
2. Checks `booking.status`:
   - `EXPIRED` → shows "Slot Expired" screen with a back button — no payment form rendered
   - `CONFIRMED` (already paid) → redirects to confirmation page
   - `PENDING_PAYMENT` → proceeds to payment form
3. Calls `POST /api/payments/create-intent` with `{ bookingId }` to get a Stripe `clientSecret`

**Charge amount:** `booking.packageTotalPaid || booking.price`
- Package bookings: `packageTotalPaid` (full package amount, e.g. $600 for 10 hours)
- Single lesson: `booking.price` (1hr × hourlyRate)

---

## Payment Intent Reuse

The API reuses an existing `paymentIntentId` only if its Stripe status is one of:
- `requires_payment_method`
- `requires_confirmation`
- `requires_action`
- `processing`

Any other status (expired, cancelled, failed) → creates a fresh intent.

---

## Stripe Elements

The page renders Stripe's `PaymentElement` component. On submit:
1. Stripe confirms the payment
2. On success → Stripe redirects to the `return_url` (confirmation page)
3. The Stripe webhook (`payment_intent.succeeded`) fires asynchronously and:
   - Sets `booking.status → CONFIRMED`
   - Sets `booking.isPaid = true`, `paymentCaptured = true`
   - Credits the client wallet with `packageTotalPaid`
   - Debits the wallet for the first lesson (`booking.price`)
   - Sends in-app notification to instructor

---

## Countdown Timer

The page shows a countdown from the booking's `createdAt + 10 minutes`. When it hits zero, the page refreshes and shows the expired state.

---

## Commission Applied

At payment intent creation, the API:
1. Fetches the instructor's `subscriptionTier`
2. Calls `getCommissionRate(tier)` from `lib/services/platform-pricing.ts`
3. Stores the rate in Stripe metadata for auditability
4. Calculates `platformFee` and `instructorPayout` and stores on the booking

---

## Related

- [BOOKING_FLOW.md](./BOOKING_FLOW.md) — Steps 1–3 (search → booking creation)
- `docs/06-payments/STRIPE.md` — Stripe configuration
- `docs/06-payments/WALLET.md` — Wallet credit mechanics


# Subdomain Page

**Route:** `/subdomain/[slug]` (served at `[slug].drivebook.com.au`)  
**Auth required:** No  
**File:** `app/subdomain/[slug]/page.tsx`, `components/subdomain/SubdomainBookingEntry.tsx`, `components/subdomain/SubdomainBookingWizard.tsx`  
**Full reference:** `docs/SUBDOMAIN_SYSTEM.md`

---

## Purpose

Each instructor gets a white-labeled public booking page. The URL slug comes from `Instructor.customDomain`. True subdomain routing is live — `john-smith.drivebook.com.au` rewrites transparently to `/subdomain/john-smith` via `middleware.ts`.

---

## Page Layout

```
┌─────────────────────────────────────────────────────────┐
│ Nav bar: [Logo/Car icon]  [Instructor name]  [WhatsApp] │
│          [Login]                                        │
├─────────────────────────────────────────────────────────┤
│ Hero banner (gradient using brand colors)               │
│  [Profile photo]  [Name]  [Star rating or "New"]        │
│  [Service areas]  [Vehicle types]  [Years exp]          │
│  [Next available: 2-3 real slots from now]              │
├─────────────────────────────────────────────────────────┤
│ Trust badges: ✅ Verified  🏆 X+ Years  ⭐ Rating  🔒   │
├──────────────────────┬──────────────────────────────────┤
│ Left column          │ Right column                     │
│ Next availability    │ Social proof banner              │
│ (2-3 real slots)     │ "Book Your Lesson →" button      │
│ About / bio          │ Student reviews                  │
│ Pricing              │                                  │
│  - Single lesson     │                                  │
│  - Lesson durations  │                                  │
│  - Instructor pkgs   │                                  │
│ Vehicle details      │                                  │
│ Social links         │                                  │
│ Vehicle photo        │                                  │
│ FAQ accordion        │                                  │
└──────────────────────┴──────────────────────────────────┘
│ MOBILE: Fixed bottom nav (About/Services/Contact/Book)  │
└─────────────────────────────────────────────────────────┘
```

Data fetched server-side: instructor profile, last 5 reviews (completed bookings with `clientRating != null`), next 2-3 available slots (14-day window, starting 2hrs from now), active packages.

---

## Booking Flow

When the student clicks "Book Your Lesson →", a **full-screen overlay** opens on top of the profile page. The profile stays open underneath — the student can close the overlay and return to the profile at any time.

**Overlay components:**
- `components/subdomain/SubdomainBookingEntry.tsx` — CTA button + overlay wrapper
- `components/subdomain/SubdomainBookingWizard.tsx` — multi-step wizard

**Wizard steps:**
1. Package — standard (6/10/15 hrs) + instructor add-on packages (fixed price, no platform discount)
2. Test Package — only if `instructor.offersTestPackage = true`
3. When to Book — Book Now or Book Later
4. Schedule — only if Book Now (date/time/duration, duration from `instructor.allowedDurations`)
5. Your Details — name, email, phone, password

**After submit:**
- Wizard shows order summary with "Complete Payment →" link
- Payment opens in a **new blank tab** — profile stays open
- Book Now → `/booking/[id]/payment`
- Book Later → `/payment/wallet/[transactionId]` (wallet credited, no booking created)

See [BOOKING_FLOW.md](./BOOKING_FLOW.md) for full payment flow.

---

## Branding Tiers

| Feature | BASIC | PRO | STUDIO | BUSINESS |
|---------|-------|-----|--------|----------|
| Public booking page | ✅ | ✅ | ✅ | ✅ |
| Default URL (by ID) | ✅ | ✅ | ✅ | ✅ |
| Custom slug | ❌ | ✅ | ✅ | ✅ |
| Custom logo | ❌ | ✅ | ✅ | ✅ |
| Custom brand colors | ✅ | ✅ | ✅ | ✅ |
| White-label nav (hide "DriveBook") | ❌ | ✅ | ✅ | ✅ |
| Custom domain | ❌ | ❌ | ✅ | ✅ |
| Social links | ✅ | ✅ | ✅ | ✅ |

```typescript
const isPro = instructor.subscriptionTier === 'PRO' 
           || instructor.subscriptionTier === 'STUDIO' 
           || instructor.subscriptionTier === 'BUSINESS';
const hasBranding = isPro && instructor.showBrandingOnBookingPage;
// Nav shows instructor name only if hasBranding, otherwise shows "DriveBook"
// Colors apply to all tiers — fall back to #3B82F6 / #10B981 if not set
```

---

## Next Available Slots

Computed server-side from working hours + upcoming bookings. Shows up to 3 real available slots starting from 2 hours from now (not just working hours start time).

- Shown in hero banner (first 2 slots inline)
- Shown in left column "Next Available" card (all 3 slots, first prominent)
- Shown in booking form social proof banner

---

## SEO

`generateMetadata()` exports:
- `<title>` — `"Book Driving Lessons with [Name]"`
- `<description>` — instructor bio (truncated to 155 chars) or generated fallback
- OpenGraph + Twitter card — for WhatsApp/Facebook link previews with profile image

JSON-LD `LocalBusiness` structured data inline — includes `aggregateRating` only if `totalReviews > 0`, `address` only if `baseAddress` is set.

---

## Trust Badges

Only shows badges that are factually true — no fabricated claims:
```typescript
const trustBadges = [
  instructor.isVerified && { icon: '✅', label: 'Verified Instructor' },
  yearsExperience && { icon: '🏆', label: `${yearsExperience}+ Years Experience` },
  instructor.totalReviews > 0 && { icon: '⭐', label: `${rating} Rating (${count} reviews)` },
  { icon: '🔒', label: 'Secure Online Booking' }, // always shown
].filter(Boolean);
```

---

## Mobile UX

`components/subdomain/SubdomainClientFeatures.tsx` — client component (isolated from the Server Component page).

- Fixed bottom nav bar: About / Services / Contact / Book Now
- "Book Now" opens the same full-screen overlay as the desktop button
- Body scroll locked while overlay is open
- iPhone safe area inset handled via `env(safe-area-inset-bottom)`

---

## Instructor Add-On Packages

Instructor custom packages (e.g. PDA test package) are shown in the Services & Pricing card on the left column. They display:
- Package name
- Duration
- Description (includes/features)
- Fixed price
- "Save $X vs hourly" only if instructor priced it below the hourly equivalent

No platform bulk discount is applied to instructor packages — they have a fixed price set by the instructor.

---

## FAQ Accordion

Uses native HTML `<details>`/`<summary>` — zero JS, works without hydration. Questions: what to bring, pickup location, cancellation policy, first-timers, how packages work.

---

## Slug Resolution

`Instructor.customDomain` → slug. Falls back to `Instructor.id` — every instructor has a working URL at `<id>.drivebook.com.au` from day one.

Middleware compound TLD awareness (`.com.au` needs 4+ parts for a subdomain):
```typescript
const twoPartTLDs = ['com.au', 'co.uk', 'co.nz', 'org.au', 'net.au', 'id.au']
const isCompoundTLD = twoPartTLDs.includes(parts.slice(-2).join('.'))
const minParts = isCompoundTLD ? 4 : 3
```

---

## DNS (Live)

Wildcard CNAME `*` → `cname.vercel-dns.com` in Vercel DNS panel. SSL auto-managed by Vercel (wildcard cert).

---

## Related

- [BOOKING_FLOW.md](./BOOKING_FLOW.md) — Full booking flow (public + subdomain)
- `docs/SUBDOMAIN_SYSTEM.md` — Full reference (DNS, middleware, local dev setup, all fields)
- `docs/DOCROLEBASE/03-instructor/SUBSCRIPTION_TIERS.md` — Tier features and domain setup
