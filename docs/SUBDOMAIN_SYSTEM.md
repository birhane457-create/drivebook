# DriveBook Domain & Public Booking Page System

**Status:** ✅ Current  
**Last Updated:** 2026-09-01

---

**Last Updated:** August 2026 â€” verified against `prisma/schema.prisma`, `lib/config/subscriptions.ts`, `app/subdomain/[slug]/page.tsx`

---

## 1. Overview

Every instructor gets a public booking page that students can visit without logging in. The page shows the instructor's profile, pricing, availability, reviews, and a full booking form.

There are three ways a student can reach an instructor's page:

| URL type | Example | Who sets it up | Tier required |
|---|---|---|---|
| Default (by ID) | `abc123.drivebook.com.au` | Automatic â€” always works | Any |
| Custom slug | `john.drivebook.com.au` | Instructor picks a slug | PRO+ |
| Custom domain | `book.x.com.au` | Instructor points DNS | STUDIO / BUSINESS |

Slug and custom domain are **independent** â€” a Studio instructor can have both simultaneously.

---

## 2. Domain Routing Diagram

```
VISITOR HITS A URL
        â”‚
        â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   middleware.ts   â”‚  checks hostname
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
        â”‚
        â”œâ”€â”€â”€ Is it drivebook.com.au? â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚                                                               â”‚
        â”‚    YES â€” our domain                                           â”‚
        â”‚         â”‚                                                     â”‚
        â”‚         â”œâ”€â”€ Has subdomain? (john.drivebook.com.au)            â”‚
        â”‚         â”‚        â”‚                                            â”‚
        â”‚         â”‚        YES                                          â”‚
        â”‚         â”‚        â”‚                                            â”‚
        â”‚         â”‚        â–¼                                            â”‚
        â”‚         â”‚   rewrite â†’ /subdomain/john                        â”‚
        â”‚         â”‚        â”‚                                            â”‚
        â”‚         â”‚        â–¼                                            â”‚
        â”‚         â”‚   DB lookup:                                        â”‚
        â”‚         â”‚   customSlug='john' OR id='john'                   â”‚
        â”‚         â”‚        â”‚                                            â”‚
        â”‚         â”‚        â”œâ”€â”€ found â†’ render booking page âœ…           â”‚
        â”‚         â”‚        â””â”€â”€ not found â†’ 404                         â”‚
        â”‚         â”‚                                                     â”‚
        â”‚         â””â”€â”€ No subdomain â†’ normal app routes                 â”‚
        â”‚              (/, /login, /dashboard, /admin, etc.)           â”‚
        â”‚                                                               â”‚
        â””â”€â”€â”€ NOT our domain (x.com.au, book.x.com.au)                 â”‚
                  â”‚                                                     â”‚
                  â–¼                                                     â”‚
             rewrite â†’ /custom-domain                                  â”‚
                  â”‚                                                     â”‚
                  â–¼                                                     â”‚
        DB lookup: customDomain=hostname                               â”‚
                  AND domainVerified=true                              â”‚
                  AND tier IN (STUDIO, BUSINESS)                       â”‚
                  â”‚                                                     â”‚
                  â”œâ”€â”€ found â†’ render booking page using instructor.id  â”‚
                  â””â”€â”€ not found â†’ 404                                  â”‚
```

---

## 3. Schema Fields

```prisma
customSlug       String?   // PRO+: slug for slug.drivebook.com.au
customDomain     String?   // Studio+: full custom domain (e.g. book.yourdomain.com.au)
domainVerified   Boolean   @default(false)
domainVerifiedAt DateTime?
```

`customSlug` and `customDomain` are separate fields. Changing one does not affect the other.

---

## 4. DNS Setup by Tier

### BASIC
No public booking URL customisation. Upgrade prompt shown in branding page.

### PRO â€” `john.drivebook.com.au`
DNS is managed by us (Vercel wildcard). The instructor just picks a slug â€” no DNS work required on their end.

```
*.drivebook.com.au  â†’  cname.vercel-dns.com   (set once in Vercel DNS panel)
```

### Default URL â€” all tiers
Every instructor has a working URL at `<instructorId>.drivebook.com.au` from day one. No setup needed.

### STUDIO / BUSINESS â€” bring your own domain

**Option A â€” Use a subdomain (recommended, e.g. `book.yourdomain.com.au`)**

| Field | Value |
|---|---|
| Type | CNAME |
| Name / Host | `book` (just the prefix, not the full domain) |
| Value / Points to | `cname.vercel-dns.com` |

**Option B â€” Root domain (e.g. `yourdomain.com.au`)**

Root domains cannot use a standard CNAME record. Three options:

| Method | How |
|---|---|
| ALIAS / ANAME | Add `ALIAS @ â†’ cname.vercel-dns.com`. Supported by VentraIP, Cloudflare, Namecheap. |
| Cloudflare DNS | Move nameservers to Cloudflare (free). Add `CNAME @ â†’ cname.vercel-dns.com`. Cloudflare flattens it automatically. |
| www + redirect | `CNAME www â†’ cname.vercel-dns.com`, redirect root to www at registrar, enter `www.yourdomain.com.au` in the domain field. |

The value is always `cname.vercel-dns.com` regardless of which option is chosen.

---

## 5. Domain Verification Flow (Studio/Business)

```
Instructor enters domain â†’ POST /api/instructor/domain/verify
        â”‚
        â–¼
1. Try dns.resolveCname(domain)
   â”œâ”€â”€ resolves to *.vercel* â†’ verified âœ…
   â””â”€â”€ fails (CNAME not found)
        â”‚
        â–¼
2. Try dns.resolve4(domain) â€” handles ANAME/ALIAS records
   â”œâ”€â”€ IP in 76.76.21.x or 76.76.19.x (Vercel range) â†’ verified âœ…
   â””â”€â”€ not Vercel IP â†’ not verified âŒ
        â”‚
        â–¼
On success:
  - Set domainVerified=true, domainVerifiedAt=now in DB
  - Call Vercel API to add domain to project (auto-provisions SSL)
  - Return { verified: true, dnsMethod, vercelAdded }
```

**Why two DNS checks:** ANAME/ALIAS records are proprietary and invisible to standard CNAME queries. They resolve as A records externally. The fallback A-record check handles root domains using ANAME/ALIAS.

**Vercel auto-add:** When `VERCEL_API_TOKEN` and `VERCEL_PROJECT_ID` are set in environment variables, the domain is automatically added to the Vercel project on successful verification. SSL is provisioned within ~60 seconds. Without these env vars, the admin must add the domain manually in Vercel Dashboard â†’ Settings â†’ Domains.

**Required env vars for auto-add:**
```
VERCEL_API_TOKEN=    # vercel.com/account/tokens â†’ Create token (Full Account scope)
VERCEL_PROJECT_ID=   # Vercel Dashboard â†’ project â†’ Settings â†’ General â†’ Project ID
VERCEL_TEAM_ID=      # Leave blank for personal accounts
```

**Test endpoint:** `GET /api/admin/test-vercel-api` (admin only) â€” verifies credentials are working and returns current domain count.

---

## 6. Branding Page (Instructor)

**File:** `app/dashboard/branding/page.tsx`

| Section | Tier | What it does |
|---|---|---|
| Booking URL / Slug | PRO+ | Set `yourname.drivebook.com.au`. Shows default ID URL if no slug set. Availability check on type. |
| Custom Domain | Studio+ | Full domain wizard with DNS instructions, verify button, verified badge. Works alongside slug. |
| Social Links | PRO+ | WhatsApp, Instagram, Facebook, years of experience |
| Logo Upload | PRO+ | PNG/JPG/SVG up to 2MB |
| Brand Colors | PRO+ | Primary + secondary hex color pickers |
| Show branding toggle | PRO+ | White-labels booking page with logo + colors |

**Active URLs panel** (right column) shows all active URLs for the instructor:
- Default (always active)
- Slug (if set)
- Custom domain (if set, with Verified/Pending badge)

**DNS instructions** in the custom domain wizard:
- Subdomain: shows a single CNAME table with exact Name and Value fields
- Root domain: shows three expandable options (ALIAS/ANAME, Cloudflare, www redirect) each with a field-by-field table
- The value `cname.vercel-dns.com` is highlighted prominently at the top of the DNS section

---

## 7. Branding Tiers

| Feature | BASIC | PRO | STUDIO | BUSINESS |
|---|---|---|---|---|
| Public booking page | âœ… | âœ… | âœ… | âœ… |
| Default URL (by ID) | âœ… | âœ… | âœ… | âœ… |
| Custom slug | âŒ | âœ… | âœ… | âœ… |
| Custom logo + brand colors | âŒ | âœ… | âœ… | âœ… |
| White-label nav | âŒ | âœ… | âœ… | âœ… |
| Custom domain (bring your own) | âŒ | âŒ | âœ… | âœ… |
| Slug + custom domain simultaneously | âŒ | âŒ | âœ… | âœ… |
| Multiple instructors | âŒ | âŒ | âŒ | âœ… |

**Free domain perk (Studio):** The Studio plan advertises "bring your own domain". Domain registration assistance (1 year free domain) is a planned perk â€” currently fulfilled manually on request. Instructor connects any domain they already own.

---

## 8. Page Anatomy

**Files:**
- `app/subdomain/[slug]/page.tsx` â€” handles `*.drivebook.com.au` subdomains
- `app/custom-domain/page.tsx` â€” handles custom domains (looks up by `customDomain` field, renders using instructor ID)

**Caching:** `export const revalidate = 300` â€” page cached for 5 minutes.

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Desktop nav bar                                         â”‚
â”‚  [Logo/Brand]  [About] [Services] [Contact] [Book Now]  â”‚
â”‚  [WhatsApp]  [Login]                                    â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ JSON-LD structured data (LocalBusiness schema)          â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Hero banner (gradient using brand colors)               â”‚
â”‚  [Profile photo]  [Name]  [Stars or "New instructor"]   â”‚
â”‚  [Service area / suburb]  [Vehicle types]               â”‚
â”‚  [Years exp]  [Student count]  [Next available]         â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Trust badges strip                                      â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Left column          â”‚ Right column                     â”‚
â”‚ About / bio          â”‚ Booking form                     â”‚
â”‚ Services & Pricing   â”‚ Student reviews                  â”‚
â”‚ Contact details      â”‚                                  â”‚
â”‚ Social links         â”‚                                  â”‚
â”‚ Vehicle photo        â”‚                                  â”‚
â”‚ FAQ accordion        â”‚                                  â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Footer                                                  â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ MOBILE ONLY: Bottom nav bar (fixed)                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 9. Booking Flow (Subdomain)

**Entry point:** Student clicks "Book Your Lesson â†’" â€” opens a full-screen overlay.

**Wizard steps:**

| Step | Condition |
|---|---|
| Package | Always |
| Test Package | Only if `instructor.offersTestPackage = true` |
| When to Book | Always |
| Schedule | Only if `bookingType = now` |
| Your Details | Always |

**Payment:**
- Book Now â†’ `/booking/[id]/payment` (new tab)
- Book Later â†’ `/payment/wallet/[transactionId]` (wallet credited, book from dashboard later)

---

## 10. APIs

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/instructor/branding` | GET/PUT | Branding settings â€” reads/writes `customSlug` and `customDomain` separately |
| `/api/instructor/subdomain/check` | GET | Check if slug is available (queries `customSlug` field) |
| `/api/instructor/domain/verify` | POST | DNS verification â€” checks CNAME then A record (ANAME support), auto-adds to Vercel |
| `/api/admin/test-vercel-api` | GET | Admin: verify Vercel API credentials are working |
| `/api/public/bookings/bulk` | POST | Create booking + user account |
| `/api/payments/create-intent` | POST | Create Stripe PaymentIntent |
| `/api/availability/slots` | GET | Fetch available time slots |
| `/api/public/check-service-area` | GET | Check if lat/lng is within instructor's service radius |

---

## 11. File Reference

| File | Purpose |
|---|---|
| `middleware.ts` | Subdomain extraction + custom domain detection + rewrites |
| `app/subdomain/[slug]/page.tsx` | Public booking page â€” looks up by `customSlug` or `id` |
| `app/custom-domain/page.tsx` | Custom domain entry â€” looks up by `customDomain`, renders via instructor ID |
| `app/dashboard/branding/page.tsx` | Branding UI â€” slug section (PRO+) + custom domain wizard (Studio+) |
| `app/api/instructor/branding/route.ts` | Branding API â€” handles `customSlug` and `customDomain` as separate fields |
| `app/api/instructor/subdomain/check/route.ts` | Slug availability check |
| `app/api/instructor/domain/verify/route.ts` | DNS verification + Vercel auto-add |
| `app/api/admin/test-vercel-api/route.ts` | Admin credential test for Vercel API |
| `components/subdomain/SubdomainBookingEntry.tsx` | CTA button + full-screen overlay wrapper |
| `components/subdomain/SubdomainBookingWizard.tsx` | Multi-step booking wizard |
| `components/subdomain/SubdomainClientFeatures.tsx` | Mobile bottom nav + booking overlay |
| `components/subdomain/SubdomainDesktopNav.tsx` | Desktop anchor nav |

---

## 12. Known Gaps / Planned

| Item | Status |
|---|---|
| Free domain registration (Studio perk) | Planned â€” currently fulfilled manually on request. Registrar API (Namecheap/Cloudflare) needed for automation. |
| Vercel auto-add requires env vars | Set `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID` in Vercel env vars to enable. Manual add in Vercel Dashboard works as fallback. |
| Service area check is advisory only | Not enforced server-side |
| Custom FAQ not editable | FAQ is hardcoded. `pageContent` JSON field planned for Studio tier |
| Slot preview above booking form | Calendly-style slot preview would improve conversion |
