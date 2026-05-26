# Subscription Tiers

**Config:** `lib/config/subscriptions.ts`  
**DB rate overrides:** `PlatformSettings` (admin can override defaults)  
**Admin UI:** `/admin/pricing`  
**Last updated:** May 2026

---

## Tier Comparison

| Feature | BASIC | PRO | STUDIO | BUSINESS |
|---------|-------|-----|--------|----------|
| Monthly price | $29 | $79 | $129 | $199 |
| Annual price | $290 | $790 | $1,290 | $1,990 |
| Trial days | 14 | 14 | 14 | 30 |
| Commission rate | 15% | 12% | 11% | 10% |
| Max instructors | 1 | 1 | 1 | 999 |
| Offline bookings | ✗ | ✓ | ✓ | ✓ |
| Branded booking page | ✗ | ✓ | ✓ | ✓ |
| Custom slug | ✗ | ✓ | ✓ | ✓ |
| Custom domain | ✗ | ✗ | ✓ | ✓ |
| Priority support | ✗ | ✓ | ✓ | ✓ |
| API access | ✗ | ✗ | ✗ | ✓ |
| Team calendar | ✗ | ✗ | ✗ | ✓ (deferred) |

---

## Commission Rates

Default rates are in `lib/config/subscriptions.ts`. Admins can override them via `/admin/pricing` → `PlatformSettings`. Changes apply to new bookings only — existing bookings retain the rate at time of booking.

See `docs/DOCROLEBASE/06-payments/COMMISSIONS.md` for full details.

---

## Stripe Price IDs (Test Mode)

Set in `.env` and Vercel environment variables:

```
STRIPE_BASIC_MONTHLY_PRICE_ID=price_1T4wp7PFqwsHwRMqRmhAWBs5
STRIPE_BASIC_ANNUAL_PRICE_ID=price_1T4wp7PFqwsHwRMqiFRILVUz
STRIPE_PRO_MONTHLY_PRICE_ID=price_1T4wqTPFqwsHwRMqvm00c3L2
STRIPE_PRO_ANNUAL_PRICE_ID=price_1T4wqSPFqwsHwRMqiQaqOr4i
STRIPE_STUDIO_MONTHLY_PRICE_ID=price_1TMSdrPFqwsHwRMqcwzCLsLG
STRIPE_STUDIO_ANNUAL_PRICE_ID=price_1TMSdrPFqwsHwRMqFuJ85ijO
STRIPE_BUSINESS_MONTHLY_PRICE_ID=price_1T4wrUPFqwsHwRMq1PGY8jT5
STRIPE_BUSINESS_ANNUAL_PRICE_ID=price_1T4wrVPFqwsHwRMqgR8W934u
```

**Note:** All price IDs above are test mode. Replace with live mode IDs before go-live.

---

## Tier-Specific Features

### BASIC
Solo instructor. Standard commission. No branding, no offline bookings.

### PRO
Adds: offline/cash booking tracking, branded booking page, custom slug (`name.drivebook.com.au`), lower commission, priority support.

### STUDIO
Adds: custom domain (`yourdomain.com.au`) with DNS wizard, even lower commission. Designed for established instructors with their own brand.

### BUSINESS
Multi-instructor school management. Lowest commission. Team calendar, API access. **Currently deferred — "Coming Soon" in UI.**

---

## Subscription Status Values

| Status | Meaning |
|--------|---------|
| `TRIAL` | Free trial period, full access |
| `ACTIVE` | Paid subscription, full access |
| `PAST_DUE` | Payment failed, read-only mode |
| `CANCELLED` | Cancelled by instructor or after failed retries, read-only mode |
| `EXPIRED` | Subscription period ended without renewal, read-only mode |

Read-only mode: instructor can view all data but cannot create bookings, add clients, or change settings. See [TRIAL.md](./TRIAL.md).

---

## Related

- [TRIAL.md](./TRIAL.md) — Trial period and expiry behaviour
- [BILLING.md](./BILLING.md) — Billing cycles and payment
- [UPGRADE_FLOW.md](./UPGRADE_FLOW.md) — Changing tiers
- `docs/DOCROLEBASE/06-payments/COMMISSIONS.md` — Commission rate details
