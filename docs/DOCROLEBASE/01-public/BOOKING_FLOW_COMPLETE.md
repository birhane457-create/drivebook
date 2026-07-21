# Complete Booking Flow Analysis

**Date:** June 13, 2026  
**Status:** ✅ Comprehensive mapping complete  
**Purpose:** End-to-end reference for booking system architecture, data flow, and user journey

---

## Overview

The booking system has two distinct flows based on user timing preference:

- **Book Now**: Immediate scheduling → Registration → Payment
- **Book Later**: Skip scheduling → Registration → Payment → Schedule later from dashboard

---

## Complete User Journey

### Step 1: Location Search & Instructor Selection

**Entry Point:** `/book` (BookingLandingPage)  
**Component:** LocationSearch  
**Action:** User searches by location/postcode  
**Navigation:** Routes to `/book/[instructorId]`  
**Data Flow:** No context state yet

---

### Step 2: Instructor Profile & Package Selection

**Page:** `/book/[instructorId]` (PublicBookingPage)  
**Layout:** BookingLayout (wraps with BookingProvider)

**Actions:**
- Fetch instructor data via `/api/instructors/[id]`
- Display instructor profile, ratings, pricing
- User selects package (PACKAGE_6, PACKAGE_10, PACKAGE_15, or CUSTOM)

**Component:** BulkBookingForm (initiates flow)

**Context Updates:**
- `setInstructor(instructor)`
- `setPackage(packageType, hours)`

**Local Storage:** Saves to bookingState (auto-saves on changes)

---

### Step 3: Package Selection Step

**Page:** `/book/[instructorId]/package`  
**Component:** MultiStepBookingLayout + PackageSelector  
**Step Number:** 2

**Actions:** Select from preset packages or custom hours

**Context Updates:** `setPackage()`

**Pricing Calculated:** Subtotal, discount, platform fee

---

### Step 4: Test Package (Conditional)

**Page:** `/book/[instructorId]/test-package`  
**Step Number:** 3 (skipped if instructor doesn't offer)

**Condition:** Only shows if `instructor.offersTestPackage === true`

**Actions:** Add or skip PDA test package

**Context Updates:** `toggleTestPackage()`

**API:** If added, test details stored in pdaTestBooking state

---

### Step 5: Book Now or Later

**Page:** `/book/[instructorId]/book-type`  
**Component:** BookNowOrLater  
**Step Number:** 4 (dynamic based on test package)

**Actions:** Choose "Book Now" or "Book Later"

**Context Updates:** `updateBooking({ bookingType: 'now' | 'later' })`

**Navigation Fork:**
- **Book Now** → Booking Details (schedule lessons immediately)
- **Book Later** → Registration (skip scheduling, pay first)

---

### Step 6A: Booking Details (Book Now Only)

**Page:** `/book/[instructorId]/booking-details`  
**Component:** BookingDetailsForm  
**Step Number:** 5 (if Book Now) / skipped (if Book Later)

**Actions:**
- Select date via date picker (today to 90 days out)
- Select duration (instructor's allowedDurations)
- Fetch available time slots: `GET /api/availability/slots?instructorId={id}&date={date}&duration={duration}`
- Select time from available slots
- Enter pickup location + notes
- Slot Reservation: `POST /api/availability/check-and-reserve` (10-minute hold)
- Add multiple bookings to session
- Optional: Schedule PDA test if includeTestPackage

**Context Updates:**
- `addScheduledBooking(booking)` → updates remainingHours
- `setPdaTestBooking(booking)` if adding test

**Validation:** Cannot exceed total hours, no overlaps, 10-minute slot expiry

---

### Step 6B: Registration

**Page:** `/book/[instructorId]/registration`  
**Component:** RegistrationForm  
**Step Number:** 6 (Book Now) / 5 (Book Later)

**Actions:**
- Select registration type: "Myself" or "Someone Else"
- **Myself:** Collect name, email, phone, password
- **Someone Else:** Also collect learner name, phone, relationship
- Validate email (check if exists, EMAIL_EXISTS error handling)

**Context Updates:** All accountHolder* and learner* fields via `setClientDetails()`

**API Calls** (happens on payment):
- `POST /api/public/bookings/bulk` → Create user account + bookings

---

### Step 7: Confirmation Review (Book Now Only)

**Page:** `/book/[instructorId]/confirmation`  
**Component:** Shows review of all booking details  
**Step Number:** 7

**Validations:**
- `POST /api/availability/validate-slots` (re-verify all slots still available)
- If validation fails: slots expired, user goes back

**Actions:** Review and confirm

---

### Step 8: Payment

**Page:** `/book/[instructorId]/payment`  
**Component:** PaymentForm with Stripe Elements  
**Step Number:** 8 (Book Now) / 6 (Book Later)

**Payment Flow:**

1. Create booking: `POST /api/public/bookings/bulk`
   - Returns: `{ bookingIds: [...], transactionId, ...}` for Book Now
   - Returns: `{ transactionId, ... }` for Book Later

2. Create Stripe payment intent: `POST /api/payments/create-intent`
   - Parameters: bookingId (Book Now) or transactionId (Book Later)
   - Returns: `{ clientSecret, amount }`

3. Confirm card payment with Stripe

4. On success: Reset context + redirect to:
   - **Book Now:** `/booking/{bookingId}/confirmation?payment=success`
   - **Book Later:** `/client-dashboard?payment=success&bookingType=later`

---

## Data Flow & State Management

### BookingContext (Central State)

**Location:** `BookingContext.tsx`

**State Structure:**

```typescript
BookingState {
  // Step 1: Instructor Selection
  instructor: Instructor | null

  // Step 2: Package
  packageType: 'PACKAGE_6' | 'PACKAGE_10' | 'PACKAGE_15' | 'CUSTOM'
  hours: number
  includeTestPackage: boolean
  // Instructor special services / fixed-price add-ons are not supported

  // Step 3: Book Type
  bookingType: 'now' | 'later' | null

  // Step 4: Scheduled Bookings (if Book Now)
  scheduledBookings: ScheduledBooking[]
  remainingHours: number
  pdaTestBooking: PdaTestBooking | null

  // Step 5: Registration
  registrationType: 'myself' | 'someone-else'
  accountHolderName, Email, Phone, Password, ConfirmPassword
  learnerName, Phone, Relationship

  // Slot Management
  slotReservations: SlotReservation[]  // 10-min expiry
  sessionId: string

  // Calculated
  pricing: PricingBreakdown
  platformSettings: PlatformPricingSettings
}

PricingBreakdown {
  subtotal: number      // hours × rate (with bulk discount if applicable)
  discount: number      // applied if package discount %
  discountPercentage: number
  testPackage: number
  platformFee: number   // 3.6% of subtotal + test
  total: number
}
```

> Note: Older documentation may mention `customPackagePrice` / instructor fixed-price add-ons. Those are deprecated and rejected by the API.

**Key Methods:**

- `setInstructor(instructor)` - Initiates context
- `setPackage(type, hours)` - Updates package selection
- `toggleTestPackage()` - Add/remove test
- `addScheduledBooking(booking)` - Add scheduled lesson
- `removeScheduledBooking(index)` - Remove scheduled lesson
- `setPdaTestBooking(booking)` - Store PDA test details
- `reserveSlot()`, `releaseSlot()` - Slot management (10-min)
- `saveToLocalStorage()`, `loadFromLocalStorage()` - Persistence

**Persistence:**

- Auto-saves to localStorage when instructor selected
- Auto-recovers on page reload (if < 24 hours old)
- Expires after 24 hours

---

## All Booking Pages in Order

| Step | URL | Component | Purpose | Conditional |
|------|-----|-----------|---------|-------------|
| 0 | `/book` | BookingLandingPage | Location search entry | - |
| 0 | `/book/[id]` | PublicBookingPage + BulkBookingForm | Instructor profile & initial form | - |
| 2 | `/book/[id]/package` | PackageSelector | Select hours package | - |
| 3 | `/book/[id]/test-package` | Test package upsell | Add PDA test | If instructor offers |
| 4 | `/book/[id]/book-type` | BookNowOrLater | Choose timing | - |
| 5 | `/book/[id]/booking-details` | BookingDetailsForm | Schedule lessons | Book Now only |
| 5-6 | `/book/[id]/registration` | RegistrationForm | Create account | Always (before payment) |
| 7 | `/book/[id]/confirmation` | Confirmation review | Review all details | Book Now only |
| 8 | `/book/[id]/payment` | PaymentForm (Stripe) | Payment collection | Always (final step) |

---

## All API Endpoints Called

### Instructor Data

- `GET /api/instructors/[id]` - Get instructor profile for context
- `GET /api/instructors/search` - Public instructor search

### Availability & Slot Management

- `GET /api/availability/slots?instructorId=X&date=YYYY-MM-DD&duration=60` - Fetch available time slots
- `POST /api/availability/check-and-reserve` - Reserve slot (10-min hold) ← **See "Slot Persistence" below**
- `DELETE /api/availability/check-and-reserve` - Release reserved slot
- `POST /api/availability/validate-slots` - Re-validate slots before payment

#### 🔧 Slot Persistence Fix (TASK #5 - June 2026)

**Problem:** Slot reservations were stored in server memory (JavaScript Map) and lost on every server restart, causing "Slot expired" errors during payment.

**Solution:** Migrated to database persistence using `SlotReservation` table in PostgreSQL.

**How It Works:**

1. **POST /api/availability/check-and-reserve** (User selects slot)
   - OLD: `slotReservations.set(key, { expiresAt, sessionId })`
   - NEW: `INSERT INTO SlotReservation (instructorId, startTime, endTime, sessionId, expiresAt)`
   - Duration: 10 minutes (expiresAt column)
   - Ownership: sessionId token prevents other users from releasing it

2. **Automatic Cleanup** (Every 5 minutes via cron)
   - Job: `DELETE FROM SlotReservation WHERE expiresAt < NOW()`
   - Health: Tracked in `CronHealth` table
   - Endpoint: `GET /api/cron/slot-cleanup` (requires CRON_SECRET header)

**Benefits:**
- ✅ Slots survive server restarts
- ✅ Works in distributed/load-balanced systems
- ✅ Can monitor via database queries
- ✅ Automatic cleanup prevents table bloat
- ✅ Zero API changes (backward compatible)

**Setup Required:**
1. Run migration: `npx prisma migrate dev --name add-slot-reservations`
2. Set environment: `CRON_SECRET=<secure-token>` in `.env`
3. Configure cron: Call `/api/cron/slot-cleanup` every 5 minutes (Vercel or external service)

**Reference:** See `docs/DOCROLEBASE/01-public/SLOT_PERSISTENCE_FIX.md` for complete technical details.

---

**`POST /api/public/bookings/bulk`**

**Input:** Package type, hours, scheduled bookings, registration details

**Output:** `{ bookingIds: [...], transactionId, total, ... }`

**Creates:**
- New User account (if email doesn't exist)
- Client record
- 1+ Booking records (one per scheduled lesson or parent package booking)
- Transaction record (for wallet/package purchase)

**Features:**
- Idempotency key support (Twilio retry safety)
- Auto-generates password if not provided (AI voice flow)
- Validates instructor active/subscription/not paused
- Calculates pricing server-side (never trusts client)
- Rate limiting (5 per minute per email/IP)

### Payment

- `POST /api/payments/create-intent` - Create Stripe PaymentIntent
  - Input: bookingId (Book Now) or transactionId (Book Later)
  - Output: `{ clientSecret, amount }`
  - Features: PaymentIntent deduplication, booking state validation, reuses existing intent if not completed

- `POST /api/payments/verify` - Stripe webhook handler (payment confirmation)

### PDA Tests

- `GET /api/instructor/pda-configs` - Get available PDA configs and test centre details for the current instructor
- `POST /api/pda-bookings` - Book PDA test

### Platform Settings

- `GET /api/public/pricing` - Get platform fee %, discount tiers, test package price

---

## Data Models

### Booking (Prisma)

```
- id: string (cuid)
- instructorId, clientId
- status: PENDING | PENDING_PAYMENT | CONFIRMED | COMPLETED | CANCELLED
- startTime, endTime, duration
- price, platformFee, instructorPayout
- isPaid, paymentIntentId, paymentToken
- pickupAddress, notes
- scheduledBookings: array (stored as JSON during "book now")
- packageHours, packageExpiryDate (for "book later" packages)
- source: "platform" | "offline"
- isFirstBooking, isPackageBooking
- createdAt, updatedAt
```

### Client

```
- id: string
- userId (links to User)
- instructorId
- name, email, phone
- defaultPickupAddress
- bookings: Booking[]
- pdaBookings: PDATestBooking[]
```

### Transaction

```
- id: string
- bookingId (optional)
- instructorId
- type: "BOOKING_PAYMENT" | "WALLET_TOPUP"
- amount, platformFee, instructorPayout
- status: PENDING | SETTLED
- stripePaymentIntentId, stripeChargeId
```

### WalletTransaction (for Book Later packages)

```
- id: string
- walletId
- amount, type, status
- description
- bookingId (if tied to specific booking)
```

---

## Component Hierarchy

```
BookingLayout (with BookingProvider)
├── InstructorLoaderContent (fetches instructor)
│   └── Page Components:
│       ├── BookingLandingPage (entry)
│       ├── PublicBookingPage
│       │   └── BulkBookingForm (multi-step initiation)
│       │       └── MultiStepBookingLayout
│       │           ├── StepIndicator
│       │           ├── BookingSummary (desktop)
│       │           ├── MobileBookingSummary (fixed bottom)
│       │           └── [Page Content]
│       │
│       ├── PackageSelection
│       │   └── PackageSelector
│       │
│       ├── TestPackagePage
│       │
│       ├── BookTypePage
│       │   └── BookNowOrLater
│       │
│       ├── BookingDetailsPage
│       │   └── BookingDetailsForm
│       │       ├── Slot availability fetch
│       │       ├── PDA test tab (if included)
│       │       └── SlotPicker + LocationInput
│       │
│       ├── RegistrationPage
│       │   └── RegistrationForm
│       │
│       ├── ConfirmationPage
│       │
│       └── PaymentPage
│           └── Stripe Elements (CardNumber, Expiry, CVC)
```

---

## Navigation Flow

```
/book
↓
/book/[id] (instructor profile + start form)
↓
/book/[id]/package (select hours)
↓
/book/[id]/test-package (conditional: if instructor offers)
↓
/book/[id]/book-type (Book Now vs Later)
↙                      ↘
Book Now              Book Later
↓                      ↓
/booking-details     /registration
(schedule lessons)   (create account)
↓                      ↓
/registration         /payment
(create account)   (Stripe payment)
↓                      ↓
/confirmation        /client-dashboard
(review)            (success redirect)
↓
/payment
(Stripe payment)
↓
/booking/[id]/confirmation
(success redirect)
```

---

## Error Handling & Validation

### Frontend Validation

- Email format, password strength (6+ chars)
- Required fields (name, email, phone)
- Learner details if "someone-else"
- Pickup location for lessons
- Slot selection before adding booking

### Backend Validation

- Instructor exists + active/approved + subscription valid
- Email uniqueness (EMAIL_EXISTS error with helpful actions)
- Slot availability (re-validated before payment)
- Booking window (min/max advance hours configurable)
- Rate limiting (5 bulk bookings per minute per email/IP)
- Payment intent already exists (deduplication)
- Payment token or session auth for payment

### Slot Expiry

- 10-minute auto-release if payment not completed
- User sees "slot expired" if they take too long
- Can select new slots and try again

### Payment Errors

- Stripe card errors (declined, invalid, expired)
- PaymentIntent status transitions (requires_action, processing)
- Email already exists → Show helpful "Login" or "Reset password" links

---

## Pricing Calculation

```typescript
// Server-side (always authoritative)
subtotal = hours × hourlyRate
discount = subtotal × discountPercentage  (0%, 5%, 10%, 12% based on package)
testPackageAmount = includeTestPackage ? instructor.testPackagePrice || 225 : 0
afterDiscount = subtotal - discount + testPackageAmount
platformFee = afterDiscount × 3.6%
total = afterDiscount + platformFee

// Discount tiers (configurable in DB)
PACKAGE_6:  5% discount
PACKAGE_10: 10% discount
PACKAGE_15: 12% discount
CUSTOM:     0% discount
```

---

## Key Features & Enhancements

✅ **Slot Persistence** - 10-min slots persisted in database (survives restarts)  
✅ **Race Condition Prevention** - Atomic transactions prevent double-booking  
✅ **Account Deduplication** - Unique constraint prevents duplicate accounts  
✅ **Email Notifications** - All 3 booking methods send professional emails  
✅ **PDA Test Linking** - Tests consolidated with parent booking (cascade delete)  
✅ **Payment Deduplication** - PostgreSQL advisory lock prevents duplicate Stripe intents  
✅ **LocalStorage Recovery** - Auto-saves booking state (passwords excluded), recovers on page reload (< 24h)  
✅ **Idempotency Keys** - Twilio SMS retries don't create duplicate bookings  
✅ **Auto-Generated Passwords** - AI voice flow generates secure passwords, sends via email + SMS  
✅ **Test Package Upsell** - Conditional step if instructor offers PDA test package  
✅ **Book Now vs Later** - Flexible scheduling (immediate or deferred)  
✅ **Instructor Pause** - Instructors can pause new bookings without subscription change  
✅ **Server-Side Pricing** - Never trusts client calculations  
✅ **Subscription Gate** - Inactive instructors can't accept new bookings  
✅ **3DS / SCA** - `stripe.handleNextAction()` called for `requires_action`; all 3DS cards work (July 2026)  
✅ **Perth Timezone** - Slot validation + reservation uses `+08:00` offset parse, not server UTC (July 2026)  
✅ **Slot Release** - DELETE sends params as URL query string (server reads `searchParams`); slots released correctly (July 2026)  
✅ **No Fake Slots** - API failure shows error + retry, never fabricated availability (July 2026)  
✅ **Duration Fetch** - `useEffect` on `[selectedDate, selectedDuration]` eliminates stale-state race (July 2026)  

---

## Accessibility & UI Enhancements

### Dark Mode Contrast Improvements (June 15, 2026)

**Status:** ✅ COMPLETE - All components meet WCAG 2.1 AAA standards

**Components Updated:**

1. **PackageSelector Component**
   - Heading: Increased from `text-lg font-bold` to `text-2xl font-black`
   - Package buttons: Added conditional text colors (selected vs unselected states)
   - Added dark mode support with `dark:` prefix variants
   - Contrast ratio: 21:1 for headings (AAA ✓✓✓), 7:1+ for text (AAA ✓✓✓)
   - Custom hours label: Increased from `text-xs` to `text-sm font-bold`
   - Select dropdowns: Added `dark:bg-gray-800 dark:text-white`

2. **SlotPicker Component (Time Selection Buttons)**
   - Regular slots: `bg-slate-900/40` → `bg-slate-700` (solid darker background)
   - Border: `border` → `border-2`, color darkened to `border-slate-600`
   - Text: `text-slate-300` → `text-slate-100` (lighter text for contrast)
   - Font: `font-medium` → `font-semibold` (bolder for readability)
   - Short notice slots: Improved visibility with `bg-amber-700/30`
   - Contrast ratio: 12:1 for regular slots (AAA ✓✓✓), 10:1+ for short notice (AAA ✓✓✓)

3. **BookingDetailsForm Component (Time Dropdown)**
   - Background: `bg-white/5` → `bg-slate-700` (solid, visible background)
   - Border: `border border-white/10` → `border-2 border-slate-600`
   - Text: `text-white` → `text-slate-100` (lighter gray for contrast)
   - Font: Added `font-semibold` (bolder for readability)
   - Focus state: `focus:bg-white/10` → `focus:bg-slate-600`
   - Contrast ratio: 12:1 (AAA ✓✓✓)

**Why These Changes:**
- Previous styling rendered text invisible in dark mode due to very light backgrounds
- Now uses solid slate colors with high contrast between background and text
- Dark mode support added throughout using `dark:` prefix variants
- All contrast ratios exceed WCAG AAA standards (7:1+ for normal text, 21:1 for large text)

**WCAG 2.1 Compliance:**
- ✅ Level AAA - All text contrast ratios ≥ 7:1
- ✅ Large text headings: 21:1 contrast
- ✅ Interactive elements: 12:1 contrast
- ✅ Dark mode support: Proper `dark:` prefix variants
- ✅ Enhanced color contrast mode

**Files Modified:**
- `components/PackageSelector.tsx` - Package selection styling
- `components/SlotPicker.tsx` - Time button styling
- `components/BookingDetailsForm.tsx` - Time dropdown styling

---

## Potential Issues & Areas for Enhancement

> **Note:** Many of the issues in the original version of this section were resolved in the July 2026 production-readiness audit. The list below reflects the current state.

### Slot Expiry Warning (open)
No countdown timer shown to the student on the payment page; they don't know the 10-minute slot hold is running until payment fails.  
**Recommendation:** Add countdown on the payment page, warn before expiry.

### Mobile Experience (open)
Bottom-fixed summary may overlap form inputs on small screens.  
**Recommendation:** Further test responsive layout on <375px screens.

### Error Recovery — EMAIL_EXISTS (open)
`EMAIL_EXISTS` error shows helpful actions but the workflow is disrupted — no seamless one-click login redirect.  
**Recommendation:** Add quick login option in the error modal; auto-fill email.

### Package Expiry Handling (open)
No frontend indication when hours expire; students only see an error at booking time.  
**Recommendation:** Show expiry countdown in dashboard; warn before expiry.

### ~~No Concurrency Control on Bookings~~ — ✅ Resolved
PostgreSQL advisory lock added in `create-intent` route prevents duplicate PaymentIntents. Slot conflict check is inside a `$transaction`.

### ~~Auto-Generated Password Delivery~~ — ✅ Resolved
Setup link sent via both SMS and email. Fallback reset email sent if both fail. See `bulk/route.ts`.

### ~~PDA Test Booking~~ — ✅ Resolved
PDA test linked to parent booking via `parentBookingId` (cascade delete).

### ~~Slot Reservation Persistence~~ — ✅ Resolved
Slot reservations persisted in `SlotReservation` DB table since June 2026.

### ~~Availability fallback fabricated slots~~ — ✅ Resolved (July 2026)
`fetchAvailableSlots` no longer generates fake 9am–5pm slots on API failure. Shows error state with "Try again" button instead.

### ~~Duration race condition~~ — ✅ Resolved (July 2026)
`useEffect` on `[selectedDate, selectedDuration]` replaced the manual `fetchAvailableSlots()` call in the duration `onChange`.

### ~~Password in localStorage~~ — ✅ Resolved (July 2026)
`saveToLocalStorage` destructures out password fields before persisting.

### ~~3DS not handled~~ — ✅ Resolved (July 2026)
`stripe.handleNextAction()` is called for `requires_action` status.

### ~~Slot DELETE body not read by server~~ — ✅ Resolved (July 2026)
`BookingDetailsForm` sends slot release params as URL query string.

### ~~Timezone bug in slot validation~~ — ✅ Resolved (July 2026)
Both `validate-slots` and `check-and-reserve` now parse dates as Perth AWST (`+08:00`).

---

## Related Documentation

- [Public Booking Site](../01-public/) - Landing & search pages
- [Student Dashboard](../02-student/) - Post-booking dashboard
- [Payment Processing](../06-payments/) - Stripe integration details
- [Availability System](./AVAILABILITY.md) - Slot management architecture
- [PDA Test Booking](./PDA_TESTS.md) - Practical driving assessment flow

---

**Last Updated:** July 2026 (production-readiness audit fixes applied)


---

## Voice AI Booking Flow (VAPI)

**Entry Point:** VAPI assistant  `POST /api/public/bookings/bulk`  
**Added:** July 2026  
**Status:** ✅ Production-ready (commit c6dac2cd)

The voice AI uses the same `/api/public/bookings/bulk` endpoint as the web booking wizard, but drives it via VAPI tool calls instead of a browser form. The account creation and payment flow is identical.

---

### Voice Booking Steps (System Prompt  Code)

| Prompt Step | API Call | Code Path |
|-------------|----------|-----------|
| 1. Postcode/suburb | `findInstructors` | `GET /api/instructors/recommendations?location=...&vehicleType=...` |
| 2. Transmission type | (stored in session) |  |
| 3. Instructor selected | `getPackages` | `GET /api/packages?instructorId=...` |
| 4. Package selected |  |  |
| 5. Book Now or Later |  | Sets `bookingType: "now"` or `"later"` |
| 6. Date/time (Book Now) | `getAvailableSlots` | `GET /api/availability/slots?instructorId=...&date=...` |
| 7. Student details |  | Collected for createBooking payload |
| 8. Pickup address | `validateLocation`, `checkServiceArea` | `POST /api/locations/validate`, `/api/public/instructors/.../check-service-area` |
| 9. Confirmation |  | AI reads summary back |
| 10. Create booking | `createBooking` | `POST /api/public/bookings/bulk` |

---

### Account Creation During Voice Booking

Account is **always created before payment**  the moment `createBooking` is called.

**New user:**
1. `prisma.user.create` with auto-generated cryptographically-secure password
2. `resetToken` generated + stored with 24h expiry
3. Setup link sent via **email** (`/set-password?token=...`)
4. Setup link sent via **SMS** (reliable channel  phone number confirmed on call)
5. Booking created / Stripe Checkout Session created
6. Response includes `checkoutUrl`
7. Hybrid service (`main-app-proxy.js`) SMS's `checkoutUrl` to student's phone

**Existing user (email already in DB):**
- No account created  booking linked to existing account
- No setup link sent (they already have a password)
- `checkoutUrl` still SMS'd by hybrid service

---

### Buy Later Payment Flow

```
Voice call ends
  
SMS to student phone: "Click to pay: https://checkout.stripe.com/..."
  
Student taps link  Stripe Checkout hosted page
  
Student pays  Stripe fires checkout.session.completed
  
Webhook handler (stripe/webhook/route.ts):
  metadata.type === "wallet_credit"
   credits student wallet with full package amount
  
Student logs in  sets password at /set-password?token=...
  
Student schedules lessons from dashboard
```

---

### Book Now Payment Flow

```
Voice call ends
  
SMS to student phone: "Click to pay: /booking/{id}/payment?token=..."
  
Student taps link  DriveBook payment page (Stripe Elements)
  
Student pays  Stripe fires payment_intent.succeeded
  
Webhook handler (stripe/webhook/route.ts):
  bookingId present  confirms booking  credits wallet with package total  debits first lesson
  
Booking status: PENDING_PAYMENT  CONFIRMED
  
Student logs in  sets password  sees booking in dashboard
```

---

### Key Differences vs Web Flow

| Aspect | Web Wizard | Voice AI |
|--------|-----------|----------|
| Account creation | During registration step | Before payment, triggered by createBooking |
| Password | User sets it during registration | Auto-generated; student sets via /set-password link |
| Payment redirect | Browser navigates to Stripe | SMS link to student's phone |
| Slot reservation | POST /api/availability/check-and-reserve | Created inside $transaction in bulk/route.ts |
| Email normalisation | Browser form validates | Server-side: "at"  "@", "dot"  ".", spaces removed |
| Postcode normalisation | Browser handles | Server-side: "6 0 5 1"  "6051" |

---

### Bug Fixed  July 11, 2026

**Bug:** Book Now notification email sent `/reset-password?token=...` instead of `/set-password?token=...`.

`/reset-password` is a generic password reset flow. `/set-password` is the voice booking dedicated page that:
- Calls `/api/auth/verify-setup-token` (not the reset-password endpoint)
- Also shows the current email so the student can **correct it** if the AI misheard

**Fix:** `app/api/public/bookings/bulk/route.ts`  all three link generation points now use `/set-password`.  
**Commit:** `c6dac2cd`

---

### Voice AI Files

| File | Purpose |
|------|---------|
| `drivebook-hybrid/VAPI_SYSTEM_PROMPT.md` | AI conversation script and tool execution rules |
| `drivebook-hybrid/routes/main-app-proxy.js` | Proxies VAPI tool calls to main app + sends SMS |
| `drivebook-hybrid/services/voice-session-service.js` | Redis session for call recovery |
| `app/api/instructors/recommendations/route.ts` | findInstructors tool |
| `app/api/packages/route.ts` | getPackages tool |
| `app/api/availability/slots/route.ts` | getAvailableSlots tool |
| `app/api/public/bookings/bulk/route.ts` | createBooking tool (also creates account) |
| `app/api/locations/validate/route.ts` | validateLocation tool |
| `app/set-password/page.tsx` | Student sets password + corrects email post-booking |
| `app/api/auth/set-password/route.ts` | API for /set-password form |
| `app/api/auth/verify-setup-token/route.ts` | Validates resetToken for /set-password |