# Subdomain Page

**Route:** `/subdomain/[slug]` (served at `[slug].drivebook.com.au`)  
**Auth required:** No  
**File:** `app/subdomain/[slug]/page.tsx`, `components/subdomain/SubdomainBookingEntry.tsx`, `components/subdomain/SubdomainBookingWizard.tsx`, `components/subdomain/SubdomainClientFeatures.tsx`  
**Full reference:** `docs/SUBDOMAIN_SYSTEM.md`

---

## Purpose

Each instructor gets a white-labeled public booking page. The URL slug comes from `Instructor.customDomain`. True subdomain routing is live â€” `john-smith.drivebook.com.au` rewrites transparently to `/subdomain/john-smith` via `middleware.ts`.

---

## Page Layout

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Nav bar: [Logo/Car icon]  [Instructor name]  [WhatsApp] â”‚
â”‚          [Login]                                        â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Hero banner (gradient using brand colors)               â”‚
â”‚  [Profile photo]  [Name]  [Star rating or "New"]        â”‚
â”‚  [Service areas]  [Vehicle types]  [Years exp]          â”‚
â”‚  [Next available: 1 real slot from now]  [Book a lesson]â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Trust badges: âœ… Verified  ðŸ† X+ Years  â­ Rating  ðŸ”’   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ How booking works: ðŸ“¦ Choose â†’ ðŸ’³ Pay once â†’ ðŸ“… Book   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Left column (mobile: â”‚ Right column (mobile: renders    â”‚
â”‚ renders second)      â”‚ first)                           â”‚
â”‚ Next availability    â”‚ Student reviews                  â”‚
â”‚ (2 real slots)       â”‚ Video intro (if set)             â”‚
â”‚ About / bio          â”‚ "Book Your Lesson â†’" button      â”‚
â”‚ Teaching style chips â”‚   (social proof: â­ rating Â· ðŸ”’)â”‚
â”‚ Services & Pricing   â”‚                                  â”‚
â”‚  - Single lesson     â”‚                                  â”‚
â”‚  - Lesson lengths    â”‚                                  â”‚
â”‚  - Clickable bulk    â”‚                                  â”‚
â”‚    package rows      â”‚                                  â”‚
â”‚  - PDA test pack row â”‚                                  â”‚
â”‚  - Book Your Lesson â†’â”‚                                  â”‚
â”‚ Details card         â”‚                                  â”‚
â”‚  - Vehicle types     â”‚                                  â”‚
â”‚  - Languages         â”‚                                  â”‚
â”‚  - Buffer time       â”‚                                  â”‚
â”‚  - Availability hrs  â”‚                                  â”‚
â”‚  - Test centres      â”‚                                  â”‚
â”‚  - Phone             â”‚                                  â”‚
â”‚ Connect (social)     â”‚                                  â”‚
â”‚ Vehicle photo        â”‚                                  â”‚
â”‚  (expands on hover)  â”‚                                  â”‚
â”‚ FAQ accordion        â”‚                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”‚ MOBILE: Fixed bottom nav (About/Services/Contact/Book)  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

Data fetched server-side: instructor profile + extras (`videoUrl`, `specialties`), last 5 reviews, next 2 available slots (14-day window, â‰¥2hrs from now, ceiled to whole hour), active PDA configs â†’ test centre suburbs, popular package (most-booked tier with â‰¥3 bookings), platform pricing (for live discount %).

---

## Booking Flow

When the student clicks "Book Your Lesson â†’", a **full-screen overlay** opens on top of the profile page (on both desktop and mobile). The profile stays open underneath â€” the student can close the overlay and return to the profile at any time.

**Overlay components:**
- `components/subdomain/SubdomainBookingEntry.tsx` â€” CTA button + overlay wrapper (desktop right column)
- `components/subdomain/SubdomainClientFeatures.tsx` â€” mobile bottom nav bar; "Book Now" opens the same full-screen overlay
- `components/subdomain/SubdomainBookingWizard.tsx` â€” multi-step wizard (shared by both)

**Wizard steps:**
1. Package â€” standard (6/10/15 hrs) or custom hours
2. Test Pack â€” only if `instructor.offersTestPackage = true`; shows a "Yes, add it / Skip" card before moving on
3. When to Book â€” Book Now or Book Later
4. Schedule â€” only if Book Now (date/time/duration, duration from `instructor.allowedDurations`)
5. Your Details â€” name, email, phone, password

**After submit:**
- Wizard shows order summary with "Complete Payment â†’" link
- Payment opens in a **new blank tab** â€” profile stays open
- Book Now â†’ `/booking/[id]/payment`
- Book Later â†’ `/payment/wallet/[transactionId]` (wallet credited, no booking created)

See [BOOKING_FLOW.md](./BOOKING_FLOW.md) for full payment flow.

---

## Branding Tiers

| Feature | BASIC | PRO | STUDIO | BUSINESS |
|---------|-------|-----|--------|----------|
| Public booking page | âœ… | âœ… | âœ… | âœ… |
| Default URL (by ID) | âœ… | âœ… | âœ… | âœ… |
| Custom slug | âŒ | âœ… | âœ… | âœ… |
| Custom logo | âŒ | âœ… | âœ… | âœ… |
| Custom brand colors | âœ… | âœ… | âœ… | âœ… |
| White-label nav (hide "DriveBook") | âŒ | âœ… | âœ… | âœ… |
| Custom domain | âŒ | âŒ | âœ… | âœ… |
| Social links | âœ… | âœ… | âœ… | âœ… |

```typescript
const isPro = instructor.subscriptionTier === 'PRO'
           || instructor.subscriptionTier === 'STUDIO'
           || instructor.subscriptionTier === 'BUSINESS';
const hasBranding = isPro && instructor.showBrandingOnBookingPage;
// Nav shows instructor logo only if hasBranding, otherwise shows Car icon + "DriveBook"
// Colors apply to all tiers â€” fall back to #3B82F6 / #10B981 if not set
```

---

## Next Available Slots

Computed server-side from working hours + upcoming bookings. Shows up to 2 real available slots starting from 2 hours from now (ceiled to the next whole hour to avoid showing stale slots from ISR cache).

- Shown in hero banner (first slot only, inline)
- Shown in left column "Next Available" card (2 slots, first prominent)
- Removed from booking card social proof banner (redundant with callout card)

---

## SEO

`generateMetadata()` exports:
- `<title>` â€” `"Book Driving Lessons with [Name]"`
- `<description>` â€” instructor bio (truncated to 155 chars) or generated fallback
- OpenGraph + Twitter card â€” for WhatsApp/Facebook link previews with profile image

JSON-LD `LocalBusiness` structured data inline â€” includes `aggregateRating` only if `totalReviews > 0`, `address` only if `baseAddress` is set.

---

## Trust Badges

Only shows badges that are factually true â€” no fabricated claims:
```typescript
const trustBadges = [
  instructor.isVerified && { icon: 'âœ…', label: 'Verified Instructor' },
  yearsExperience && { icon: 'ðŸ†', label: `${yearsExperience}+ Years Experience` },
  instructor.totalReviews > 0 && { icon: 'â­', label: `${rating} Rating (${count} reviews)` },
  { icon: 'ðŸ”’', label: 'Secure Online Booking' }, // always shown
].filter(Boolean);
```

---

## Mobile UX

`components/subdomain/SubdomainClientFeatures.tsx` â€” client component (isolated from the Server Component page).

- Fixed bottom nav bar: About / Services / Contact / Book Now
- "Book Now" opens the same full-screen overlay as the desktop button (both desktop and mobile use the identical overlay â€” no scroll-to-form behaviour)
- Body scroll locked while overlay is open
- iPhone safe area inset handled via `env(safe-area-inset-bottom)`

---

## PDA Test Pack (Instructor Settings)

The only instructor-configured add-on is the **PDA test pack**, enabled via instructor dashboard settings.

- Shown only if `instructor.offersTestPackage = true`
- Scheduled through the wizardâ€™s â€œTest Packageâ€ step
- **No other special services / instructor add-on packages are supported**

---

## FAQ Accordion

Uses native HTML `<details>`/`<summary>` â€” zero JS, works without hydration. Questions: what to bring, pickup location, cancellation policy, first-timers, how packages work.

---

## Slug Resolution

`Instructor.customSlug` â†’ slug. Falls back to `Instructor.id` â€” every instructor has a working URL at `<id>.drivebook.com.au` from day one.

Middleware compound TLD awareness (`.com.au` needs 4+ parts for a subdomain):
```typescript
const twoPartTLDs = ['com.au', 'co.uk', 'co.nz', 'org.au', 'net.au', 'id.au']
const isCompoundTLD = twoPartTLDs.includes(parts.slice(-2).join('.'))
const minParts = isCompoundTLD ? 4 : 3
```

---

## New Content Features (instructor-configurable)

Set via **Dashboard → Profile**:

**Video intro** (`Instructor.videoUrl`) — YouTube or Vimeo URL. Shown in the right column above the booking CTA. Supports `youtube.com/watch?v=`, `youtube.com/shorts/`, `youtu.be/`, `vimeo.com/ID`.

**Teaching specialties** (`Instructor.specialties`) — comma-separated tags. Shown as violet chips under a "Teaching style" subheader in the About card (or standalone card if no bio).

## How It Works Strip

Static 3-step strip between trust badges and main grid. Only shown when `isAcceptingBookings = true`. Zero DB cost.

## Clickable Pricing Rows

Bulk package rows rendered by `SubdomainPricingBooking` (client component). Clicking a row pre-selects that package and opens the overlay, skipping the package step. Popular package badge from `prisma.booking.groupBy` (min 3 bookings). Test centres from instructor PDA configs.

---

## DNS (Live)

Wildcard CNAME `*` â†’ `cname.vercel-dns.com` in Vercel DNS panel. SSL auto-managed by Vercel (wildcard cert).

---

## Related

- [BOOKING_FLOW.md](./BOOKING_FLOW.md) â€” Full booking flow (public + subdomain)
- `docs/SUBDOMAIN_SYSTEM.md` â€” Full reference (DNS, middleware, local dev setup, all fields)
- `docs/DOCROLEBASE/03-instructor/SUBSCRIPTION_TIERS.md` â€” Tier features and domain setup
