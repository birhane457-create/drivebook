# DriveBook Domain & Public Booking Page System

**Last Updated:** March 29, 2026  
**Scope:** How instructor public booking pages work — subdomain routing, custom domains, DNS setup, mobile UX, and branding tiers

---

## 1. Overview

Every instructor gets a public booking page that students can visit without logging in. The page shows the instructor's profile, pricing, reviews, and a full booking form. Students can book and pay in under 2 minutes.

There are three ways a student can reach an instructor's page:

| URL type | Example | Who sets it up | Tier required |
|---|---|---|---|
| Default (by ID) | `abc123.drivebook.com.au` | Automatic — always works | Any |
| Custom slug | `john.drivebook.com.au` | Instructor picks a slug | PRO+ |
| Custom domain | `x.com.au` or `book.x.com.au` | Instructor points DNS | STUDIO / BUSINESS |

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
Every instructor has a working URL at `<instructorId>.drivebook.com.au` from day one. No setup needed. The subdomain page falls back to looking up by `id` if no `customDomain` matches.

### STUDIO / BUSINESS — bring your own domain

The instructor owns `x.com.au` and wants their booking page there.

**Option A — Use a subdomain of their domain (recommended)**

They want `book.x.com.au`. At their registrar (VentraIP, Crazy Domains, GoDaddy, etc.):

```
Type:  CNAME
Name:  book          ← just the label, NOT the full domain
Value: cname.vercel-dns.com
```

**Option B — Use the root domain `x.com.au` itself**

Root domains can't use a standard CNAME (DNS spec limitation). Options:

| Method | How |
|---|---|
| ALIAS / ANAME | Some registrars (VentraIP, Cloudflare) support this. Add `ALIAS @ → cname.vercel-dns.com` |
| Cloudflare DNS | Move nameservers to Cloudflare (free). Add `CNAME @ → cname.vercel-dns.com` — Cloudflare flattens it automatically |
| www + redirect | Add `CNAME www → cname.vercel-dns.com`, then set a URL redirect at registrar: `x.com.au → www.x.com.au` |

The domain wizard in the branding page detects root vs subdomain and shows the correct instructions automatically.

---

## 4. Domain Verification Flow (Studio/Business)

```
Instructor enters domain in branding page
        │
        ▼
Clicks "Verify Domain"
        │
        ▼
POST /api/instructor/domain/verify
        │
        ▼
Server does DNS CNAME lookup on the domain
        │
        ├── CNAME resolves to *.vercel* → mark domainVerified=true ✅
        │   instructor.customDomain = domain
        │   instructor.domainVerifiedAt = now()
        │
        └── Not found / wrong target → return error + show instructions
```

**Schema fields:**
```prisma
customDomain     String?
domainVerified   Boolean   @default(false)
domainVerifiedAt DateTime?
```

**Important:** After verification, you must also add the domain to your Vercel project settings so Vercel issues an SSL certificate and routes traffic. This is currently a manual step in the Vercel dashboard.

---

## 5. Branding Tiers

| Feature | BASIC | PRO | STUDIO | BUSINESS |
|---|---|---|---|---|
| Public booking page | ✅ | ✅ | ✅ | ✅ |
| Default URL (by ID) | ✅ | ✅ | ✅ | ✅ |
| Custom slug (`john.drivebook.com.au`) | ❌ | ✅ | ✅ | ✅ |
| Custom logo + brand colors | ❌ | ✅ | ✅ | ✅ |
| White-label nav (hide "DriveBook") | ❌ | ✅ | ✅ | ✅ |
| Custom domain (bring your own) | ❌ | ❌ | ✅ | ✅ |
| Multiple instructors | ❌ | ❌ | ❌ | ✅ |
| Monthly price | $29 | $79 | $129 | $199 |
| Commission rate | 15% | 12% | 11% | 10% |

---

## 6. Page Anatomy

**Files:**
- `app/subdomain/[slug]/page.tsx` — handles `*.drivebook.com.au` subdomains
- `app/custom-domain/page.tsx` — handles custom domains (reads `x-custom-domain` header set by middleware)

Both render the same booking page. `custom-domain/page.tsx` looks up the instructor by their verified custom domain and delegates to the same render function.

```
┌─────────────────────────────────────────────────────────┐
│ Desktop nav bar (hidden on mobile)                      │
│  [Logo]  [Instructor name]  [WhatsApp]  [Login]         │
├─────────────────────────────────────────────────────────┤
│ Hero banner (gradient using brand colors)               │
│  [Profile photo]  [Name]  [Stars]  [Service area]       │
│  [Years exp]  [Student count]  [Next available]         │
├─────────────────────────────────────────────────────────┤
│ Trust badges strip                                      │
│  ✅ Verified  🏆 X+ Years  ⭐ Rating  🔒 Secure Booking │
├──────────────────────┬──────────────────────────────────┤
│ Left column          │ Right column                     │
│                      │                                  │
│ Next availability    │ [Location pre-fill banner]       │
│                      │                                  │
│ [section-about]      │ [booking-form]                   │
│ About / bio          │ BulkBookingForm                  │
│                      │                                  │
│ [section-services]   │ Student reviews                  │
│ Services & Pricing   │                                  │
│  - Single lesson     │                                  │
│  - Packages          │                                  │
│                      │                                  │
│ [section-contact]    │                                  │
│ Details              │                                  │
│  - Vehicle types     │                                  │
│  - Languages         │                                  │
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

## 7. Mobile UX

**File:** `components/subdomain/SubdomainClientFeatures.tsx`

On mobile (`< md` breakpoint):

- **Bottom nav bar** — fixed to bottom of screen with 4 tabs:
  - About → smooth scrolls to `#section-about`
  - Services → smooth scrolls to `#section-services`
  - Contact → smooth scrolls to `#section-contact`
  - Book Now → opens full-screen booking drawer (branded with instructor's primary color)

- **Full-screen booking drawer** — slides up from bottom with:
  - Header bar in instructor's brand color
  - Back arrow (ChevronLeft) to close
  - Instructor name shown in header
  - Full `BulkBookingForm` passed as children — real React component, not a DOM clone
  - Body scroll locked while open

- **Text sizes** — bumped from `text-sm` to `text-base` throughout for readability on small screens

On desktop the bottom nav is hidden (`md:hidden`) and the booking form stays inline.

---

## 8. Instructor Setup Guide

### PRO — Set a custom slug

1. Go to **Dashboard → Brand & Public Page** (`/dashboard/branding`)
2. Enter a slug in "Your Booking URL" (e.g. `john-smith`)
3. System checks availability in real time
4. Save — page is live immediately at `john-smith.drivebook.com.au`

If no slug is set, the default URL `<instructorId>.drivebook.com.au` always works.

### STUDIO — Set up a custom domain

1. Go to **Dashboard → Brand & Public Page**
2. In the "Custom Domain" section, enter your domain (e.g. `book.x.com.au`)
3. The wizard shows the exact DNS record to add at your registrar
4. Add the DNS record, wait for propagation (up to 24 hours)
5. Click "Verify Domain" — the system checks your CNAME via DNS lookup
6. Once verified, `book.x.com.au` serves your booking page

**Also required:** Add the domain in your Vercel project settings (Vercel dashboard → Domains) so SSL is issued.

### Profile fields that appear on the booking page

Fill these in via **Dashboard → Profile**:

- Profile photo, bio, service areas
- Base address + service radius (for distance check)
- Vehicle types, languages, years of experience
- Car photo, make, model, year
- WhatsApp, Instagram, Facebook
- Booking buffer minutes

### Working hours

Set via **Dashboard → Availability**. The slot picker reads directly from `workingHours`.

### Packages

Set via **Dashboard → Settings → Lesson Packages**. Active packages appear in the booking form.

---

## 9. APIs

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/public/bookings/bulk` | POST | Create booking + user account |
| `/api/public/bookings/[id]` | GET | Fetch booking for payment page |
| `/api/payments/create-intent` | POST | Create Stripe PaymentIntent |
| `/api/stripe/webhook` | POST | Handle payment confirmation |
| `/api/availability/slots` | GET | Fetch available time slots |
| `/api/auth/check-email` | POST | Check if email already registered |
| `/api/instructor/branding` | GET/PUT | Read/write branding + domain settings |
| `/api/instructor/subdomain/check` | GET | Check if slug is available |
| `/api/instructor/domain/verify` | POST | DNS CNAME verification for custom domains |
| `/api/cron/cleanup-expired-bookings` | GET | Expire unpaid PENDING_PAYMENT slots |

---

## 10. File Reference

| File | Purpose |
|---|---|
| `middleware.ts` | Subdomain extraction + custom domain detection + rewrites |
| `app/subdomain/[slug]/page.tsx` | Public booking page — looks up by `customDomain` OR `id` |
| `app/custom-domain/page.tsx` | Custom domain entry point — reads `x-custom-domain` header |
| `components/BulkBookingForm.tsx` | 4–5 step booking form |
| `components/SlotPicker.tsx` | Date + time slot picker |
| `components/subdomain/SubdomainClientFeatures.tsx` | Mobile bottom nav + full-screen booking drawer |
| `app/api/public/bookings/bulk/route.ts` | Booking creation |
| `app/api/instructor/branding/route.ts` | Branding GET/PUT (includes domainVerified fields) |
| `app/api/instructor/subdomain/check/route.ts` | Slug availability check |
| `app/api/instructor/domain/verify/route.ts` | DNS CNAME verification |
| `app/dashboard/branding/page.tsx` | Instructor branding UI (subdomain + custom domain wizard) |
| `lib/config/subscriptions.ts` | Tier definitions (BASIC/PRO/STUDIO/BUSINESS) |

---

## 11. DNS Records (Our Domain — Vercel)

The domain `drivebook.com.au` uses Vercel nameservers:

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

Vercel DNS records:

| Name | Type | Value |
|---|---|---|
| `*` | CNAME | `cname.vercel-dns.com` |
| `@` | A | Vercel IP (auto-managed) |
| `www` | CNAME | `cname.vercel-dns.com` |

The wildcard `*` covers all instructor subdomains automatically.

---

## 12. Local Development

Add to hosts file:
```
# Windows: C:\Windows\System32\drivers\etc\hosts
127.0.0.1  test.localhost
```

Visit `http://test.localhost:3000` — middleware rewrites to `/subdomain/test`.

`next.config.js` has `allowedDevOrigins: ['*.localhost:3000']` to suppress cross-origin warnings.

> Use `http://` only on localhost — `https://` will fail with SSL error, which is expected.

---

## 13. Known Gaps

| Gap | Notes |
|---|---|
| Vercel domain registration not automated | After instructor verifies DNS, you must manually add their domain in Vercel dashboard for SSL. Could be automated via Vercel API. |
| Service area check is client-side only | Advisory only by design — not enforced server-side |
| Custom FAQ not yet editable | FAQ is currently hardcoded. `pageContent` JSON field planned for Studio tier. |
