# Subdomain Page

**Route:** `/subdomain/[slug]` (served at `[slug].drivebook.com.au`)  
**Auth required:** No  
**File:** `app/subdomain/[slug]/page.tsx`, `components/subdomain/SubdomainBookingEntry.tsx`, `components/subdomain/SubdomainBookingWizard.tsx`, `components/subdomain/SubdomainClientFeatures.tsx`

> `components/subdomain/SubdomainPageShell.tsx` also exists but is **not used** by the current page — legacy file from an earlier architecture, can be removed.  
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

When the student clicks "Book Your Lesson →", a **full-screen overlay** opens on top of the profile page (on both desktop and mobile). The profile stays open underneath — the student can close the overlay and return to the profile at any time.

**Overlay components:**
- `components/subdomain/SubdomainBookingEntry.tsx` — CTA button + overlay wrapper (desktop right column)
- `components/subdomain/SubdomainClientFeatures.tsx` — mobile bottom nav bar; "Book Now" opens the same full-screen overlay
- `components/subdomain/SubdomainBookingWizard.tsx` — multi-step wizard (shared by both)

**Wizard steps:**
1. Package — standard (6/10/15 hrs) or custom hours
2. Test Pack — only if `instructor.offersTestPackage = true`; shows a "Yes, add it / Skip" card before moving on
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
// Nav shows instructor logo only if hasBranding, otherwise shows Car icon + "DriveBook"
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
- "Book Now" opens the same full-screen overlay as the desktop button (both desktop and mobile use the identical overlay — no scroll-to-form behaviour)
- Body scroll locked while overlay is open
- iPhone safe area inset handled via `env(safe-area-inset-bottom)`

---

## PDA Test Pack (Instructor Settings)

The only instructor-configured add-on is the **PDA test pack**, enabled via instructor dashboard settings.

- Shown only if `instructor.offersTestPackage = true`
- Scheduled through the wizard’s “Test Package” step
- **No other special services / instructor add-on packages are supported**

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
