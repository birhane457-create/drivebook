# Instructor Settings

**Route:** `/dashboard/settings`  
**Auth required:** INSTRUCTOR role  
**APIs:** `GET /api/instructor/profile`, `PATCH /api/instructor/profile`

---

## Profile

- Display name
- Phone number
- Bio (shown on public profile)
- Years of experience
- Profile photo (Cloudinary upload)
- Base address (used for service radius calculation)
- Service radius (km)
- Service areas (text description)
- Languages spoken

---

## Vehicle

- Car make, model, year
- Vehicle types (manual, automatic, both)
- Car photo (Cloudinary upload)

---

## Documents

Instructors must upload compliance documents before approval. Managed via `/dashboard/documents`.

Required documents:
- Driver's licence (front + back)
- Insurance policy
- Police check
- Working With Children (WWC) check
- Photo ID
- Vehicle registration

Document expiry dates are tracked:
- `licenseExpiry`
- `insuranceExpiry`
- `policeCheckExpiry`
- `wwcCheckExpiry`

Admin reviews documents at `/admin/documents/review/[instructorId]`.

---

## Tax & Payout

**Route:** `/dashboard/settings/payout`  
**API:** `GET/POST /api/instructor/payout-settings`

Instructors configure how they receive payouts and provide tax details for ATO compliance.

### Payout Method

| Method | Description |
|---|---|
| `stripe_connect` | Automatic transfer to Stripe Connect account |
| `bank_transfer` | Manual transfer to BSB/account on file |
| `manual` | Admin arranges payment directly |

### Bank Details (for `bank_transfer`)

- BSB (`bankBsb`) — 6 digits, format XXX-XXX. Validated for format on save. The platform maps known BSB prefixes to bank names (e.g. `062` → Commonwealth Bank) for UX feedback — this does not verify account ownership.
- Account number (`bankAccount`) — 6–10 digits
- Account name (`bankAccountName`) — account holder name

Bank details are not verified against your identity. Admin will confirm before processing your first bank transfer payout.

> For security, Stripe Connect is the recommended payout method. Stripe verifies your identity and bank account ownership. Bank transfer relies on admin manual confirmation only — there is no automated ownership check.

### Tax Details

| Field | Description |
|---|---|
| `abn` | Australian Business Number — 0% withholding if verified |
| `abnVerified` | `true` after admin confirms ABN via ABR API or manual review |
| `abnStatus` | `PENDING` \| `ACTIVE` \| `CANCELLED` \| `REVIEW_REQUIRED` |
| `abnEntityName` | Entity name returned by ABR — stored for audit trail |
| `abnVerifiedAt` | Timestamp of last verification |
| `abnVerifiedBy` | Admin user ID who verified, or `SYSTEM` for automatic |
| `gstRegistered` | Set automatically from ABR response — not a manual toggle |
| `withholdingTaxRate` | 0% if ABN verified; 47% otherwise. Set automatically — not editable by instructor |

Providing a valid ABN eliminates ATO withholding tax from your payouts. Without a verified ABN, the platform withholds 47% (ATO statutory rate) from each payout.

When you enter an ABN, the platform automatically checks it against the Australian Business Register (ABR). The name on your ABN must match your instructor profile name:
- Exact or near-exact match (≥80% similarity) → auto-approved
- Partial match (50–79%) → flagged as `REVIEW_REQUIRED` — admin must manually confirm
- No match (<50%) → admin review required before payouts are enabled

`gstRegistered` is set from the ABR response, not from user input. If the ABR shows your ABN is GST-registered, the GST component is recorded on each payout for your reporting.

When you save a new ABN, verification resets to `PENDING` and withholding returns to 47% until admin re-verifies. Saving other settings (bank details, payout method) without changing your ABN does not affect your verification status or withholding rate.

ABNs are rechecked weekly against the ABR. If your ABN is cancelled, `abnVerified` is cleared automatically and payouts are blocked until resolved.

> TFN collection is not currently active. The field is commented out in the schema and can be enabled if legally required.

---

## Google Calendar

Instructors can connect Google Calendar to sync bookings automatically.

- `syncGoogleCalendar: true` — enables sync
- `googleTokenExpiry` — when the OAuth token expires
- `calendarBufferMode` — how buffer time is handled in calendar events

OAuth callback: `GET /api/calendar/callback`

**Note:** `GOOGLE_REDIRECT_URI` in `.env` must point to the correct domain. Current value has a typo (`deivebook` instead of `drivebook`) — needs fixing.

---

## Notifications

Instructors receive in-app notifications for:
- New booking created
- Booking cancelled
- Booking rescheduled
- Payment received
- New client review

Notification preferences can be configured to also send SMS (via Twilio) and email.

---

## Subscription

Link to `/dashboard/subscription` — manage tier, billing, and payment method.

---

## Related

- [BRANDING.md](./BRANDING.md) — Logo, colors, subdomain
- [AVAILABILITY.md](./AVAILABILITY.md) — Working hours
- [EARNINGS.md](./EARNINGS.md) — Earnings and payout details
- `docs/07-subscriptions/BILLING.md` — Subscription billing
