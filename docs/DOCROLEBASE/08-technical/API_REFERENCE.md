# API Reference

**Status:** ✅ Complete
**Last Updated:** 2026-09-02
**Routes Documented:** 169 of 169

Public and authenticated API endpoints in DriveBook. Base URL: `https://drivebook.com.au/api`

---

## Auth

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET/POST | `/api/auth/[...nextauth]` | — | NextAuth handlers |
| GET | `/api/auth/check-email` | — | Check if email exists |
| POST | `/api/auth/device-check` | Session | Record browser device after login |
| POST | `/api/auth/forgot-password` | — | Send password reset email |
| POST | `/api/auth/mobile-login` | — | JWT login for mobile |
| POST | `/api/auth/resend-verification` | — | Resend instructor verification email |
| POST | `/api/auth/reset-password` | — | Reset password with token |
| POST | `/api/auth/set-password` | Session | Set new password for authenticated user |
| POST | `/api/auth/verify-email` | — | Verify email token |
| GET | `/api/auth/verify-setup-token` | Session | Verify account setup token (rate limited: 20/15min per IP) |

---

## Public (no auth)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/abn/verify` | — | Validate ABN checksum + ABR lookup |
| GET | `/api/availability/slots` | — | Get available time slots |
| GET | `/api/branding/[slug]` | — | Get instructor branding by subdomain slug |
| GET | `/api/health` | — | Health check |
| GET | `/api/instructors/[id]/availability` | — | Get available slots for a specific instructor |
| GET | `/api/instructors/search` | — | Search/browse instructors by location |
| GET | `/api/public/bookings/[id]` | — | Get booking for payment page |
| GET | `/api/public/bookings/[id]/cancellation-policy` | — | Get cancellation policy for booking |
| GET | `/api/public/bookings/[id]/payment-status` | — | Booking payment status |
| GET | `/api/public/bookings/[id]/payment-summary` | — | Payment summary for public booking |
| GET | `/api/public/bookings/[id]/timeline` | — | Booking timeline and notes |
| POST | `/api/public/bookings` | — | Create public booking |
| POST | `/api/public/bookings/[id]/cancel` | — | Cancel booking (public flow) |
| POST | `/api/public/bookings/[id]/reschedule` | — | Reschedule booking (public flow) |
| POST | `/api/public/bookings/bulk` | — | Create bulk booking (subdomain flow) |
| GET | `/api/public/check-service-area` | — | Check if address is within service area |
| GET | `/api/public/instructors` | — | List approved and active instructors |
| GET | `/api/public/pricing` | — | Public platform pricing settings |
| POST | `/api/register` | — | Register new user account |

### ABN Verify — Request / Response

`POST /api/abn/verify`

```json
{
  "abn": "12345678901",
  "instructorName": "Jane Smith"
}
```

`instructorName` is optional. When provided, the response includes a name match score against the ABR entity name.

```json
{
  "valid": true,
  "abnStatus": "ACTIVE",
  "entityName": "Jane Smith",
  "gstRegistered": false,
  "nameMatchScore": 1.0,
  "nameMatchStatus": "MATCHED"
}
```

`nameMatchStatus` values:
- `MATCHED` — score ≥ 0.8, auto-approved
- `REVIEW_REQUIRED` — score 0.5–0.79, admin must confirm
- `NO_MATCH` — score < 0.5, admin review required
- `null` — `instructorName` not provided

Returns `valid: false` with `error` if checksum fails or ABN is cancelled. Returns `warning` if `ABR_GUID` is not configured (checksum-only mode). `gstRegistered` is sourced from ABR — do not trust user input for this field.

---

## Availability

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/availability` | Session | Check availability |
| POST/DELETE | `/api/availability/check-and-reserve` | Session | Reserve a slot for booking flow |
| POST | `/api/availability/check-and-reserve-status` | Session | Check if a reserved slot is still valid (before payment) |
| GET | `/api/availability/pda-tests` | Session | Get PDA test availability slots |
| POST | `/api/availability/validate-slots` | Session | Validate selected time slots |

---

## Bookings (Instructor)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/bookings` | INSTRUCTOR | List instructor bookings |
| POST | `/api/bookings` | INSTRUCTOR | Create booking for client |
| GET | `/api/bookings/[id]` | INSTRUCTOR | Get booking detail |
| PATCH | `/api/bookings/[id]` | INSTRUCTOR | Update booking |
| POST | `/api/bookings/[id]/cancel` | INSTRUCTOR/CLIENT/ADMIN | Cancel booking with refund |
| POST | `/api/bookings/[id]/check-in` | INSTRUCTOR/JWT | Check in to lesson |
| POST | `/api/bookings/[id]/check-out` | INSTRUCTOR | Check out completed lesson |
| POST | `/api/bookings/[id]/confirm` | INSTRUCTOR | Manual confirm booking |
| PATCH | `/api/bookings/[id]/reschedule` | INSTRUCTOR | Reschedule booking |
| POST | `/api/bookings/batch` | Session | Create batch bookings (sequential to avoid slot conflicts) |
| POST | `/api/bookings/combined` | Session | Create combined lesson booking |
| GET | `/api/bookings/lookup` | Session | Look up booking by phone/reference |
| GET/POST | `/api/bookings/mobile` | JWT | Mobile booking management |
| POST | `/api/bookings/offline` | Session | Create offline/cash booking |
| POST | `/api/bookings/send-payment-link` | INSTRUCTOR | Email wallet top-up link to client |

---

## Business

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET/PUT | `/api/business` | Session | Get or update business record for current provider |
| GET/PUT | `/api/business/ai-config` | Session | AI receptionist config (requires PRO+ subscription) |
| GET/PUT | `/api/business/branding` | Session | Business branding settings |
| GET/PUT | `/api/business/capabilities` | Session | Business capabilities (PRO+ gated features) |
| GET/PUT | `/api/business/config` | Session | Business configuration |
| GET/POST | `/api/business/services` | Session | Business service offerings |
| GET/PUT | `/api/business/terminology` | Session | Custom terminology settings |

---

## Calendar

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/calendar/callback` | Session | Google Calendar OAuth callback (signed state) |
| GET/POST/DELETE | `/api/google-calendar` | Session | Google Calendar connection management |
| GET/POST/DELETE | `/api/google-calendar/mobile` | JWT | Google Calendar management (mobile) |
| PUT | `/api/google-calendar/settings` | Session | Update calendar buffer mode preference |
| POST | `/api/google-calendar/sync` | Session | Trigger Google Calendar sync |
| POST | `/api/google-calendar/sync/mobile` | JWT | Trigger Google Calendar sync (mobile) |

---

## Client

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/client/bookings/[id]` | CLIENT | Get client booking by ID |
| POST | `/api/client/bookings/create-bulk` | CLIENT | Book multiple lessons from wallet |
| PUT | `/api/client/bookings/[id]/reschedule` | CLIENT | Reschedule booking |
| GET | `/api/client/bookings/mobile` | CLIENT | Client bookings (mobile) |
| POST | `/api/client/confirm-package-booking` | CLIENT | Finalise a package booking |
| GET | `/api/client/current-instructor` | CLIENT | Get current assigned instructor |
| GET | `/api/client/dashboard/mobile` | CLIENT | Client dashboard data (mobile) |
| GET | `/api/client/instructors/mobile` | CLIENT | Browse instructors (mobile) |
| GET | `/api/client/my-performance` | CLIENT | Lesson performance data |
| GET | `/api/client/notifications` | CLIENT | Client notifications |
| GET | `/api/client/notifications/unread-count` | CLIENT | Unread notification count |
| GET | `/api/client/packages` | CLIENT | Client lesson packages |
| GET/POST | `/api/client/packages/mobile` | CLIENT | Lesson packages (mobile) |
| GET | `/api/client/pending-reviews` | CLIENT | Bookings awaiting review |
| GET/PUT | `/api/client/profile` | CLIENT | Client profile |
| GET | `/api/client/quotes` | CLIENT | Client quote requests |
| POST | `/api/client/quotes/request` | CLIENT | Submit a new quote request |
| GET | `/api/client/recommendations` | CLIENT | Instructor recommendations |
| POST | `/api/client/schedule-package-hours` | CLIENT | Schedule hours from a lesson package |
| GET | `/api/client/transactions` | CLIENT | Client transaction history |
| GET | `/api/client/wallet` | CLIENT | Client wallet balance |
| POST | `/api/client/wallet-add` | CLIENT | Add wallet credit (internal/webhook) |
| POST | `/api/client/wallet-topup-intent` | CLIENT | Create Stripe wallet top-up intent |
| GET | `/api/client/wallet/mobile` | CLIENT | Wallet balance (mobile) |
| GET | `/api/client/wallet/summary` | CLIENT | Wallet balance and recent history |
| GET/POST | `/api/clients` | Session | Instructor's client list |
| GET | `/api/clients/mobile` | JWT | Client list (mobile) |

---

## Cron

All cron endpoints require `Authorization: Bearer <CRON_SECRET>`. Configured in `vercel.json`.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/cron/apply-rate-changes` | CRON_SECRET | Apply scheduled commission rate changes (daily 00:05 UTC) |
| GET | `/api/cron/check-trial-expiry` | CRON_SECRET | Expire instructor trials |
| GET | `/api/cron/cleanup-expired-bookings` | CRON_SECRET | Expire stale PENDING_PAYMENT bookings (every 5 min) |
| GET | `/api/cron/document-expiry-check` | CRON_SECRET | Notify instructors with expiring documents (weekly Mon 02:00 UTC) |
| GET | `/api/cron/health-check` | CRON_SECRET | Monitor cron job health and flag late runs |
| GET | `/api/cron/instructor-onboarding` | CRON_SECRET | Send onboarding nudges to incomplete instructor accounts |
| GET | `/api/cron/instructor-setup-nudge` | CRON_SECRET | Nudge instructors who haven't completed setup |
| GET/POST | `/api/cron/notification-retry` | CRON_SECRET | Retry failed notifications |
| GET/POST | `/api/cron/notifications` | CRON_SECRET | Send scheduled notifications |
| GET | `/api/cron/recheck-abn` | CRON_SECRET | Recheck all verified ABNs against ABR (weekly Mon 02:00 UTC) |
| GET | `/api/cron/reconcile-stripe` | CRON_SECRET | Daily Stripe vs DB reconciliation (daily 19:00 UTC) |
| GET | `/api/cron/lesson-reminders` | CRON_SECRET | Send 24hr lesson reminders (daily 22:00 UTC) |
| GET | `/api/cron/send-trial-expiry-alerts` | CRON_SECRET | Email trial expiry warnings (once per subscription) |
| GET | `/api/cron/slot-cleanup` | CRON_SECRET | Clean up expired slot reservations |
| GET | `/api/cron/weekly-payouts` | CRON_SECRET | Trigger weekly payout processing (Mon 18:00 UTC) |

---

## Dashboard

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/dashboard/mobile` | JWT | Instructor dashboard data (mobile) |

---

## Instructor

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/instructor/availability/exceptions` | INSTRUCTOR | List availability exceptions |
| POST | `/api/instructor/availability/exceptions` | INSTRUCTOR | Create availability exception |
| DELETE | `/api/instructor/availability/exceptions` | INSTRUCTOR | Delete availability exception |
| POST | `/api/instructor/bio-generate` | INSTRUCTOR | AI-generate instructor bio (rate limited: 5/hr) |
| GET | `/api/instructor/branding` | INSTRUCTOR | Get branding settings |
| POST | `/api/instructor/branding` | INSTRUCTOR | Update branding settings |
| GET/POST | `/api/instructor/card-order` | INSTRUCTOR | Physical business card orders |
| GET | `/api/instructor/client-lesson-feedback` | INSTRUCTOR | Feedback given by clients |
| GET | `/api/instructor/client-performance` | INSTRUCTOR | Client performance data |
| GET | `/api/instructor/clients/[id]` | INSTRUCTOR | Get instructor client detail |
| GET/POST | `/api/instructor/consent` | INSTRUCTOR | Consent records management |
| GET/POST | `/api/instructor/custom-packages` | INSTRUCTOR | Custom lesson package management |
| GET/DELETE | `/api/instructor/devices` | INSTRUCTOR | Recognised device management |
| GET/POST | `/api/instructor/documents` | INSTRUCTOR | Instructor document uploads |
| POST | `/api/instructor/documents/expiry` | INSTRUCTOR | Update document expiry dates |
| GET/POST | `/api/instructor/documents/mobile` | INSTRUCTOR | Document management (mobile/JWT) |
| POST | `/api/instructor/domain/verify` | INSTRUCTOR | Verify custom domain via Vercel API |
| GET | `/api/instructor/earnings` | INSTRUCTOR | Earnings breakdown |
| GET | `/api/instructor/earnings/this-week` | INSTRUCTOR | Current week earnings summary |
| DELETE | `/api/instructor/expenses/[id]` | INSTRUCTOR | Delete expense |
| GET | `/api/instructor/expenses` | INSTRUCTOR | List business expenses |
| POST | `/api/instructor/expenses` | INSTRUCTOR | Add expense |
| GET/POST | `/api/instructor/lesson-feedback` | INSTRUCTOR | Lesson feedback (COACHING and MOCK types) |
| GET | `/api/instructor/lesson-feedback/summary` | INSTRUCTOR | Aggregated feedback summary |
| GET | `/api/instructor/packages` | INSTRUCTOR | Available lesson packages |
| GET | `/api/instructor/payout-settings` | INSTRUCTOR | Get payout method and tax details |
| POST | `/api/instructor/payout-settings` | INSTRUCTOR | Update payout method and tax details |
| GET | `/api/instructor/payouts` | INSTRUCTOR | Payout history |
| GET/POST | `/api/instructor/pda-configs` | INSTRUCTOR | PDA test configuration management |
| GET | `/api/instructor/profile` | INSTRUCTOR | Get instructor profile |
| PATCH | `/api/instructor/profile` | INSTRUCTOR | Update instructor profile |
| GET | `/api/instructor/profile/mobile` | INSTRUCTOR | Instructor profile (mobile/JWT) |
| GET | `/api/instructor/quotes` | INSTRUCTOR | Quote requests from clients |
| GET | `/api/instructor/receipts/weekly` | INSTRUCTOR | Weekly receipt/earnings report |
| POST | `/api/instructor/remind-client` | INSTRUCTOR | Send lesson reminder to client |
| GET/POST | `/api/instructor/service-areas` | INSTRUCTOR | Service area management |
| GET | `/api/instructor/settings` | INSTRUCTOR | Get instructor settings |
| PUT | `/api/instructor/settings` | INSTRUCTOR | Update settings including working hours |
| GET/PUT | `/api/instructor/settings/mobile` | INSTRUCTOR | Settings management (mobile) |
| POST | `/api/instructor/stripe-connect/onboard` | INSTRUCTOR | Initiate Stripe Connect onboarding |
| DELETE | `/api/instructor/subscription` | INSTRUCTOR | Cancel subscription |
| GET | `/api/instructor/subscription` | INSTRUCTOR | Get subscription details |
| POST | `/api/instructor/subscription` | INSTRUCTOR | Create or update subscription |
| POST | `/api/instructor/subscription/billing-portal` | INSTRUCTOR | Open Stripe billing portal |
| GET/POST/DELETE | `/api/instructor/subscription/mobile` | JWT | Subscription management (mobile) |
| POST | `/api/instructor/subscription/sync` | INSTRUCTOR | Sync subscription from Stripe after portal return |
| GET | `/api/instructor/subdomain/check` | INSTRUCTOR | Check subdomain availability |
| GET/PUT | `/api/instructor/test-package` | INSTRUCTOR | Test package settings |
| GET | `/api/instructor/voice-line` | INSTRUCTOR | Instructor voice line details |
| POST | `/api/instructor/whiteboard/upload` | INSTRUCTOR | Upload whiteboard image (PNG data URI) |
| GET | `/api/instructors/recommendations` | Session | Instructor recommendations |

### Payout Settings — Request Body

`POST /api/instructor/payout-settings`

```json
{
  "payoutMethod": "stripe_connect | bank_transfer | manual",
  "bankBsb": "062000",
  "bankAccount": "12345678",
  "bankAccountName": "Jane Smith",
  "abn": "12345678901",
  "gstRegistered": true
}
```

Saving a new ABN resets `abnVerified = false` and `withholdingTaxRate = 47`. Admin must re-verify before payouts resume at 0% withholding.

---

## Admin

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/admin/ai-brief/history` | ADMIN | AI copilot conversation history |
| POST | `/api/admin/ai-brief` | ADMIN | AI copilot system prompt / role config |
| POST | `/api/admin/ai-query` | ADMIN | AI copilot query endpoint |
| GET | `/api/admin/audit-log` | ADMIN | Audit log with filters |
| GET | `/api/admin/booking-payment-status` | ADMIN | Booking payment status (last 24 hours) |
| GET | `/api/admin/bookings` | ADMIN | List all bookings |
| PATCH | `/api/admin/bookings` | ADMIN | Force-update booking status |
| POST | `/api/admin/bookings` | ADMIN | Create booking for client |
| GET | `/api/admin/clients` | ADMIN | List all clients |
| GET | `/api/admin/clients/[id]` | ADMIN | Client detail |
| GET | `/api/admin/clients/[id]/wallet` | ADMIN | Client wallet detail |
| POST | `/api/admin/clients/[id]/wallet/add-credit` | ADMIN | Add wallet credit to client |
| POST | `/api/admin/clients/[id]/wallet/deduct-credit` | ADMIN | Deduct wallet credit from client |
| POST | `/api/admin/contact` | ADMIN | Send email/SMS to a user |
| GET | `/api/admin/cron-jobs` | ADMIN | Cron job health status |
| GET | `/api/admin/daily-summary` | ADMIN | Daily platform operations summary |
| GET | `/api/admin/disputes` | ADMIN | Dispute list (filter: open/won/lost/all) |
| PATCH | `/api/admin/disputes` | ADMIN | Update dispute status |
| GET | `/api/admin/documents/compliance` | ADMIN | Document compliance list |
| GET | `/api/admin/documents/instructor/[id]` | ADMIN | Instructor document review |
| GET | `/api/admin/export` | ADMIN | Export platform data as CSV |
| GET | `/api/admin/fortress-dashboard` | ADMIN | Platform stats overview |
| GET | `/api/admin/health-score` | ADMIN | Platform health score metrics |
| GET | `/api/admin/instructor-risk` | ADMIN | Instructor risk assessment (bookings last 30d) |
| GET | `/api/admin/instructors` | ADMIN | List all instructors |
| GET | `/api/admin/instructors/[id]` | ADMIN | Instructor detail |
| POST | `/api/admin/instructors/[id]/approve` | ADMIN | Approve instructor application |
| POST | `/api/admin/instructors/[id]/reject` | ADMIN | Reject instructor application |
| POST | `/api/admin/instructors/[id]/suspend` | ADMIN | Suspend instructor account |
| POST | `/api/admin/instructors/[id]/verify-abn` | ADMIN | Manually verify instructor ABN |
| GET | `/api/admin/ledger` | ADMIN | Platform ledger balance and recent entries |
| GET/POST | `/api/admin/learning-content` | ADMIN | Learning content management |
| GET | `/api/admin/me/permissions` | ADMIN | Current admin permissions (reads from DB) |
| GET | `/api/admin/operations-timeline` | ADMIN | Platform operations timeline |
| GET | `/api/admin/payouts` | ADMIN | Payout list |
| GET | `/api/admin/payouts/preview-all` | ADMIN | Preview all pending payouts |
| POST | `/api/admin/payouts/process` | ADMIN | Process single payout (two-phase) |
| POST | `/api/admin/payouts/process-all` | ADMIN | Process all eligible payouts |
| DELETE | `/api/admin/payouts/[payoutId]/hold` | ADMIN | Release payout from ON_HOLD |
| POST | `/api/admin/payouts/[payoutId]/hold` | ADMIN | Place payout ON_HOLD |
| POST | `/api/admin/payouts/resolve` | ADMIN | Resolve payout dispute |
| POST | `/api/admin/payouts/resolve-split` | ADMIN | Resolve split dispute (atomic refund + approve) |
| GET/POST | `/api/admin/pricing` | ADMIN | Platform pricing settings |
| DELETE | `/api/admin/rate-changes/[id]` | ADMIN | Cancel a pending rate change |
| GET | `/api/admin/rate-changes` | ADMIN | List scheduled commission rate changes |
| POST | `/api/admin/rate-changes` | ADMIN | Schedule a commission rate change |
| POST | `/api/admin/register` | ADMIN | Register admin user |
| GET | `/api/admin/revenue` | ADMIN | Revenue report and ledger summary |
| GET/POST | `/api/admin/settings` | ADMIN | Platform settings |
| GET/POST | `/api/admin/staff` | ADMIN | Staff management (SUPER_ADMIN only) |
| GET | `/api/admin/staff-governance/stats` | ADMIN | Staff governance statistics |
| GET | `/api/admin/subscriptions` | ADMIN | All instructor subscriptions |
| GET/POST | `/api/admin/test-centres` | ADMIN | Test centre management |
| GET | `/api/admin/test-vercel-api` | ADMIN | Test Vercel API connectivity |
| GET | `/api/admin/transactions/[id]/invoice` | ADMIN | Transaction invoice |
| POST | `/api/admin/transactions/[id]/refund` | ADMIN | Manual refund transaction |
| GET | `/api/admin/users/[userId]` | ADMIN | Get user detail (support centre) |
| PATCH | `/api/admin/users/[userId]` | ADMIN | Edit user profile (name, phone, email) |
| POST | `/api/admin/users/[userId]/reset-password` | ADMIN | Reset user password |
| GET/POST | `/api/admin/voice-lines` | ADMIN | Voice line management |
| GET/POST | `/api/admin/weekly-report` | ADMIN | Weekly platform report |

### Payout Resolve — Request Body

`POST /api/admin/payouts/resolve`

```json
{
  "transactionId": "string",
  "action": "refund_client | pay_instructor | charge_instructor | void",
  "reason": "string (optional)"
}
```

| Action | Effect |
|---|---|
| `refund_client` | Credits client wallet, marks transaction `REFUNDED` |
| `pay_instructor` | Releases payout to instructor despite dispute |
| `charge_instructor` | Creates negative adjustment — deducted from next payout |
| `void` | Cancels both sides, no money moves, marks transaction `CANCELLED` |

### Admin Verify ABN — Request Body

`POST /api/admin/instructors/[id]/verify-abn`

```json
{
  "verified": true,
  "entityName": "Jane Smith",
  "note": "Confirmed via ABR website"
}
```

Sets `abnVerified`, `abnStatus`, `withholdingTaxRate` (0 if verified, 47 if revoked). Creates `AuditLog` entry.

### Ledger — Response

`GET /api/admin/ledger`

```json
{
  "ledger": {
    "totalCollected": 45000.00,
    "totalReserved": 8500.00,
    "totalPaidOut": 32000.00,
    "totalRefunded": 1200.00,
    "totalTaxWithheld": 620.00,
    "availableBalance": 11800.00
  },
  "recentEntries": [
    {
      "type": "PAYOUT_PAID",
      "amount": -850.00,
      "referenceId": "payout_id",
      "referenceType": "PAYOUT",
      "description": "PAYOUT-ABC123-1234567890 — net payout to instructor",
      "createdAt": "2026-03-23T10:00:00.000Z"
    }
  ]
}
```

### Payout Hold — Request Body

`POST /api/admin/payouts/[payoutId]/hold`

```json
{ "reason": "Dispute raised by client" }
```

---

## Analytics

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/analytics` | INSTRUCTOR | Instructor analytics |
| GET | `/api/analytics/mobile` | JWT | Analytics (mobile) |

---

## Notifications

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/notifications` | Session | List notifications |
| POST | `/api/notifications/mark-read` | Session | Mark notifications as read |

---

## Payments

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/create-payment-intent` | Session | Create Stripe PaymentIntent (legacy) |
| POST | `/api/payments/create-intent` | CLIENT/INSTRUCTOR | Create Stripe PaymentIntent (ownership verified) |
| POST | `/api/payments/verify` | CLIENT/INSTRUCTOR | Verify payment intent or transaction status |
| POST | `/api/stripe/webhook` | Stripe sig | Handle Stripe payment events |
| POST | `/api/subscriptions/checkout` | INSTRUCTOR | Create Stripe Checkout session for subscription |
| POST | `/api/subscriptions/webhook` | Stripe sig | Handle Stripe subscription events |
| POST | `/api/webhooks/stripe` | Stripe sig | Stripe webhook proxy (forwards to canonical handler) |

---

## PDA Tests

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET/POST | `/api/pda-bookings` | Session | PDA test booking management |
| GET/POST | `/api/pda-tests` | Session | PDA test management |
| GET | `/api/pda-tests/mobile` | JWT | PDA tests (mobile) |

---

## Locations & Services

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/locations/validate` | Session | Validate and geocode an address |
| GET | `/api/packages` | Session | Available lesson packages for booking flow |
| GET | `/api/test-centres` | Session | List all active test centres |
| GET/POST | `/api/reviews` | Session | Instructor reviews (rate limited per user/IP) |
| GET/POST | `/api/waiting-list` | Session | Waiting list management |

---

## Mobile Push

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST/DELETE | `/api/mobile/push/register-device` | JWT | Register or unregister push notification device token |

---

## Staff

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/staff/members` | Session | List all staff members |
| GET/POST | `/api/staff/tasks` | Session | Staff task management |

---

## Verifications

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/verifications/otp` | Session | Send OTP verification code (rate limited via Upstash Redis) |
| POST | `/api/verifications/otp/confirm` | Session | Confirm OTP code |

---

## Voice

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET/POST | `/api/voice/availability` | Session | Voice assistant availability queries |
| GET/POST | `/api/voice/bookings` | Session | Voice assistant booking actions |
| GET | `/api/voice/instructors/lookup` | Session | Voice assistant instructor lookup |

---

## Upload

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/upload` | Session | Upload file to Cloudinary (routes to correct subfolder by `type` param) |

---

## Debug / Dev Only

> ⚠️ Not for production use.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/debug/session` | Session | Inspect current session data |
| GET | `/api/feedback/categories` | Session | Feedback category list |
| GET | `/api/seed/instructor-services` | Session | Seed instructor services data |
| GET/POST | `/api/seed/test-centres` | Session | Seed test centre data |
| GET | `/api/seed/test-feedback` | Session | Seed feedback data (development only) |
| POST | `/api/test-email` | Session | Test email sending |

---

## Error Responses

Standard format across all APIs:
```json
{ "error": "Error message", "code": "ERROR_CODE", "details": {} }
```

## Rate Limits

| Endpoint category | Limit |
|-------------------|-------|
| Financial operations | 10 req/min |
| Booking actions | 20 req/min |
| Public APIs | 30 req/min |

Uses Upstash Redis in production (`UPSTASH_REDIS_REST_URL`). Falls back to in-memory in dev.

## Validation

All inputs validated with Zod schemas. Example:
```typescript
const bookingSchema = z.object({
  startTime: z.string(),
  duration: z.number().min(30),
  price: z.number().min(0)
});
```

All dynamic routes export `export const dynamic = 'force-dynamic'` to prevent Next.js static pre-rendering at build time.

---

## Related

- `docs/BOOKING_SYSTEM.md` — Booking API details
- `docs/SUBSCRIPTION_SYSTEM.md` — Subscription API details
- `docs/01-architecture/API_STRUCTURE.md` — API architecture overview