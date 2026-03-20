# DriveBook Subdomain / White-Label Booking System

**Last Updated:** March 2026 (revised — SEO meta, trust badges, FAQ accordion added)  
**Scope:** Instructor public booking pages — how they work today, how they should work, and how to set one up

---

## 1. What & Why

Every instructor on DriveBook can have a public booking page that requires no login from the student. The page shows the instructor's profile, pricing, reviews, and a full booking form. Students can book and pay directly without ever creating an account first (an account is created for them automatically).

This is the "white-label" or "subdomain" feature. The goal is to give instructors a shareable link they can put in their Instagram bio, WhatsApp status, or Google Business profile — and have students book in under 2 minutes.

---

## 2. How It Works Today (Path-Based, Not True Subdomain)

### Current URL structure

```
https://drivebook.com.au/subdomain/john-smith
```

This is a **path-based** route, not a true subdomain. The instructor sets a `customDomain` slug (e.g. `john-smith`) and the page is served at `/subdomain/[slug]`.

### Routing

```
next.config.js
  └── No middleware-based subdomain routing (see Section 12)

app/subdomain/[slug]/page.tsx
  └── Looks up instructor by: prisma.instructor.findFirst({ where: { customDomain: slug } })
  └── 404 if no instructor has that slug
```

### What the branding dashboard shows vs. reality

The branding dashboard (`/dashboard/branding`) displays the URL as:

```
john-smith.drivebook.com.au
```

This is **aspirational** — the actual live URL is `/subdomain/john-smith`. True subdomain routing requires DNS wildcard + Next.js middleware (see Section 12). The copy/share button in the dashboard copies the subdomain URL format, which will not work until middleware is implemented.

---

## 3. Page Anatomy

**File:** `app/subdomain/[slug]/page.tsx`

The page is a Next.js Server Component (`force-dynamic`) that renders:

```
┌─────────────────────────────────────────────────────────┐
│ Nav bar                                                 │
│  [Logo or Car icon]  [Instructor name or "DriveBook"]   │
│  [WhatsApp button]   [Login button]                     │
├─────────────────────────────────────────────────────────┤
│ Hero banner (gradient using brand colors)               │
│  [Profile photo]  [Name]  [Star rating]                 │
│  [Service areas]  [Years exp]  [Next available]         │
├─────────────────────────────────────────────────────────┤
│ Trust badges strip (between hero and content)           │
│  ✅ Verified  🏆 X+ Years  ⭐ Rating  🔒 Secure Booking │
├──────────────────────┬──────────────────────────────────┤
│ Left column          │ Right column                     │
│                      │                                  │
│ Next availability    │ [Location pre-fill banner]       │
│ About / bio          │                                  │
│ Pricing              │ Booking form (BulkBookingForm)   │
│  - Single lesson     │                                  │
│  - Package options   │ Student reviews                  │
│ Details              │                                  │
│  - Vehicle types     │                                  │
│  - Languages         │                                  │
│  - Buffer time       │                                  │
│  - Verified badge    │                                  │
│  - Phone             │                                  │
│ Social links         │                                  │
│ Vehicle photo        │                                  │
│ FAQ accordion        │                                  │
│  "Before You Book"   │                                  │
├─────────────────────────────────────────────────────────┤
│ Footer                                                  │
│ Sticky mobile "Book a Lesson" button (after scroll)     │
└─────────────────────────────────────────────────────────┘
```

### Data fetched server-side

| Data | Source |
|---|---|
| Instructor profile | `prisma.instructor.findFirst({ where: { customDomain: slug } })` |
| Recent reviews | `prisma.booking.findMany` — completed bookings with `clientRating != null`, last 5 |
| Next available slot | Computed from `workingHours` + upcoming `CONFIRMED`/`PENDING` bookings (14-day window) |
| Active packages | `instructor.lessonPackages` filtered by `isActive !== false` |

### SEO meta tags

`generateMetadata()` runs server-side and exports:

- `<title>` — `"Book Driving Lessons with [Name]"`
- `<description>` — instructor bio (truncated to 155 chars) or a generated fallback with location + rate
- OpenGraph tags — title, description, profile image (for WhatsApp/Facebook link previews)
- Twitter card — `summary` type with image

This means Google can index the page and sharing the link on WhatsApp/Instagram shows a proper preview card instead of a blank link.

---

## 4. Branding Tiers

| Feature | BASIC | PRO | BUSINESS |
|---|---|---|---|
| Public booking page | ✅ | ✅ | ✅ |
| Custom slug / URL | ✅ | ✅ | ✅ |
| Custom logo | ❌ | ✅ | ✅ |
| Custom brand colors | ❌ | ✅ | ✅ |
| White-label nav (hide "DriveBook") | ❌ | ✅ | ✅ |
| Social links on page | ✅ | ✅ | ✅ |

**Logic in `app/subdomain/[slug]/page.tsx`:**

```typescript
const isPro = instructor.subscriptionTier === 'PRO' || instructor.subscriptionTier === 'BUSINESS';
const hasBranding = isPro && instructor.showBrandingOnBookingPage;

// Nav shows instructor name only if hasBranding, otherwise shows "DriveBook"
// Logo shows brandLogo only if hasBranding, otherwise shows Car icon
// Colors fall back to #3B82F6 / #10B981 if not set
```

BASIC instructors get the page but it shows "DriveBook" branding. PRO/BUSINESS instructors who have enabled `showBrandingOnBookingPage` get their own logo and colors.

---

## 5. BulkBookingForm — Step by Step

**File:** `components/BulkBookingForm.tsx`

The form has either 4 or 5 steps depending on whether the instructor has service area data configured:

```
With service area:    Package → Service Area → Time Slot → Your Details → Confirm
Without service area: Package → Time Slot → Your Details → Confirm
```

### Step 1: Package

- Single/Custom: choose exact hours, no discount
- PACKAGE_6: 6 hours, discount applied
- PACKAGE_10: 10 hours, "POPULAR" badge
- PACKAGE_15: 15 hours, "BEST VALUE" badge
- Optional add-on: Driving Test Package (+fixed price)
- Live order summary shows subtotal, discount, platform fee (3.6%), total, and Afterpay installments

Package pricing is calculated by `lib/config/packages.ts` → `calculatePackagePrice()`.

### Step 2 (conditional): Service Area

Only shown if instructor has `baseAddress` + `serviceRadiusKm` set.

- Shows instructor's listed service areas (text)
- If `baseAddress` + `serviceRadiusKm` are set: geocodes the student's address using Google Maps Geocoding API (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) and computes haversine distance
- Result: `in` (green), `out` (amber warning — can still proceed), or `skipped`
- Student can skip the check entirely

This check is **client-side only** — it is advisory, not enforced server-side.

### Step 3: Time Slot

- Uses `SlotPicker` component (`components/SlotPicker.tsx`)
- Fetches available slots from `GET /api/availability/slots?instructorId=...&date=...&duration=60&bypassDurationCheck=true`
- 7-day calendar view with week navigation
- Shows only available (non-blocked) time slots
- For packages: copy says "Schedule Your First Lesson" — remaining lessons are booked after payment from the client dashboard

### Step 4: Your Details

- Name, phone, email, pickup address, notes
- Email is checked on blur via `POST /api/auth/check-email`
- **Existing email handling:** if the email already has a DriveBook account, the form shows a warning with two explicit choices:
  - "Login to my account" — link to `/login`
  - "Continue anyway" — proceeds, booking linked to existing account, no password required
- New users: password + confirm password fields appear (min 6 chars)
- Existing users who choose "Continue anyway": password fields hidden, booking links to their account

### Step 5: Confirm

- Summary of package, slot, details, and total
- "Pay Now" button → `POST /api/public/bookings/bulk`
- On success → redirect to `/{mainHost}/booking/{bookingId}/payment`

**Redirect logic** strips the subdomain from `window.location.host` to build the payment URL on the main domain:

```typescript
const host = window.location.host;
const parts = host.split('.');
const mainHost = parts.length > 1 && !parts[0].includes(':')
  ? parts.slice(1).join('.')
  : host;
window.location.href = `${window.location.protocol}//${mainHost}/booking/${data.bookingId}/payment`;
```

This is designed for when true subdomain routing is live. Currently (path-based), `window.location.host` is the same for all pages so the redirect works correctly as-is.

---

## 6. Booking Submission Flow

```
Student clicks "Pay Now"
        │
        ▼
POST /api/public/bookings/bulk
  ├── Rate limit (IP + email + instructorId)
  ├── Validate instructor exists
  ├── Create or link user account
  ├── Find or create Client record
  ├── Calculate pricing:
  │     booking.price = 1hr × hourlyRate  (first lesson only)
  │     packageTotalPaid = pricing.total  (full Stripe charge)
  ├── Atomic slot claim ($transaction):
  │     conflict check → if taken → 409
  │     booking.create with status: PENDING_PAYMENT
  └── Return { bookingId, total }
        │
        ▼
Redirect to /booking/{bookingId}/payment
        │
        ▼
GET /api/public/bookings/{bookingId}
  └── Returns booking details + packageTotalPaid || price as charge amount
        │
        ▼
POST /api/payments/create-intent
  └── Creates Stripe PaymentIntent for packageTotalPaid
        │
        ▼
Student pays via Stripe Elements
        │
        ▼
POST /api/stripe/webhook (payment_intent.succeeded)
  ├── Idempotency check
  ├── EXPIRED recovery (revive if cron beat the webhook)
  ├── booking.status → CONFIRMED, isPaid = true
  ├── Wallet CREDIT = packageTotalPaid
  └── Wallet DEBIT = booking.price (first lesson)
```

Remaining wallet balance = `packageTotalPaid − booking.price` — available for future lessons from the client dashboard.

---

## 7. SlotPicker & Availability

**File:** `components/SlotPicker.tsx`  
**API:** `GET /api/availability/slots`

- Renders a 7-day calendar with week navigation
- Fetches slots per day on date selection
- Only shows `available: true` slots
- Availability service blocks `PENDING`, `PENDING_PAYMENT`, and `CONFIRMED` bookings
- Slot duration is always 60 minutes on the subdomain form

---

## 8. APIs Involved

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/public/bookings/bulk` | POST | Create booking + user account |
| `/api/public/bookings/[id]` | GET | Fetch booking for payment page |
| `/api/payments/create-intent` | POST | Create Stripe PaymentIntent |
| `/api/stripe/webhook` | POST | Handle payment confirmation |
| `/api/availability/slots` | GET | Fetch available time slots |
| `/api/auth/check-email` | POST | Check if email already registered |
| `/api/instructor/branding` | GET/PUT | Read/write branding settings |
| `/api/instructor/subdomain/check` | GET | Check if slug is available |
| `/api/cron/cleanup-expired-bookings` | GET | Expire unpaid PENDING_PAYMENT slots |

---

## 9. Instructor Setup Guide

### Step 1: Set your slug

1. Go to **Dashboard → Brand & Public Page** (`/dashboard/branding`)
2. Enter a slug in the "Your Booking URL" field (e.g. `john-smith`)
   - Lowercase letters, numbers, hyphens only
   - 3–30 characters
   - Must be unique across all instructors
3. The system checks availability in real time
4. Click **Save All Settings**

Your page is immediately live at:
```
https://drivebook.com.au/subdomain/john-smith
```

### Step 2: Configure your profile (affects what shows on the page)

These fields are shown on the booking page — fill them in via **Dashboard → Profile**:

- Profile photo
- Bio
- Service areas (text description)
- Base address + service radius (for the distance check)
- Vehicle types, languages
- Booking buffer minutes
- Car photo, make, model, year
- WhatsApp, Instagram, Facebook
- Years of experience

### Step 3: Set your working hours

Go to **Dashboard → Availability** and enable the days/hours you work. The booking form's slot picker reads directly from `workingHours`.

### Step 4: Configure packages (optional)

Go to **Dashboard → Pricing** to set up lesson packages. Active packages appear in the booking form's Package step.

### Step 5: Enable branding (PRO/BUSINESS only)

1. Upload a logo (PNG/JPG/SVG, max 2MB, 200×200px recommended)
2. Set primary and secondary brand colors
3. Check "Show logo & colors on booking page"
4. Save

### Step 6: Share your link

Copy the URL from the branding dashboard and share it:
- Instagram bio
- WhatsApp status / broadcast
- Google Business profile
- Email signature

---

## 10. Sticky Mobile Button

**File:** `components/subdomain/SubdomainClientFeatures.tsx`

A client component that adds a sticky "Book a Lesson" button at the bottom of the screen on mobile. It appears after the user scrolls past 300px (past the hero) and smoothly slides in. Clicking it scrolls to `#booking-form`.

This is a separate client component because the main page is a Server Component — interactive scroll logic must be isolated.

---

## 10. Trust Badges Strip

A thin bar rendered between the hero and the main content grid. Only shows badges that are factually true for the instructor — no fabricated claims.

```
✅ Verified Instructor   🏆 14+ Years Experience   ⭐ 5.0 Rating (12 reviews)   🔒 Secure Online Booking
```

**Logic:**

```typescript
const trustBadges = [
  instructor.isVerified && { icon: '✅', label: 'Verified Instructor' },
  yearsExperience && { icon: '🏆', label: `${yearsExperience}+ Years Experience` },
  instructor.totalReviews > 0 && { icon: '⭐', label: `${rating} Rating (${count} reviews)` },
  { icon: '🔒', label: 'Secure Online Booking' }, // always shown
].filter(Boolean);
```

"Secure Online Booking" is always shown. The others are conditional on real data. The strip is hidden entirely if no badges resolve (e.g. unverified instructor with 0 reviews and no experience set).

---

## 11. FAQ Accordion

Added to the bottom of the left column under the vehicle photo. Uses native HTML `<details>`/`<summary>` — zero JavaScript, zero dependencies, works without hydration.

**Section title:** "Before You Book"

**Questions covered:**

| Question | Why it's there |
|---|---|
| What should I bring? | Most common pre-lesson anxiety |
| Where will you pick me up? | Students don't always read the form |
| What's the cancellation policy? | Reduces booking hesitation |
| I've never driven before — is that okay? | Converts nervous first-timers |
| How do packages work? | Explains the wallet/credit system |

The chevron rotates 180° on open via `group-open:rotate-180` (Tailwind). No client component needed.

---

## 12. Known Gaps & Limitations

| Gap | Impact | Notes |
|---|---|---|
| URL is path-based, not true subdomain | Branding dashboard shows wrong URL format | See Section 12 for fix |
| Service area check is client-side only | Students can bypass it | Advisory only by design |
| No SEO meta tags on subdomain page | Poor Google discoverability | Add `generateMetadata()` |
| `brandLogo` / `brandColorPrimary` etc. not in Prisma select types | TypeScript errors in branding route | Schema needs updating |
| `SubdomainClientFeatures` import error | Build warning | File exists, likely a path resolution issue |
| Branding dashboard copies `slug.drivebook.com.au` | Link doesn't work until middleware is live | Cosmetic until Section 12 is implemented |

---

## 13. True Subdomain Routing (As It Should Be)

To serve `john-smith.drivebook.com.au` instead of `drivebook.com.au/subdomain/john-smith`, two things are needed:

### 13a. DNS — Wildcard record

Add a wildcard `A` or `CNAME` record in your DNS provider:

```
*.drivebook.com.au  →  your Vercel deployment
```

In Vercel: add `*.drivebook.com.au` as a custom domain on the project.

### 13b. Next.js Middleware

Create `drivebook/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const mainDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'drivebook.com.au';

  // Strip port for local dev
  const hostname = host.replace(':3000', '').replace(':3001', '');

  // Not a subdomain — pass through
  if (hostname === mainDomain || hostname === `www.${mainDomain}`) {
    return NextResponse.next();
  }

  // Extract subdomain slug
  const slug = hostname.replace(`.${mainDomain}`, '');
  if (!slug || slug === hostname) return NextResponse.next();

  // Rewrite to /subdomain/[slug] — transparent to the user
  const url = req.nextUrl.clone();
  url.pathname = `/subdomain/${slug}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### 13c. Environment variable

Add to `.env`:

```
NEXT_PUBLIC_ROOT_DOMAIN=drivebook.com.au
```

### 13d. Update `next.config.js`

Add the wildcard to `images.domains` and `allowedDevOrigins`:

```javascript
const nextConfig = {
  images: {
    domains: ['localhost', 'drivebook.com.au'],
  },
  allowedDevOrigins: ['*.localhost', 'localhost'],
  // ...
};
```

### 13e. Local development

For local testing, use a tool like `localcan` or edit `/etc/hosts` to map `john-smith.localhost` → `127.0.0.1`, then visit `http://john-smith.localhost:3000`.

### 13f. Update the redirect in BulkBookingForm

Once true subdomains are live, the redirect logic in `BulkBookingForm.tsx` already handles it correctly — it strips the subdomain from `window.location.host` to build the payment URL on the main domain.

---

## 14. File Reference

| File | Purpose |
|---|---|
| `app/subdomain/[slug]/page.tsx` | Public booking page (Server Component) |
| `components/BulkBookingForm.tsx` | 4–5 step booking form |
| `components/SlotPicker.tsx` | Date + time slot picker |
| `components/subdomain/SubdomainClientFeatures.tsx` | Sticky mobile "Book a Lesson" button |
| `app/api/public/bookings/bulk/route.ts` | Booking creation endpoint |
| `app/api/public/bookings/[id]/route.ts` | Booking fetch for payment page |
| `app/api/instructor/branding/route.ts` | GET/PUT branding settings |
| `app/api/instructor/subdomain/check/route.ts` | Slug availability check |
| `app/api/availability/slots/route.ts` | Available time slots |
| `app/api/auth/check-email/route.ts` | Email existence check |
| `app/booking/[id]/payment/page.tsx` | Stripe payment page |
| `app/dashboard/branding/page.tsx` | Instructor branding settings UI |
| `lib/config/packages.ts` | Package pricing logic |
| `next.config.js` | Next.js config (no middleware yet) |
