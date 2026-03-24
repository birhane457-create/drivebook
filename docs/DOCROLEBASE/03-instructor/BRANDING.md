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
