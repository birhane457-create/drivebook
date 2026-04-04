# DriveBook Domain & Public Booking Page System

**Last Updated:** March 30, 2026  
**Scope:** How instructor public booking pages work — subdomain routing, custom domains, DNS setup, mobile UX, branding tiers, booking form, and SEO

---

## 1. Overview

Every instructor gets a public booking page that students can visit without logging in. The page shows the instructor's profile, pricing, availability, reviews, and a full booking form. Students can book and pay in under 2 minutes.

There are three ways a student can reach an instructor's page:

| URL type | Example | Who sets it up | Tier required |
|---|---|---|---|
| Default (by ID) | `abc123.drivebook.com.au` | Automatic — always works | Any |
| Custom slug | `john.drivebook.com.au` | Instructor picks a slug | PRO+ |
| Custom domain | `book.x.com.au` | Instructor points DNS | STUDIO / BUSINESS |

---

## 2. Domain Routing Diagram

```
VISITOR HITS A URL
        │
        ▼
┌───────────────────┐
│   middleware.ts   │  checks hostname
└───────────────────┘
        │
        ├─── Is it drivebook.com.au? ──────────────────────────────────┐
        │                                                               │
        │    YES — our domain                                           │
        │         │                                                     │
        │         ├── Has subdomain? (john.drivebook.com.au)            │
        │         │        │                                            │
        │         │        YES                                          │
        │         │        │                                            │
        │         │        ▼                                            │
        │         │   rewrite → /subdomain/john                        │
        │         │        │                                            │
        │         │        ▼                                            │
        │         │   DB lookup:                                        │
        │         │   customDomain='john' OR id='john'                 │
        │         │        │                                            │
        │         │        ├── found → render booking page ✅           │
        │         │        └── not found → 404                         │
        │         │                                                     │
        │         └── No subdomain → normal app routes                 │
        │              (/, /login, /dashboard, /admin, etc.)           │
        │                                                               │
        └─── NOT our domain (x.com.au, book.x.com.au)                 │
                  │                                                     │
                  ▼                                                     │
             rewrite → /custom-domain                                  │
                  │                                                     │
                  ▼                                                     │
        DB lookup: customDomain=hostname                               │
                  AND domainVerified=true                              │
                  AND tier IN (STUDIO, BUSINESS)                       │
                  │                                                     │
                  ├── found → render booking page ✅                    │
                  └── not found → 404                                  │
```

---

## 3. DNS Setup by Tier

### BASIC
No public booking URL. Upgrade prompt shown in branding page.

### PRO — `john.drivebook.com.au`
DNS is managed by **us** (Vercel wildcard). The instructor just picks a slug — no DNS work required on their end.

```
*.drivebook.com.au  →  cname.vercel-dns.com   (set once in Vercel DNS panel)
```

### Default URL — all tiers
Every instructor has a working URL at `<instructorId>.drivebook.com.au` from day one. No setup needed.

### STUDIO / BUSINESS — bring your own domain

**Option A — Use a subdomain (recommended)**

```
Type:  CNAME
Name:  book
Value: cname.vercel-dns.com
```

**Option B — Root domain `x.com.au`**

| Method | How |
|---|---|
| ALIAS / ANAME | Some registrars support this. Add `ALIAS @ → cname.vercel-dns.com` |
| Cloudflare DNS | Move nameservers to Cloudflare. Add `CNAME @ → cname.vercel-dns.com` |
| www + redirect | `CNAME www → cname.vercel-dns.com`, then redirect root to www |

---

## 4. Domain Verification Flow (Studio/Business)

```
Instructor enters domain → POST /api/instructor/domain/verify
        │
        ▼
Server does DNS CNAME lookup
        │
        ├── resolves to *.vercel* → domainVerified=true ✅
        └── wrong target → return error + show instructions
```

**Schema fields:**
```prisma
customDomain     String?
domainVerified   Boolean   @default(false)
domainVerifiedAt DateTime?
```

After verification, add the domain in Vercel project settings for SSL.

---

## 5. Branding Tiers

| Feature | BASIC | PRO | STUDIO | BUSINESS |
|---|---|---|---|---|
| Public booking page | ✅ | ✅ | ✅ | ✅ |
| Default URL (by ID) | ✅ | ✅ | ✅ | ✅ |
| Custom slug | ❌ | ✅ | ✅ | ✅ |
| Custom logo + brand colors | ❌ | ✅ | ✅ | ✅ |
| White-label nav | ❌ | ✅ | ✅ | ✅ |
| Custom domain | ❌ | ❌ | ✅ | ✅ |
| Multiple instructors | ❌ | ❌ | ❌ | ✅ |

---

## 6. Page Anatomy

**Files:**
- `app/subdomain/[slug]/page.tsx` — handles `*.drivebook.com.au` subdomains
- `app/custom-domain/page.tsx` — handles custom domains

**Caching:** `export const revalidate = 300` — page is cached for 5 minutes. Instructor profile changes take up to 5 minutes to appear publicly.

```
┌─────────────────────────────────────────────────────────┐
│ Desktop nav bar                                         │
│  [Logo/Brand]  [About] [Services] [Contact] [Book Now]  │
│  [WhatsApp]  [Login]                                    │
├─────────────────────────────────────────────────────────┤
│ JSON-LD structured data (LocalBusiness schema)          │
├─────────────────────────────────────────────────────────┤
│ Hero banner (gradient using brand colors)               │
│  [Profile photo]  [Name]  [Stars or "New instructor"]   │
│  [Service area / suburb]  [Vehicle types]               │
│  [Years exp]  [Student count]  [Next available]         │
├─────────────────────────────────────────────────────────┤
│ Trust badges strip                                      │
│  ✅ Verified  🏆 X+ Years  ⭐ Rating (only if reviews)  │
│  🔒 Secure Booking                                      │
├──────────────────────┬──────────────────────────────────┤
│ Left column          │ Right column                     │
│                      │                                  │
│ Next availability    │ [Location pre-fill banner]       │
│                      │                                  │
│ [section-about]      │ [booking-form]                   │
│ About / bio          │  Social proof banner             │
│ (hidden if empty)    │  "Book Your Lesson"              │
│                      │  BulkBookingForm                 │
│ [section-services]   │                                  │
│ Services & Pricing   │ Student reviews                  │
│  - Single lesson     │                                  │
│  - Lesson durations  │                                  │
│  - Service area      │                                  │
│  - Packages          │                                  │
│                      │                                  │
│ [section-contact]    │                                  │
│ Details              │                                  │
│  - Vehicle types     │                                  │
│  - Languages         │                                  │
│  - Buffer time       │                                  │
│  - Availability hrs  │                                  │
│  - Phone             │                                  │
│ Social links         │                                  │
│ Vehicle photo        │                                  │
│ FAQ accordion        │                                  │
├─────────────────────────────────────────────────────────┤
│ Footer                                                  │
├─────────────────────────────────────────────────────────┤
│ MOBILE ONLY: Bottom nav bar (fixed)                     │
│  [About] [Services] [Contact] [Book Now ←primary color] │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Booking Flow (Subdomain)

**Files:**
- `components/subdomain/SubdomainBookingEntry.tsx` — CTA button + full-screen overlay
- `components/subdomain/SubdomainBookingWizard.tsx` — multi-step wizard inside the overlay

**Entry point:** Student clicks "Book Your Lesson →" on the profile page. This opens a **full-screen overlay** on top of the profile page — the profile stays open underneath. The overlay has a compact header with the instructor's name and a "Back to profile" close button.

**Wizard steps:**

| Step | Label | Condition |
|---|---|---|
| 1 | Package | Always |
| 2 | Test Package | Only if `instructor.offersTestPackage = true` |
| 3 | When to Book | Always |
| 4 | Schedule | Only if `bookingType = now` |
| 5 | Your Details | Always |

**Package step:**
- Standard packages (6/10/15 hrs) — radio select, platform bulk discounts applied
- Instructor add-on packages — checkbox style, fixed price, no platform discount, can combine with standard package
- Custom hours dropdown (1–50 hrs)
- Discount rates fetched from `/api/public/pricing` on context mount

**When to Book step:**
- "Book Now" — student schedules at least one lesson before paying
- "Book Later" — student pays to load wallet, books from dashboard later

**Schedule step (Book Now only):**
- Date picker + duration selector (from `instructor.allowedDurations`)
- Slot grid fetched from `/api/availability/slots` — duration-aware (3hr slot at 9am blocked if 10am is taken)
- Local overlap check prevents scheduling two lessons that overlap before API call
- Student can add multiple lessons up to the total package hours

**Payment:**
- After "Continue to Payment", wizard shows order summary with "Complete Payment →" link
- Payment page opens in a **new blank tab** — profile page stays open
- Book Now → `/booking/[id]/payment`
- Book Later → `/payment/wallet/[transactionId]` (wallet credited, no booking created)
- Pricing params passed via URL query string to the wallet payment page for display

**Slot availability rules:**
- Slots API checks full duration overlap against DB bookings + buffer time
- A 3hr slot at 9am is unavailable if any booking exists between 9am and 12pm
- Short-notice slots (< 2hrs from now) shown but flagged — require instructor approval
- Minimum advance notice: 2 hours

---

## 8. Availability Slots API

**Endpoint:** `GET /api/availability/slots`

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `instructorId` | string | Required |
| `date` | string | YYYY-MM-DD |
| `duration` | number | Minutes (must be in instructor's `allowedDurations`) |
| `bypassDurationCheck` | boolean | Skip duration validation (reschedule only) |
| `excludeBookingId` | string | Exclude a booking from conflict check (edit mode) |

**Working hours format** (stored in `instructor.workingHours` JSON):
```json
{
  "monday": [{ "start": "09:00", "end": "17:00" }],
  "tuesday": [{ "start": "09:00", "end": "17:00" }],
  "saturday": [{ "start": "09:00", "end": "13:00" }],
  "sunday": []
}
```
Each day is an **array of time slots** (supports split shifts). Empty array = not working that day.

**Important:** The subdomain page's `nextAvailableLabel` computation reads this same format. The old `{ enabled, start, end }` format is no longer used.

---

## 9. SEO

The page uses two layers of SEO:

**1. `generateMetadata()` — Next.js metadata**
- Title: `Book Driving Lessons with {name}`
- Description: bio (truncated to 155 chars) or auto-generated from service areas + rate
- OpenGraph + Twitter card images from `profileImage`

**2. JSON-LD structured data (inline `<script>` tag)**
```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "...",
  "image": "...",
  "description": "...",
  "areaServed": "...",
  "priceRange": "From $90/hr",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Maylands",
    "addressCountry": "AU"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": 4.9,
    "reviewCount": 42
  }
}
```
- `address` is only included if `baseAddress` is set (suburb extracted automatically)
- `aggregateRating` is only included if `totalReviews > 0`

---

## 10. Profile Fields That Appear on the Booking Page

| Field | Where to edit | What it affects |
|---|---|---|
| `name` | Profile page | Hero, nav, SEO title |
| `bio` | Profile page | About section (hidden if empty/whitespace) |
| `profileImage` | Profile page | Hero photo, SEO image |
| `carImage` | Profile page | Vehicle photo card |
| `carMake/Model/Year` | Profile page | Vehicle photo caption |
| `baseAddress` | Profile page | Service area display (suburb only shown publicly), JSON-LD address, distance check |
| `serviceRadiusKm` | Settings page | Service area display, distance check |
| `serviceAreas` | Profile page | Hero subtitle, service area check |
| `hourlyRate` | Settings page | Pricing display |
| `allowedDurations` | Settings page | Duration chips, slot picker, booking payload |
| `lessonPackages` | Settings page | Package cards in services section |
| `workingHours` | Settings page | Next available label, slot picker |
| `bookingBufferMinutes` | Settings page | Details card, slot calculation |
| `vehicleTypes` | Settings page | Hero subtitle, details card |
| `languages` | Profile page | Details card |
| `yearsExperience` | Profile page | Hero, trust badges |
| `whatsapp` | Profile page | Nav button, connect card |
| `instagram` / `facebook` | Profile page | Connect card |
| `brandColorPrimary` | Branding page | All accent colors (all tiers) |
| `brandColorSecondary` | Branding page | Package prices, savings |
| `brandLogo` | Branding page | Nav logo (PRO+ only) |
| `showBrandingOnBookingPage` | Branding page | White-label nav (PRO+ only) |

**Note:** `baseAddress` was previously read-only in the profile page. It is now editable. Only the suburb portion is shown publicly — the full address is never exposed.

---

## 11. Mobile UX

**File:** `components/subdomain/SubdomainClientFeatures.tsx`

On mobile (`< md` breakpoint):
- **Bottom nav bar** — fixed, 4 tabs: About / Services / Contact / Book Now
- **Book Now** opens a full-screen overlay (same as desktop) — `SubdomainBookingEntry` handles this
- Body scroll is locked while overlay is open
- iPhone safe area inset handled via `env(safe-area-inset-bottom)`
- Mobile summary bar — shows total + "View details" tap to expand order summary drawer

On desktop:
- Bottom nav is hidden (`md:hidden`)
- **Desktop nav** (`SubdomainDesktopNav.tsx`) shows anchor links: About / Services / Contact / Book Now
- Book Now opens the full-screen overlay

**Booking overlay (all screen sizes):**
- Fixed `inset-0 z-[100]` — covers entire viewport
- Compact sticky header: instructor initial + name + "Back to profile ✕"
- Wizard content scrollable inside overlay
- Payment opens in new tab — overlay stays open so student can come back

---

## 12. Conversion Features

- **Social proof banner** above booking form: rating, review count, next available time, "No account required"
- **Microcopy:** "Book Your Lesson — Takes less than 60 seconds · No account required"
- **New instructor handling:** Shows "New instructor" pill instead of fake 5.0 rating when `totalReviews === 0`
- **About section:** Hidden if `bio` is empty or whitespace-only — prevents broken/test content showing
- **Hero subtitle:** Shows vehicle types ("Automatic & Manual driving lessons") and suburb + "& surrounding areas" if `serviceAreas` not set
- **Next available label:** Computed server-side from working hours + upcoming bookings, shown in hero and social proof banner

---

## 13. APIs

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/public/bookings/bulk` | POST | Create booking + user account |
| `/api/payments/create-intent` | POST | Create Stripe PaymentIntent |
| `/api/stripe/webhook` | POST | Handle payment confirmation |
| `/api/availability/slots` | GET | Fetch available time slots for a date + duration |
| `/api/auth/check-email` | POST | Check if email already registered |
| `/api/public/check-service-area` | GET | Check if a lat/lng is within instructor's service radius |
| `/api/instructor/branding` | GET/PUT | Branding + domain settings |
| `/api/instructor/profile` | GET/PUT | Profile fields including `baseAddress` |
| `/api/instructor/subdomain/check` | GET | Check if slug is available |
| `/api/instructor/domain/verify` | POST | DNS CNAME verification |

---

## 14. File Reference

| File | Purpose |
|---|---|
| `middleware.ts` | Subdomain extraction + custom domain detection + rewrites |
| `app/subdomain/[slug]/page.tsx` | Public booking page (5-min cache) |
| `app/custom-domain/page.tsx` | Custom domain entry point |
| `components/subdomain/SubdomainBookingEntry.tsx` | CTA button + full-screen overlay wrapper |
| `components/subdomain/SubdomainBookingWizard.tsx` | Multi-step booking wizard (package → schedule → details → payment) |
| `components/BulkBookingForm.tsx` | Public flow booking form (used on `/book/[instructorId]`) |
| `components/PackageSelector.tsx` | Package selection step — standard + instructor add-ons |
| `components/BookingDetailsForm.tsx` | Schedule step — date/time/duration picker with overlap check |
| `components/BookingSummary.tsx` | Order summary sidebar (desktop) + mobile bottom bar |
| `components/SlotPicker.tsx` | Date + time slot picker (duration-aware) |
| `components/subdomain/SubdomainClientFeatures.tsx` | Mobile bottom nav + booking overlay |
| `components/subdomain/SubdomainDesktopNav.tsx` | Desktop anchor nav (About/Services/Contact/Book Now) |
| `app/booking/[id]/payment/page.tsx` | Book Now payment page |
| `app/payment/wallet/[transactionId]/page.tsx` | Book Later wallet payment page |
| `app/payment/wallet/[transactionId]/confirmation/page.tsx` | Book Later confirmation page |
| `app/api/availability/slots/route.ts` | Slot availability API (duration-aware overlap check) |
| `app/api/availability/check-and-reserve/route.ts` | Slot reservation API (10-min hold) |
| `app/api/public/bookings/bulk/route.ts` | Booking creation (book now) or wallet transaction (book later) |
| `app/api/payments/create-intent/route.ts` | Stripe PaymentIntent — supports both bookingId and transactionId |
| `app/api/instructor/profile/route.ts` | Profile GET/PUT (includes baseAddress) |
| `app/api/instructor/branding/route.ts` | Branding GET/PUT |
| `app/dashboard/profile/page.tsx` | Instructor profile UI (baseAddress now editable) |
| `app/dashboard/settings/page.tsx` | Settings UI (allowedDurations, packages, working hours) |
| `app/dashboard/branding/page.tsx` | Branding UI (subdomain + custom domain wizard) |

---

## 15. Known Gaps

| Gap | Notes |
|---|---|
| Vercel domain registration not automated | After DNS verification, must manually add domain in Vercel dashboard for SSL |
| Service area check is client-side only | Advisory only — not enforced server-side |
| Custom FAQ not editable | FAQ is hardcoded. `pageContent` JSON field planned for Studio tier |
| Show real slots upfront | Calendly-style slot preview above booking form would improve conversion. Needs a client component to fetch slots on page load |
| Phone/contact gating | Phone number currently shown before booking. Marketplace best practice is to reveal after booking confirmation |
