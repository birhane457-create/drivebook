# Subscription Tiers

**Config:** `lib/config/subscriptions.ts`  
**DB rates:** `PlatformSettings` (overrides config defaults)  
**Admin UI:** `/admin/pricing`

---

## Tier Comparison

| Feature | BASIC | PRO | BUSINESS |
|---------|-------|-----|----------|
| Monthly price | $29 | $79 | $199 |
| Annual price | $290 | $790 | $1,990 |
| Trial days | 14 | 14 | 30 |
| Commission rate | 15% | 12% | 10% |
| New student bonus | 8% | 10% | 12% |
| Max instructors | 1 | 1 | 999 |
| Branded booking page | ✗ | ✓ | ✓ |
| Custom domain | ✗ | ✗ | ✓ |
| Priority support | ✗ | ✓ | ✓ |
| API access | ✗ | ✗ | ✓ |
| Team calendar | ✗ | ✗ | ✓ |

---

## Commission Rates

Commission rates are the default values. Admins can override them via `/admin/pricing` → `PlatformSettings`. Changes apply to new bookings only.

See `docs/06-payments/COMMISSIONS.md` for full details.

---

## Branded Booking Page

PRO and BUSINESS instructors can show their logo, name, and colors on their subdomain page (`showBrandingOnBookingPage: true`). BASIC instructors can set colors but not logo/name white-labelling.

---

## Custom Domain

BUSINESS tier only. Allows mapping a custom domain (e.g. `book.myschool.com.au`) to the instructor's subdomain page.

---

## maxInstructors

Controls how many instructor accounts can be linked to a school:
- BASIC / PRO: 1 (solo instructor only)
- BUSINESS: 999 (driving school)

---

## Stripe Price IDs

Set in `.env`:
```
STRIPE_BASIC_MONTHLY_PRICE_ID=price_1T4wp7PFqwsHwRMqRmhAWBs5
STRIPE_BASIC_ANNUAL_PRICE_ID=price_1T4wp7PFqwsHwRMqiFRILVUz
STRIPE_PRO_MONTHLY_PRICE_ID=price_1T4wqTPFqwsHwRMqvm00c3L2
STRIPE_PRO_ANNUAL_PRICE_ID=price_1T4wqSPFqwsHwRMqiQaqOr4i
STRIPE_BUSINESS_MONTHLY_PRICE_ID=price_1T4wrUPFqwsHwRMq1PGY8jT5
STRIPE_BUSINESS_ANNUAL_PRICE_ID=price_1T4wrVPFqwsHwRMqgR8W934u
```

---

## Related

- [TRIAL.md](./TRIAL.md) — Trial period mechanics
- [BILLING.md](./BILLING.md) — Billing and payment
- [UPGRADE_FLOW.md](./UPGRADE_FLOW.md) — Changing tiers
- `docs/06-payments/COMMISSIONS.md` — Commission rate details
