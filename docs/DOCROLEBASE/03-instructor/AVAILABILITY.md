# Instructor Availability

**Route:** `/dashboard/availability`  
**Auth required:** INSTRUCTOR role  
**APIs:** `GET /api/instructor/availability`, `POST /api/instructor/availability`

---

## Working Hours

Instructors set their working hours per day of the week. Stored as `Instructor.workingHours` (JSON).

Format:
```json
{
  "monday":    { "start": "08:00", "end": "18:00", "enabled": true },
  "tuesday":   { "start": "08:00", "end": "18:00", "enabled": true },
  "wednesday": { "start": "08:00", "end": "18:00", "enabled": true },
  "thursday":  { "start": "08:00", "end": "18:00", "enabled": true },
  "friday":    { "start": "08:00", "end": "18:00", "enabled": true },
  "saturday":  { "start": "09:00", "end": "14:00", "enabled": true },
  "sunday":    { "start": "00:00", "end": "00:00", "enabled": false }
}
```

---

## Availability Exceptions

Instructors can block out specific dates or date ranges (e.g. holidays, PDA tests).

Stored in the `AvailabilityException` model. The availability service (`lib/services/availability.ts`) checks these when generating slots.

PDA tests automatically block 2 hours before + 1 hour after each test.

---

## Slot Generation

`getAvailableSlots(instructorId, date, lessonDurationMinutes)` in `lib/services/availability.ts`:

1. Fetches `workingHours` for the day
2. Fetches existing `PENDING`, `PENDING_PAYMENT`, and `CONFIRMED` bookings
3. Fetches PDA tests and availability exceptions
4. Generates slots every 30 minutes within working hours, skipping conflicts

---

## Booking Buffer

`Instructor.bookingBufferMinutes` — a gap added between consecutive bookings (e.g. 15 min travel time). Slots within the buffer of an existing booking are excluded.

---

## Travel Time

If `enableTravelTime: true`, the instructor's `travelTimeMinutes` is added to each booking's effective end time when checking for conflicts.

---

## Allowed Durations

`Instructor.allowedDurations` (JSON array) — the lesson durations the instructor offers, e.g. `[60, 90, 120]` minutes.

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — How slots are used in booking creation
- `lib/services/availability.ts` — Slot generation logic


# Instructor Bookings

**Route:** `/dashboard/bookings`  
**Auth required:** INSTRUCTOR role  
**APIs:** `GET /api/bookings`, `POST /api/bookings`, `PATCH /api/bookings/[id]/reschedule`, `POST /api/bookings/[id]/cancel`, `POST /api/bookings/[id]/check-in`

---

## Booking List

Shows all bookings for the instructor, filterable by:
- Status (upcoming, completed, cancelled)
- Date range
- Client name

---

## Create Booking

Instructors can create bookings on behalf of clients from `/dashboard/bookings/new`.

**Requirements:**
- Active subscription
- Client must have a DriveBook account (`client.userId` must exist)
- Client wallet balance ≥ lesson price

**API:** `POST /api/bookings`

**Security:** Price is always calculated server-side (`instructor.hourlyRate × durationHours`). The `price` field is not accepted from the request body — it is ignored if sent.

**Concurrency:** Slot conflict is checked both before and inside the `$transaction` to prevent TOCTOU race conditions. If two concurrent requests race for the same slot, one will get a 409.

If the client's wallet is insufficient, the API returns a `topUpAmount` value. The instructor can then send a payment link to the client via `POST /api/bookings/send-payment-link` — this emails the client a pre-filled wallet top-up link.

On successful booking creation, a **receipt email is sent to the student** via `sendWalletLessonReceipt()` showing:
- Lesson date, time, duration, instructor name
- "Booked by: Your instructor" label
- Wallet debit amount and remaining balance

---

## Reschedule

**Route:** `/dashboard/bookings/[id]/reschedule`  
**File:** `app/dashboard/bookings/[id]/reschedule/page.tsx`

**What it shows:**
- Date picker
- Available slot grid
- Penalty warning modal (if rescheduling within 24 hours of lesson start)
- Reschedule history

**Rules:**
- Cannot reschedule past, completed, or cancelled bookings
- Rescheduling within 24 hours of the lesson start requires confirming a penalty waiver
  - Sets `isNonRefundable = true` on the booking
  - Increments `instructor.policyExceptionCount`
- Checks availability (excludes current booking from conflict check)
- Syncs Google Calendar update if connected

**API:** `PATCH /api/bookings/[id]/reschedule`

---

## Cancel

Instructors can cancel bookings from the booking detail page.

Refund tiers (same as student cancellation):
- ≥ 48h notice: 100% refund to client wallet
- 24–48h notice: 50% refund
- < 24h notice: 0% refund
- `isNonRefundable = true`: 0% always

**API:** `POST /api/bookings/[id]/cancel`

---

## Check-In

**Route:** `/dashboard/bookings/[id]/check-in` (or mobile button)  
**File:** `components/mobile/CheckInButton.tsx`

Marks the lesson as started. Supports both web (NextAuth session) and mobile (JWT Bearer token).

**Time rules:**
- More than 15 min early → blocked
- More than 24 hours late → blocked, requires support contact
- 15 min to 24 hours late → allowed with `acknowledgeLateCheckIn: true` + reason (min 10 chars)

If `endTime` has already passed at check-in time, the booking is atomically set to `COMPLETED`.

**API:** `POST /api/bookings/[id]/check-in`

---

## Lesson Feedback

After a lesson is completed, the instructor can submit PDA-style feedback:
- `lessonFeedback` — array of PDA feedback codes
- `studentStrengths` — array of strength codes
- `focusAreas` — array of focus area codes
- `performanceScore` — integer score
- `instructorNotes` — free text

**File:** `components/instructor/LessonFeedbackForm.tsx`

---

## Related

- [CHECK_IN.md](./CHECK_IN.md) — Mobile check-in detail
- [CLIENTS.md](./CLIENTS.md) — Client management
- `docs/BOOKING_SYSTEM.md` — Full booking system reference


# Instructor Branding

**Route:** `/dashboard/branding`  
**Auth required:** INSTRUCTOR role (PRO or BUSINESS tier for full access)  
**File:** `app/dashboard/branding/page.tsx`  
**API:** `GET /api/instructor/branding`, `POST /api/instructor/branding`

---

## What It Controls

| Setting | Field | Tier Required |
|---------|-------|--------------|
| Brand logo | `brandLogo` (Cloudinary URL) | PRO / BUSINESS |
| Primary color | `brandColorPrimary` (hex) | All tiers |
| Secondary color | `brandColorSecondary` (hex) | All tiers |
| Subdomain slug | `customDomain` | All tiers |
| Social links | `whatsapp`, `instagram`, `facebook` | All tiers |
| Show branding on booking page | `showBrandingOnBookingPage` | PRO / BUSINESS |

---

## Tier Gate

BASIC tier instructors see an "Upgrade to PRO" wall for logo upload and the `showBrandingOnBookingPage` toggle. Color pickers and subdomain are available to all tiers.

The gate is enforced client-side on the branding page. The API itself allows all tiers to save branding data.

---

## Logo Upload

Logos are uploaded to Cloudinary. The upload flow:
1. Client selects image file
2. `POST /api/instructor/branding` with `type: "logo"` and the file
3. Cloudinary stores the image, returns a URL
4. URL saved to `Instructor.brandLogo`
5. `showBrandingOnBookingPage` is automatically set to `true` on logo upload

---

## Live Preview

The branding page shows a live preview of how the subdomain page will look with the selected colors and logo.

---

## Subdomain

The `customDomain` field sets the slug for the instructor's public booking page:
- URL: `[slug].drivebook.com.au` → served by `/subdomain/[slug]`
- Must be unique across all instructors
- Lowercase, alphanumeric, hyphens allowed

---

## Social Links

Displayed on the subdomain page as clickable icons:
- WhatsApp: opens `wa.me/[number]`
- Instagram: opens `instagram.com/[handle]`
- Facebook: opens `facebook.com/[handle]`

---

## Related

- [SUBDOMAIN_PAGE.md](../01-public/SUBDOMAIN_PAGE.md) — How branding appears publicly
- `docs/07-subscriptions/TIERS.md` — Feature access by tier
- `docs/04-business/DOMAIN_SETUP.md` — Custom domain for BUSINESS tier


# Check-In

**Auth required:** INSTRUCTOR role (web) or JWT Bearer token (mobile)  
**API:** `POST /api/bookings/[id]/check-in`  
**File:** `components/mobile/CheckInButton.tsx`, `app/api/bookings/[id]/check-in/route.ts`

---

## Purpose

Check-in marks the lesson as started. It is required for the booking to auto-complete after the lesson ends.

---

## Time Rules

| Timing | Result |
|--------|--------|
| More than 15 min early | Blocked — "Too early to check in" |
| On time (within 15 min early to on time) | Allowed |
| Up to 24 hours late | Allowed with `acknowledgeLateCheckIn: true` + reason (min 10 chars) |
| More than 24 hours late | Blocked — "Please contact support" |

---

## Auto-Complete

If `endTime` has already passed at the time of check-in, the booking is atomically set to `COMPLETED` in the same database update.

The cron job (`/api/cron/cleanup-expired-bookings`) also auto-completes any `CONFIRMED` bookings with a check-in that ended 2+ hours ago (safety net).

---

## Idempotency

The check-in uses `updateMany` with a `checkInTime: null` condition. If two devices attempt to check in simultaneously, only one succeeds. The second gets `{ error: 'Already checked in' }`.

---

## Mobile Check-In

The mobile app uses JWT Bearer token auth (not NextAuth sessions). The token is issued at login and must be included in the `Authorization: Bearer <token>` header.

If the token is expired, the endpoint returns 401 — the mobile app must re-authenticate.

GPS coordinates are optionally sent with the check-in request and stored as `checkInLocation` (advisory only — not enforced for validity).

---

## Late Check-In Audit Trail

When a late check-in is acknowledged, the reason and timestamp are appended to `booking.notes` for admin review.

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Full booking management
- `docs/mobile/ARCHITECTURE.md` — Mobile app architecture


# Instructor Clients

**Route:** `/dashboard/clients`  
**Auth required:** INSTRUCTOR role  
**File:** `app/dashboard/clients/page.tsx`  
**APIs:** `GET /api/instructor/clients`, `POST /api/instructor/clients`, `PATCH /api/instructor/clients/[id]`

---

## Client List

Shows all clients linked to the instructor. Each client card shows:
- Name, email, phone
- Total lessons booked
- Last lesson date
- Wallet balance (if they have a DriveBook account)
- Quick actions: Book Now, Edit, View History

---

## Add Client

Instructors can manually add clients (e.g. for clients who don't self-register).

Required fields:
- Name
- Email
- Phone

Optional:
- Default pickup address
- Notes

A `Client` record is created linked to the instructor. If the email matches an existing `User`, the client is linked to that account. Otherwise, the client exists without a DriveBook account — they cannot book via the client dashboard until they register.

---

## Edit Client

Instructors can update client details (name, phone, pickup address, notes) from the client detail page.

---

## Book on Behalf

From the client list, instructors can click "Book Now" to create a booking for a specific client. This opens the booking creation form pre-filled with the client's details.

**Requirement:** The client must have a DriveBook account (`client.userId` must exist) and sufficient wallet balance.

If the wallet is insufficient, the instructor can send a payment link to the client's email.

---

## Client History

The client detail page (`/dashboard/clients/[id]`) shows:
- All bookings with this client
- Lesson feedback history
- Performance scores over time
- Total hours driven

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Creating bookings for clients
- [EARNINGS.md](./EARNINGS.md) — Revenue per client


# Instructor Dashboard

**Route:** `/dashboard`  
**Auth required:** INSTRUCTOR role + active subscription  
**File:** `app/dashboard/page.tsx`

---

## What It Shows

- Today's bookings (time, client name, pickup address)
- Upcoming bookings (next 7 days)
- Earnings summary (this week, this month)
- Subscription status banner:
  - Trial: days remaining + upgrade CTA
  - Active: renewal date + current tier
  - Past due: payment warning
  - Cancelled: reactivation CTA
- Quick actions: Add Booking, View Clients, Check Availability

---

## Subscription Gate

All instructor dashboard routes require an active subscription (`requireActiveSubscription` middleware). If the subscription is expired or cancelled, the instructor is redirected to `/dashboard/subscription` to reactivate.

Trial instructors have full access during the trial period.

---

## Navigation

Desktop: `components/DashboardNav.tsx` — sidebar navigation  
Mobile: `components/instructor/MobileBottomNav.tsx` — bottom tab bar

Tabs:
- Dashboard (home)
- Bookings
- Clients
- Earnings
- Settings

---

## Stats

The dashboard fetches from `GET /api/analytics` which returns:
- Total bookings (all time)
- Bookings this month
- Revenue this month
- Active clients count
- Average rating

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Booking management
- [EARNINGS.md](./EARNINGS.md) — Earnings breakdown
- `docs/07-subscriptions/TIERS.md` — Subscription tiers


# Instructor Earnings

**Route:** `/dashboard/earnings`  
**Auth required:** INSTRUCTOR role  
**File:** `app/dashboard/earnings/page.tsx`  
**API:** `GET /api/instructor/earnings`

---

## What It Shows

- Weekly earnings breakdown (bar chart by day)
- Daily lesson list with per-lesson payout
- Scheduled upcoming lessons (confirmed, not yet completed)
- Receipt download per lesson

---

## Earnings Calculation

For each completed booking:

```
instructorPayout = booking.price x (1 - commissionRate / 100)
```

Commission rate is determined at booking creation time from `PlatformSettings`:

| Tier | Default Commission | Instructor Keeps |
|------|--------------------|-----------------|
| BASIC | 15% | 85% |
| PRO | 12% | 88% |
| BUSINESS | 10% | 90% |

First booking between a client and instructor uses the `newStudentBonus` rate instead:

| Tier | New Student Bonus | Instructor Keeps |
|------|-------------------|-----------------|
| BASIC | 8% | 92% |
| PRO | 10% | 90% |
| BUSINESS | 12% | 88% |

The actual `commissionRate` used is stored on the `Booking` and `Transaction` records at creation time and never changes.

---

## Withholding Tax

At payout time, ATO withholding tax is deducted from the gross payout:

```
grossAmount  = sum of instructorPayout across eligible transactions
taxWithheld  = grossAmount x (withholdingTaxRate / 100)
netAmount    = grossAmount - taxWithheld
```

Withholding rule:
- **Verified ABN** (`abnVerified = true`) → 0% withholding
- **No ABN, or ABN present but not yet verified** → 47% (ATO statutory rate)

Having an ABN on file is not enough — it must be verified via the ABR API or by an admin. Set your ABN at `/dashboard/settings/payout`. Once submitted, an admin or the ABR lookup will verify it. Until verified, the 47% rate applies.

---

## GST

If `gstRegistered = true` on your instructor profile, the GST component (1/11 of gross) is recorded on each payout for your reporting. You are responsible for remitting GST to the ATO via your own BAS.

---

## Payout Eligibility

A booking becomes eligible for payout 24 hours after `COMPLETED` status. The admin processes payouts via `/admin/payouts`.

Payouts are withheld if:
- The booking is under dispute
- Your `stripeAccountId` is not set (for Stripe Connect payouts)
- The booking was marked `NO_SHOW`
- An admin has placed the payout `ON_HOLD`
- Your ABN is not verified (`abnVerified = false`) — payout is blocked until admin or ABR confirms your ABN

---

## Payout Method

Set at `/dashboard/settings/payout`:

| Method | How it works |
|---|---|
| `stripe_connect` | Automatic transfer to your Stripe Connect account |
| `bank_transfer` | Admin transfers to your BSB/account on file |
| `manual` | Admin arranges payment directly |

---

## Receipt Download

Each completed lesson has a downloadable receipt showing:
- Client name
- Date and duration
- Lesson price
- Platform fee (commission)
- Instructor gross payout
- Tax withheld (if applicable)
- GST breakdown (if applicable)
- Net payout amount

---

## Related

- [DASHBOARD.md](./DASHBOARD.md) — Earnings summary on home
- [SETTINGS.md](./SETTINGS.md) — Tax and Payout settings
- `docs/06-payments/COMMISSIONS.md` — Commission rate details
- `docs/05-admin/PAYOUTS.md` — How payouts are processed


# Instructor Pricing

**Route:** `/dashboard/settings/pricing` (or `/dashboard/pricing`)  
**Auth required:** INSTRUCTOR role  
**APIs:** `GET /api/instructor/profile`, `PATCH /api/instructor/profile`

---

## Hourly Rate

The instructor's base rate per hour. Stored as `Instructor.hourlyRate` (Float, AUD).

This rate is used to calculate:
- Single lesson price: `hourlyRate × durationHours`
- Package prices: `hourlyRate × packageHours × (1 − discount)`

---

## Lesson Packages

Instructors can offer pre-defined packages. Stored as `Instructor.lessonPackages` (JSON).

Default package discounts (configurable via `/admin/pricing`):
| Package | Hours | Default Discount |
|---------|-------|-----------------|
| Starter | 6h | 5% |
| Standard | 10h | 10% |
| Intensive | 15h | 12% |

The `discountPaidBy` setting in `PlatformSettings` determines who absorbs the discount:
- `platform` — platform takes a smaller commission
- `instructor` — instructor receives less per lesson
- `shared` — split between platform and instructor

---

## Allowed Durations

`Instructor.allowedDurations` — the lesson lengths the instructor offers (e.g. 60, 90, 120 minutes). Students can only select from these durations when booking.

---

## Driving Test Package

A special package for students preparing for their driving test. Default price: $225 (configurable via `/admin/pricing` → `drivingTestPackagePrice`).

---

## Commission

The platform's commission is NOT set by the instructor — it is determined by their subscription tier and configured by the admin via `/admin/pricing`.

| Tier | Commission | Instructor Keeps |
|------|-----------|-----------------|
| BASIC | 15% | 85% |
| PRO | 12% | 88% |
| BUSINESS | 10% | 90% |

See `docs/06-payments/COMMISSIONS.md` for full details.

---

## Related

- [EARNINGS.md](./EARNINGS.md) — How earnings are calculated
- `docs/06-payments/COMMISSIONS.md` — Commission rates
- `docs/05-admin/SETTINGS.md` — Admin pricing configuration


# Instructor Settings

**Route:** `/dashboard/settings`  
**Auth required:** INSTRUCTOR role  
**APIs:** `GET /api/instructor/profile`, `PATCH /api/instructor/profile`

---

## Profile

- Display name
- Phone number
- Bio (shown on public profile)
- Years of experience
- Profile photo (Cloudinary upload)
- Base address (used for service radius calculation)
- Service radius (km)
- Service areas (text description)
- Languages spoken

---

## Vehicle

- Car make, model, year
- Vehicle types (manual, automatic, both)
- Car photo (Cloudinary upload)

---

## Documents

Instructors must upload compliance documents before approval. Managed via `/dashboard/documents`.

Required documents:
- Driver's licence (front + back)
- Insurance policy
- Police check
- Working With Children (WWC) check
- Photo ID
- Vehicle registration

Document expiry dates are tracked:
- `licenseExpiry`
- `insuranceExpiry`
- `policeCheckExpiry`
- `wwcCheckExpiry`

Admin reviews documents at `/admin/documents/review/[instructorId]`.

---

## Tax & Payout

**Route:** `/dashboard/settings/payout`  
**API:** `GET/POST /api/instructor/payout-settings`

Instructors configure how they receive payouts and provide tax details for ATO compliance.

### Payout Method

| Method | Description |
|---|---|
| `stripe_connect` | Automatic transfer to Stripe Connect account |
| `bank_transfer` | Manual transfer to BSB/account on file |
| `manual` | Admin arranges payment directly |

### Bank Details (for `bank_transfer`)

- BSB (`bankBsb`) — 6 digits, format XXX-XXX. Validated for format on save. The platform maps known BSB prefixes to bank names (e.g. `062` → Commonwealth Bank) for UX feedback — this does not verify account ownership.
- Account number (`bankAccount`) — 6–10 digits
- Account name (`bankAccountName`) — account holder name

Bank details are not verified against your identity. Admin will confirm before processing your first bank transfer payout.

> For security, Stripe Connect is the recommended payout method. Stripe verifies your identity and bank account ownership. Bank transfer relies on admin manual confirmation only — there is no automated ownership check.

### Tax Details

| Field | Description |
|---|---|
| `abn` | Australian Business Number — 0% withholding if verified |
| `abnVerified` | `true` after admin confirms ABN via ABR API or manual review |
| `abnStatus` | `PENDING` \| `ACTIVE` \| `CANCELLED` \| `REVIEW_REQUIRED` |
| `abnEntityName` | Entity name returned by ABR — stored for audit trail |
| `abnVerifiedAt` | Timestamp of last verification |
| `abnVerifiedBy` | Admin user ID who verified, or `SYSTEM` for automatic |
| `gstRegistered` | Set automatically from ABR response — not a manual toggle |
| `withholdingTaxRate` | 0% if ABN verified; 47% otherwise. Set automatically — not editable by instructor |

Providing a valid ABN eliminates ATO withholding tax from your payouts. Without a verified ABN, the platform withholds 47% (ATO statutory rate) from each payout.

When you enter an ABN, the platform automatically checks it against the Australian Business Register (ABR). The name on your ABN must match your instructor profile name:
- Exact or near-exact match (≥80% similarity) → auto-approved
- Partial match (50–79%) → flagged as `REVIEW_REQUIRED` — admin must manually confirm
- No match (<50%) → admin review required before payouts are enabled

`gstRegistered` is set from the ABR response, not from user input. If the ABR shows your ABN is GST-registered, the GST component is recorded on each payout for your reporting.

When you save a new ABN, verification resets to `PENDING` and withholding returns to 47% until admin re-verifies. Saving other settings (bank details, payout method) without changing your ABN does not affect your verification status or withholding rate.

ABNs are rechecked weekly against the ABR. If your ABN is cancelled, `abnVerified` is cleared automatically and payouts are blocked until resolved.

> TFN collection is not currently active. The field is commented out in the schema and can be enabled if legally required.

---

## Google Calendar

Instructors can connect Google Calendar to sync bookings automatically.

- `syncGoogleCalendar: true` — enables sync
- `googleTokenExpiry` — when the OAuth token expires
- `calendarBufferMode` — how buffer time is handled in calendar events

OAuth callback: `GET /api/calendar/callback`

**Note:** `GOOGLE_REDIRECT_URI` in `.env` must point to the correct domain. Current value has a typo (`deivebook` instead of `drivebook`) — needs fixing.

---

## Notifications

Instructors receive in-app notifications for:
- New booking created
- Booking cancelled
- Booking rescheduled
- Payment received
- New client review

Notification preferences can be configured to also send SMS (via Twilio) and email.

---

## Subscription

Link to `/dashboard/subscription` — manage tier, billing, and payment method.

---

## Related

- [BRANDING.md](./BRANDING.md) — Logo, colors, subdomain
- [AVAILABILITY.md](./AVAILABILITY.md) — Working hours
- [EARNINGS.md](./EARNINGS.md) — Earnings and payout details
- `docs/07-subscriptions/BILLING.md` — Subscription billing


# Instructor Subscription Tiers

**Last Updated:** April 2026  
**Route:** `/dashboard/subscription`  
**File:** `components/SubscriptionPlans.tsx`, `lib/config/subscriptions.ts`

---

## Overview

DriveBook uses a 4-tier subscription model for instructors. Three tiers are live and purchasable. Business is defined in the system but marked "Coming Soon" in the UI — it is not purchasable until multi-instructor management features are complete.

---

## Tier Comparison

| Feature | BASIC | PRO | STUDIO | BUSINESS |
|---------|-------|-----|--------|----------|
| Monthly price | $29 | $79 | $129 | $199 |
| Annual price | $290 | $790 | $1290 | $1990 |
| Trial days | 14 | 14 | 14 | 30 |
| Commission rate | 15% | 12% | 11% | 10% |
| New student bonus | 8% | 10% | 10% | 12% |
| Public booking page | ✅ | ✅ | ✅ | ✅ |
| Default URL (by ID) | ✅ | ✅ | ✅ | ✅ |
| Custom slug | ❌ | ✅ | ✅ | ✅ |
| Branded booking page | ❌ | ✅ | ✅ | ✅ |
| Custom domain | ❌ | ❌ | ✅ | ✅ |
| Priority support | ❌ | ✅ | ✅ | ✅ |
| Multiple instructors | ❌ | ❌ | ❌ | ✅ |
| API access | ❌ | ❌ | ❌ | ✅ |
| UI status | Live | Live | Live | Coming Soon |

---

## BASIC — $29/month

Entry tier for individual instructors just getting started.

**What you get:**
- Single instructor account
- Unlimited bookings
- Google Calendar sync
- Email notifications
- Basic analytics
- Student reviews
- Mobile app access
- Public booking page at `<id>.drivebook.com.au`
- 15% commission per booking
- 8% bonus for new students

**Limitations:**
- No custom slug or domain
- No branded booking page (DriveBook branding shown)
- No priority support

---

## PRO — $79/month

For instructors growing their business and wanting a professional presence.

**Everything in Basic, plus:**
- Custom slug (e.g. `john.drivebook.com.au`)
- Branded booking page — custom logo, colors, white-label nav
- Advanced analytics & insights
- SMS notifications
- Waiting list management
- PDA test tracking
- Document management
- Check-in/Check-out system
- Custom service areas
- 12% commission per booking
- 10% bonus for new students
- Priority email support

---

## STUDIO — $129/month

For instructors who want their own domain and a fully white-labelled experience.

**Everything in Pro, plus:**
- Custom domain (bring your own — e.g. `book.yourdrivingschool.com.au`)
- 1 year free domain included (planned)
- Fully white-label booking experience on your own domain
- 11% commission per booking
- 10% bonus for new students
- Priority support

**Domain setup:**
1. Instructor enters their domain in `/dashboard/branding`
2. System verifies DNS CNAME points to `cname.vercel-dns.com`
3. `domainVerified = true` stored on instructor record
4. Domain added to Vercel project for SSL (manual step currently)

**Schema fields:**
```
customDomain     String?
domainVerified   Boolean   @default(false)
domainVerifiedAt DateTime?
```

---

## BUSINESS — $199/month (Coming Soon)

Multi-instructor school management. Not yet purchasable.

**Planned features (not yet implemented):**
- Multiple instructor accounts under one school
- Fleet management
- Staff governance
- Multi-account billing
- API access
- Advanced reporting
- Dedicated account manager
- Priority phone support
- 10% commission per booking
- 12% bonus for new students

**Current status:**
- Defined in `lib/config/subscriptions.ts` and `prisma/schema.prisma`
- Shown in `/dashboard/subscription` as a greyed-out card with "Coming Soon" badge
- Button is disabled — cannot be purchased
- Will be enabled once multi-instructor management is built and reviewed

---

## Trial Period

All tiers include a free trial:
- BASIC, PRO, STUDIO: 14 days
- BUSINESS: 30 days (when available)

During trial:
- Full access to all tier features
- No payment method required upfront
- Trial end date stored in `instructor.trialEndsAt`
- After trial expires, subscription must be activated to continue

---

## Commission & Bonus Rates

Commission and bonus rates are configurable via `/admin/pricing` → `PlatformSettings` in DB. The values in `lib/config/subscriptions.ts` are defaults — the DB values take precedence at runtime.

```
instructorPayout = lessonAmount - commission - newStudentBonus
platformRevenue  = platformFee + commission + newStudentBonus
```

`newStudentBonus` only applies to the first booking a student makes with that instructor.

---

## Stripe Integration

Each tier has monthly and annual Stripe Price IDs configured via environment variables:

```
STRIPE_BASIC_MONTHLY_PRICE_ID=
STRIPE_BASIC_ANNUAL_PRICE_ID=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_PRO_ANNUAL_PRICE_ID=
STRIPE_STUDIO_MONTHLY_PRICE_ID=
STRIPE_STUDIO_ANNUAL_PRICE_ID=
STRIPE_BUSINESS_MONTHLY_PRICE_ID=   (not yet active)
STRIPE_BUSINESS_ANNUAL_PRICE_ID=    (not yet active)
```

Subscription management:
- `POST /api/instructor/subscription` — create or change plan
- `POST /api/instructor/subscription/billing-portal` — open Stripe Billing Portal
- `POST /api/instructor/subscription/change-plan` — upgrade/downgrade

---

## Feature Access Gates

Feature access is checked at the component level using `instructor.subscriptionTier`:

| Gate | Where enforced |
|------|---------------|
| Branded booking page | `app/subdomain/[slug]/page.tsx` — `isPro` check |
| Custom domain | `app/subdomain/[slug]/page.tsx` — `isPro` check |
| Branding settings | `app/dashboard/branding/page.tsx` — shows upgrade wall for BASIC |
| Custom slug | `app/api/instructor/branding/route.ts` |

**Note:** Color customization (`brandColorPrimary`, `brandColorSecondary`) applies to all tiers on the subdomain page. Logo and white-label nav require PRO+.

---

## Related

- `docs/SUBSCRIPTION_SYSTEM.md` — Technical subscription implementation
- `lib/config/subscriptions.ts` — Tier definitions and defaults
- `components/SubscriptionPlans.tsx` — UI component
- `app/dashboard/subscription/page.tsx` — Subscription management page
- `docs/SUBDOMAIN_SYSTEM.md` — Domain and branding by tier
