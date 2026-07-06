# Instructor Settings

**Route:** `/dashboard/settings`  
**Auth required:** INSTRUCTOR role  
**APIs:** `GET /api/instructor/profile`, `PATCH /api/instructor/profile`

---

## Profile

- Display name
- Phone number
- Bio (shown on public profile) — **75-word minimum enforced in UI** — live word counter in dashboard; auto-generated content block shown on subdomain page when bio < 75 words
- Years of experience
- Profile photo (Cloudinary upload)
- Base address (used for service radius calculation)
- Service radius (km)
- Service areas (text description)
- Languages spoken
- Video intro URL (`videoUrl`) — YouTube or Vimeo link; displayed as embed on subdomain page; supports Shorts, `/watch?v=`, `youtu.be/`, Vimeo formats
- Teaching specialties (`specialties`) — comma-separated tags from preset list (e.g. "Nervous learners,Manual specialist"); shown as chips on subdomain page under "Teaching style"

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
| `stripe_connect` | Recommended — automatic transfer via Stripe Connect. Stripe verifies your bank account and identity. You never share bank details with DriveBook. |
| `bank_transfer` | Fallback — admin manually transfers to your BSB/account. Requires admin to confirm your details before first transfer. |
| `manual` | Last resort — admin arranges payment directly. Contact support. |

**Setting up Stripe Connect:**

Click "Connect with Stripe" on the payout settings page. You'll be taken to Stripe's secure hosted page where you enter your bank details directly — DriveBook never sees them. Stripe verifies your bank account ownership and identity. Once complete, payouts are processed automatically every week.

If you need help setting up a Stripe account, visit [stripe.com/au](https://stripe.com/au) or contact support.

### Bank Details (for `bank_transfer` fallback only)

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

## PDA Test Configurations

**Route:** `/dashboard/settings` (PDA Test Configurations section)  
**API:** `GET/POST /api/instructor/pda-configs`  
**Status:** ✅ Fixed June 13, 2026 — Persistence issue resolved

Instructors can create multiple PDA (Practical Driving Assessment) test packages with different durations, prices, and test centres. Each config specifies what's included (pickup, dropoff, debriefing).

### Configuration Fields

| Field | Type | Description |
|---|---|---|
| `name` | String | Config name (e.g., "Standard PDA Test", "Advanced PDA") |
| `durationMinutes` | Number | Test duration (min 60, typically 165–180) |
| `price` | Number | Test price in AUD |
| `discountPercent` | Number \| null | Optional discount percentage |
| `testCentreIds` | String[] | Which test centres offer this config (min 1) |
| `includes` | Object | `{pickup: bool, dropoff: bool, debriefing: bool}` |
| `notes` | String \| null | Custom details (e.g., "includes mock test review") |
| `isActive` | Boolean | Whether config is available to book |

### Save Behavior

**Load:** Settings page fetches from both endpoints:
- `GET /api/instructor/settings` — general settings (hourly rate, service radius, working hours, etc.)
- `GET /api/instructor/pda-configs` — PDA configs

**Save:** Separated concerns:
- General settings saved to `/api/instructor/settings` (PUT) — Always saves if duration selected
- PDA configs saved to `/api/instructor/pda-configs` (POST) — Only complete configs (name + test centres)
- Incomplete configs are skipped, not blocking general save

**Example flow:**
1. User adds PDA config with name but no test centres (incomplete)
2. User clicks Save
3. General settings save ✅
4. PDA config skipped (incomplete), message shows "1 incomplete - fill in details to save"
5. User selects test centres for PDA config
6. User clicks Save again
7. General settings save ✅
8. PDA config saves ✅, message shows "1 configs saved"
9. On page refresh, all configs load from `/api/instructor/pda-configs`

### Booking Flow

When clients book a PDA test, they:
1. View available PDA configs (created here)
2. Select one config
3. Pick test centre (from config's `testCentreIds`)
4. Choose test date/time
5. Book via `/api/pda-bookings`

---

## Google Calendar

Instructors can connect Google Calendar to sync bookings automatically.

- `syncGoogleCalendar: true` — enables sync
- `googleTokenExpiry` — when the OAuth token expires
- `calendarBufferMode` — how buffer time is handled in calendar events

OAuth callback: `GET /api/calendar/callback`

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
