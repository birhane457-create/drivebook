# Subdomain Page

**Route:** `/subdomain/[slug]` (served at `[slug].drivebook.com.au`)  
**Auth required:** No  
**File:** `app/subdomain/[slug]/page.tsx`, `components/subdomain/SubdomainClientFeatures.tsx`  
**Full reference:** `docs/SUBDOMAIN_SYSTEM.md`

---

## Purpose

Each instructor gets a white-labeled public booking page. The URL slug comes from `Instructor.customDomain`. True subdomain routing is live — `john-smith.drivebook.com.au` rewrites transparently to `/subdomain/john-smith` via `middleware.ts`.

---

## Page Layout

```
┌─────────────────────────────────────────────────────────┐
│ Nav bar: [Logo/Car icon]  [Instructor name]  [WhatsApp] │
├─────────────────────────────────────────────────────────┤
│ Hero banner (gradient using brand colors)               │
│  [Profile photo]  [Name]  [Star rating]                 │
│  [Service areas]  [Years exp]  [Next available]         │
├─────────────────────────────────────────────────────────┤
│ Trust badges: ✅ Verified  🏆 X+ Years  ⭐ Rating  🔒   │
├──────────────────────┬──────────────────────────────────┤
│ Left column          │ Right column                     │
│ Next availability    │ Booking form (BulkBookingForm)   │
│ About / bio          │ Student reviews                  │
│ Pricing              │                                  │
│ Vehicle details      │                                  │
│ Social links         │                                  │
│ Vehicle photo        │                                  │
│ FAQ accordion        │                                  │
└──────────────────────┴──────────────────────────────────┘
│ Sticky mobile "Book a Lesson" button (after 300px scroll)│
└─────────────────────────────────────────────────────────┘
```

Data fetched server-side: instructor profile, last 5 reviews (completed bookings with `clientRating != null`), next available slot (14-day window), active packages.

---

## Branding Tiers

| Feature | BASIC | PRO | BUSINESS |
|---------|-------|-----|----------|
| Public booking page | ✅ | ✅ | ✅ |
| Custom slug / URL | ✅ | ✅ | ✅ |
| Custom logo | ❌ | ✅ | ✅ |
| Custom brand colors | ❌ | ✅ | ✅ |
| White-label nav (hide "DriveBook") | ❌ | ✅ | ✅ |
| Social links | ✅ | ✅ | ✅ |

```typescript
const isPro = instructor.subscriptionTier === 'PRO' || instructor.subscriptionTier === 'BUSINESS';
const hasBranding = isPro && instructor.showBrandingOnBookingPage;
// Nav shows instructor name only if hasBranding, otherwise shows "DriveBook"
// Colors fall back to #3B82F6 / #10B981 if not set
```

---

## SEO

`generateMetadata()` exports:
- `<title>` — `"Book Driving Lessons with [Name]"`
- `<description>` — instructor bio (truncated to 155 chars) or generated fallback
- OpenGraph + Twitter card — for WhatsApp/Facebook link previews with profile image

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

## FAQ Accordion

Uses native HTML `<details>`/`<summary>` — zero JS, works without hydration. Questions: what to bring, pickup location, cancellation policy, first-timers, how packages work.

---

## Sticky Mobile Button

`components/subdomain/SubdomainClientFeatures.tsx` — client component (isolated from the Server Component page). Appears after 300px scroll, scrolls to `#booking-form` on click.

---

## Booking Flow

Same as the public booking flow — `BulkBookingForm` behaves identically to `/book/[instructorId]`. See [BOOKING_FLOW.md](./BOOKING_FLOW.md).

---

## Slug Resolution

`Instructor.customDomain` → slug. 404 if no match.

Middleware compound TLD awareness (`.com.au` needs 4+ parts for a subdomain):
```typescript
const twoPartTLDs = ['com.au', 'co.uk', 'co.nz', 'org.au', 'net.au', 'id.au']
const isCompoundTLD = twoPartTLDs.includes(parts.slice(-2).join('.'))
const minParts = isCompoundTLD ? 4 : 3
```

---

## DNS (Live)

Wildcard CNAME `*` → `cname.vercel-dns.com` in Vercel DNS panel. SSL auto-managed by Vercel (wildcard cert, expires Jun 2026).

---

## Related

- [BOOKING_FLOW.md](./BOOKING_FLOW.md) — Booking form behavior
- `docs/SUBDOMAIN_SYSTEM.md` — Full reference (DNS, middleware, local dev setup)
- `docs/03-instructor/BRANDING.md` — How instructors configure their subdomain
