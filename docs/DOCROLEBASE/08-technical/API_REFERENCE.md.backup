# API Reference

Public and authenticated API endpoints in DriveBook. Base URL: `https://drivebook.com.au/api`

---

## Auth

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET/POST | `/api/auth/[...nextauth]` | — | NextAuth handlers |
| POST | `/api/auth/forgot-password` | — | Send reset email |
| POST | `/api/auth/reset-password` | — | Reset with token |
| POST | `/api/auth/verify-email` | — | Verify email token |
| POST | `/api/auth/resend-verification` | — | Resend instructor verification email |
| GET | `/api/auth/check-email` | — | Check if email exists |
| POST | `/api/auth/mobile-login` | — | JWT login for mobile |
| GET | `/api/calendar/callback` | Session | Google Calendar OAuth callback (signed state) |
| POST | `/api/register` | — | Register new user |

---

## Public (no auth)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/public/bookings/bulk` | — | Create booking (subdomain flow) |
| POST | `/api/public/bookings` | — | Create public booking |
| GET | `/api/public/bookings/[id]` | — | Get booking for payment page |
| GET | `/api/public/bookings/[id]/payment-summary` | — | Payment summary for public booking |
| GET | `/api/public/bookings/[id]/payment-status` | — | Booking payment status |
| GET | `/api/public/bookings/[id]/timeline` | — | Booking timeline and notes |
| POST | `/api/public/bookings/[id]/cancel` | — | Public cancel booking |
| POST | `/api/public/bookings/[id]/reschedule` | — | Public reschedule booking |
| GET | `/api/public/bookings/[id]/cancellation-policy` | — | Get cancellation policy |
| GET | `/api/public/pricing` | — | Public pricing settings |
| GET | `/api/public/check-service-area` | — | Check if address is within service area |
| GET | `/api/branding/[slug]` | — | Get instructor branding by slug |
| GET | `/api/instructors/search` | — | Search instructors by location |
| GET | `/api/instructors/[id]/availability` | — | Get available slots for a specific instructor |
| GET | `/api/instructors/search` | — | Public instructor directory/search |
| GET | `/api/availability/slots` | — | Get available slots |
| GET | `/api/health` | — | Health check |

---

## Payments

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/payments/create-intent` | CLIENT/INSTRUCTOR | Create Stripe PaymentIntent (auth required, ownership verified) |
| POST | `/api/payments/verify` | CLIENT/INSTRUCTOR | Verify payment intent or transaction status |
| POST | `/api/stripe/webhook` | Stripe sig | Handle Stripe events |
| POST | `/api/subscriptions/checkout` | INSTRUCTOR | Create Stripe Checkout session |

---

## Client

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/client/bookings/[id]` | CLIENT | Get client booking by ID |
| POST | `/api/client/bookings/create-bulk` | CLIENT | Book lessons from wallet |
| PUT | `/api/client/bookings/[id]/reschedule` | CLIENT | Reschedule booking |
| GET | `/api/client/wallet/summary` | CLIENT | Wallet balance + history |
| POST | `/api/client/wallet-topup-intent` | CLIENT | Create wallet top-up intent |
| POST | `/api/client/wallet-add` | CLIENT | Add wallet credit (webhook) |
| GET | `/api/client/my-performance` | CLIENT | Lesson performance data |
| GET | `/api/client/current-instructor` | CLIENT | Get current instructor |

---

## Bookings (Instructor)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/bookings` | INSTRUCTOR | List instructor bookings |
| POST | `/api/bookings` | INSTRUCTOR | Create booking for client |
| GET | `/api/bookings/[id]` | INSTRUCTOR | Get booking detail |
| PATCH | `/api/bookings/[id]` | INSTRUCTOR | Update booking |
| POST | `/api/bookings/[id]/confirm` | INSTRUCTOR | Manual confirm |
| POST | `/api/bookings/[id]/cancel` | INSTRUCTOR/CLIENT/ADMIN | Cancel with refund |
| PATCH | `/api/bookings/[id]/reschedule` | INSTRUCTOR | Reschedule |
| POST | `/api/bookings/[id]/check-in` | INSTRUCTOR/mobile JWT | Check in |
| POST | `/api/bookings/[id]/check-out` | INSTRUCTOR | Check out completed lesson |
| POST | `/api/bookings/send-payment-link` | INSTRUCTOR | Email wallet top-up link |

---

## Instructor

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/instructor/profile` | INSTRUCTOR | Get profile |
| PATCH | `/api/instructor/profile` | INSTRUCTOR | Update profile |
| GET | `/api/instructor/branding` | INSTRUCTOR | Get branding settings |
| POST | `/api/instructor/branding` | INSTRUCTOR | Update branding |
| GET | `/api/instructor/settings` | INSTRUCTOR | Get instructor settings |
| PUT | `/api/instructor/settings` | INSTRUCTOR | Update settings, including working hours |
| GET | `/api/instructor/availability/exceptions` | INSTRUCTOR | List availability exceptions |
| POST | `/api/instructor/availability/exceptions` | INSTRUCTOR | Create availability exception |
| DELETE | `/api/instructor/availability/exceptions` | INSTRUCTOR | Delete availability exception |
| GET | `/api/instructor/clients/[id]` | INSTRUCTOR | Get instructor client detail |
| GET | `/api/instructor/subscription` | INSTRUCTOR | Get subscription |
| POST | `/api/instructor/subscription` | INSTRUCTOR | Create/update subscription |
| DELETE | `/api/instructor/subscription` | INSTRUCTOR | Cancel subscription |
| POST | `/api/instructor/subscription/billing-portal` | INSTRUCTOR | Stripe billing portal |
| POST | `/api/instructor/subscription/sync` | INSTRUCTOR | Sync subscription from Stripe after portal return |
| GET/POST/DELETE | `/api/instructor/subscription/mobile` | JWT | Mobile subscription |
| GET | `/api/instructor/earnings` | INSTRUCTOR | Earnings breakdown |
| GET | `/api/instructor/payout-settings` | INSTRUCTOR | Get payout method + tax details |
| POST | `/api/instructor/payout-settings` | INSTRUCTOR | Update payout method + tax details |
| GET | `/api/instructor/expenses` | INSTRUCTOR | List business expenses |
| POST | `/api/instructor/expenses` | INSTRUCTOR | Add expense |
| DELETE | `/api/instructor/expenses/[id]` | INSTRUCTOR | Delete expense |

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

## ABN

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/abn/verify` | — | Validate ABN checksum + ABR lookup |

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

## Admin

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/admin/fortress-dashboard` | ADMIN | Platform stats |
| GET | `/api/admin/bookings` | ADMIN | List all bookings |
| PATCH | `/api/admin/bookings` | ADMIN | Force status change |
| POST | `/api/admin/bookings` | ADMIN | Create booking for client |
| GET | `/api/admin/instructors` | ADMIN | List instructors |
| GET | `/api/admin/instructors/[id]` | ADMIN | Instructor detail |
| POST | `/api/admin/instructors/[id]/approve` | ADMIN | Approve instructor |
| POST | `/api/admin/instructors/[id]/reject` | ADMIN | Reject instructor |
| POST | `/api/admin/instructors/[id]/suspend` | ADMIN | Suspend instructor |
| POST | `/api/admin/instructors/[id]/verify-abn` | ADMIN | Manually verify instructor ABN |
| GET | `/api/admin/clients` | ADMIN | List all clients |
| GET | `/api/admin/clients/[id]` | ADMIN | Client detail |
| GET | `/api/admin/clients/[id]/wallet` | ADMIN | Client wallet |
| POST | `/api/admin/clients/[id]/wallet/add-credit` | ADMIN | Add wallet credit |
| POST | `/api/admin/clients/[id]/wallet/deduct-credit` | ADMIN | Deduct wallet credit |
| GET | `/api/admin/revenue` | ADMIN | Revenue report + ledger summary |
| GET | `/api/admin/ledger` | ADMIN | Platform ledger balance + recent entries |
| GET | `/api/admin/payouts` | ADMIN | Payout list |
| POST | `/api/admin/payouts/process` | ADMIN | Process single payout (two-phase) |
| POST | `/api/admin/payouts/process-all` | ADMIN | Process all eligible payouts |
| POST | `/api/admin/payouts/resolve` | ADMIN | Resolve dispute |
| POST | `/api/admin/payouts/[payoutId]/hold` | ADMIN | Place payout ON_HOLD |
| DELETE | `/api/admin/payouts/[payoutId]/hold` | ADMIN | Release payout from ON_HOLD |

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
| `charge_instructor` | Creates negative adjustment transaction — deducted from next payout |
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
| GET/POST | `/api/admin/pricing` | ADMIN | Platform pricing settings |
| GET/POST | `/api/admin/settings` | ADMIN | Platform settings |
| GET | `/api/admin/documents/compliance` | ADMIN | Document compliance list |
| GET | `/api/admin/documents/instructor/[id]` | ADMIN | Instructor documents |
| GET | `/api/admin/transactions/[id]/invoice` | ADMIN | Transaction invoice |
| POST | `/api/admin/transactions/[id]/refund` | ADMIN | Manual refund |
| POST | `/api/admin/register` | ADMIN | Register admin user |
| GET | `/api/admin/users/[userId]` | ADMIN | Get user detail (support centre) |
| PATCH | `/api/admin/users/[userId]` | ADMIN | Edit user profile (name, phone, email) |
| POST | `/api/admin/users/[userId]/reset-password` | ADMIN | Reset user password |
| POST | `/api/admin/contact` | ADMIN | Send email/SMS to user |
| GET | `/api/admin/rate-changes` | ADMIN | List scheduled rate changes |
| POST | `/api/admin/rate-changes` | ADMIN | Schedule a rate change |
| DELETE | `/api/admin/rate-changes/[id]` | ADMIN | Cancel a pending rate change |
| GET | `/api/admin/audit-log` | ADMIN | Audit log with filters |

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
| GET | `/api/analytics/mobile` | JWT | Mobile analytics |

---

## Notifications

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/notifications` | Any | List notifications |
| POST | `/api/notifications/mark-read` | Any | Mark as read |

---

## Cron

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/cron/cleanup-expired-bookings` | CRON_SECRET | Expire stale `PENDING_PAYMENT` bookings (every 5 min) |
| GET | `/api/cron/apply-rate-changes` | CRON_SECRET | Apply scheduled commission rate changes (daily 00:05 UTC) |
| GET | `/api/cron/lesson-reminders` | CRON_SECRET | Send 24hr lesson reminders to instructors + students (daily 22:00 UTC) |
| GET | `/api/cron/document-expiry-check` | CRON_SECRET | Notify instructors with expiring documents (weekly, Mondays 02:00 UTC) |
| GET | `/api/cron/recheck-abn` | CRON_SECRET | Recheck all verified ABNs against ABR (weekly, Mondays 02:00 UTC) |
| GET | `/api/cron/reconcile-stripe` | CRON_SECRET | Daily Stripe vs DB reconciliation (daily 19:00 UTC) |

All cron endpoints require `Authorization: Bearer <CRON_SECRET>`. Configured in `vercel.json`.

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
