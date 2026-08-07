# Instructor Marketing Tools

**Routes:** `/dashboard/marketing` (flyer), `/dashboard/marketing/cards` (business cards)
**Auth required:** INSTRUCTOR role
**Nav location:** Dashboard sidebar → Marketing section

---

## Overview

Two marketing tools are available to instructors from the dashboard:

| Tool | Route | What it produces |
|------|-------|-----------------|
| Marketing Flyer | `/dashboard/marketing` | A5 printable flyer with QR code — 3 style variants |
| Business Cards | `/dashboard/marketing/cards` | A4 sheet of 10 business cards (front + back), print-ready PDF |

Both tools are co-located under `/dashboard/marketing` to keep marketing materials in one place. Future tools (vehicle stickers, social templates) will follow the same pattern as sub-routes.

---

## Marketing Flyer

**File:** `app/dashboard/marketing/page.tsx`

The flyer page produces an A5 printable flyer in 3 style variants:
- **Dark** — navy background, sky-blue accents
- **Light** — white background, blue gradient header
- **Minimal** — ink-saving black and white

Two flyer types are available:
- **Instructor flyer** — instructor name/brand, photo, rate, QR code to their booking page
- **Platform flyer** — DriveBook recruitment flyer for leaving at driving schools, tyre shops, etc.

The flyer content adapts to the instructor's subscription tier following the platform's identity hierarchy:
- **BASIC/PRO** — instructor's display name is the hero
- **STUDIO** — brand name prominent, instructor name underneath
- **BUSINESS** — school name is the entire brand

### Printing
Print using browser print dialog (`Ctrl+P` / `⌘+P`). The flyer renders at A5 with real CSS units. The component includes a print-optimised CSS block that hides the browser UI and renders the flyer at physical size.

---

## Business Cards

**File:** `app/dashboard/marketing/cards/page.tsx`
**Components:** `components/marketing/cards/`

### What the page does

1. Loads instructor profile data (name, phone, booking URL, suburb, car, transmission)
2. Shows a live preview of the card front and back
3. Lets the instructor adjust the editable fields
4. Generates a print-ready PDF client-side (no server involved)
5. Optionally submits a request for a physical printed pack

### Card dimensions

Australian standard business card: **85 × 55 mm**

The PDF uses this grid on an A4 sheet:
```
2 columns × 5 rows = 10 cards per sheet
Margin left/right: 19.4 mm each
Margin top/bottom: 13.5 mm each
```

### Card design

**Front side:**
- DriveBook wordmark (sky-blue, uppercase)
- Instructor name (bold, wraps to 2 lines if needed)
- Role: "Driving Instructor"
- Phone number (`Ph: 04XX XXX XXX`)
- Service area suburbs (editable)
- Car label + transmission type (`Toyota Corolla | Automatic`)
- QR code linking to instructor's booking URL
- Footer: instructor's booking domain (`john.drivebook.com.au` or custom domain)

**Back side:**
- Driving progress tracker — 6-row table (Date / Focus / Signed Off)
- Encourages students to keep the card in their wallet
- Footer: instructor's booking domain + "Book 24/7 online"
- Non-editable — standardised across all instructors

### Data pre-fill

All fields are loaded from the instructor profile automatically:

| Field | Source | Editable on card? |
|-------|--------|-------------------|
| Name | `displayName` or `name` | ❌ Locked |
| Phone | `phone` | ❌ Locked |
| Booking URL | subdomain or custom domain | ❌ Locked |
| Footer domain | custom domain (if verified) or subdomain | ❌ Auto-derived |
| QR code destination | same as booking URL | ❌ Auto |
| Service areas | `suburb` extracted from `baseAddress` | ✅ Editable |
| Vehicle | `carMake + carModel` | ✅ Editable |
| Transmission | parsed from `vehicleTypes` | ✅ Toggle (Auto/Manual/Both) |

The editable fields are for card-specific customisation only. Changing suburbs on the card does not update the instructor's profile address.

### PDF generation

The PDF is generated entirely in the browser using jsPDF (dynamically imported to keep it out of the initial bundle). No server request is made for PDF generation.

**Page 1:** 10 card fronts, dark navy design
**Page 2:** 10 card backs, light grey design, columns mirrored for duplex long-edge printing

Crop marks are added at all 15 intersection points to guide cutting.

**Why no emoji:** jsPDF's built-in Helvetica font is Latin-only. Phone/location/car labels use short uppercase text (`Ph:`, `Car:`) instead of emoji to ensure clean output on all systems.

### Print request (physical cards)

Instructors can request a physically printed pack from the "Request Printed Cards" section:
- Available quantities: 50, 100, 200 cards
- Optional delivery notes
- Only one active order allowed at a time (duplicate guard)
- Admin receives an email notification on submission

**Order status lifecycle:**
```
PENDING → APPROVED → PRINTING → READY → DELIVERED
                                         ↓
                                    CANCELLED
```

Admin fulfils orders manually. No wallet deduction in v1 — price and payment method are handled outside the platform initially.

**Database dependency:** The `CardOrder` table requires the `add_login_device_and_card_orders` Prisma migration before print requests will work. PDF download works without the migration.

### Component architecture

The card engine is deliberately split so the same components can power a future public `/business-card` page (marketing funnel for non-DriveBook instructors):

```
components/marketing/cards/
├── types.ts                   ← CardData type (instructorName, phone, suburbs, transmission,
│                                 bookingUrl, carLabel, footerDomain, showDriveBookFooter)
├── BusinessCardPreview.tsx    ← React component — renders front or back at 320×207px
├── BusinessCardForm.tsx       ← Edit form — locked + editable fields
├── BusinessCardPDF.ts         ← jsPDF generator — browser only, dynamic import
└── CardQRCode.tsx             ← QR code wrapper (qrcode.react)
```

The card engine does not know whether the user is logged in. It receives a `CardData` object and renders it. The dashboard page supplies locked profile data; a future public page would supply user-entered data and set `showDriveBookFooter: true`.

---

## Related

- `docs/DOCROLEBASE/03-instructor/BRANDING.md` — booking page branding, subdomain, custom domain
- `docs/DOCROLEBASE/07-subscriptions/TIERS.md` — feature access by tier
- `docs/DOCROLEBASE/TODO.md` — future public `/business-card` lead funnel (planned)
