> **⚠️ Coming Soon** — This feature is planned for the future **BUSINESS** multi-provider tier. It is not yet implemented. BUSINESS is displayed in the subscription UI as Coming Soon with no Stripe price IDs or backend routes.

# Business Settings

**Route:** `/dashboard/settings`  
**Auth required:** INSTRUCTOR role + BUSINESS tier  

---

## School Profile

- School name
- Contact email and phone
- Business address
- ABN (Australian Business Number)
- School logo and branding colors

---

## Branding

BUSINESS tier has full branding access:
- Custom logo on all team instructor subdomain pages
- Brand colors applied across all team pages
- `showBrandingOnBookingPage: true` by default for PREMIUM (and planned for BUSINESS tier)

See `docs/03-instructor/BRANDING.md` for branding field details.

---

## Domain

BUSINESS tier can configure a custom domain (e.g. `book.myschool.com.au`) pointing to their DriveBook subdomain.

See [DOMAIN_SETUP.md](./DOMAIN_SETUP.md) for setup instructions.

---

## Notifications

School-wide notification preferences for:
- New bookings (any team instructor)
- Cancellations
- Payment received
- Instructor document expiry alerts

---

## Related

- [DOMAIN_SETUP.md](./DOMAIN_SETUP.md) — Custom domain configuration
- `docs/03-instructor/BRANDING.md` — Branding settings
