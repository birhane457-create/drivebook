# API Reference

All API routes in DriveBook. Base URL: `https://drivebook.com.au/api`

---

## Auth

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/[...nextauth]` | — | NextAuth handlers |
| POST | `/api/auth/forgot-password` | — | Send reset email |
| POST | `/api/auth/reset-password` | — | Reset with token |
| POST | `/api/auth/verify-email` | — | Verify email token |
| GET | `/api/auth/check-email` | — | Check if email exists |
| POST | `/api/auth/mobile-login` | — | JWT login for mobile |
| GET | `/api/auth/google/callback` | — | Google OAuth callback |
| POST | `/api/register` | — | Register new user |

---

## Public (no auth)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/public/bookings/bulk` | — | Create booking (subdomain flow) |
| GET | `/api/public/bookings/[id]` | — | Get booking for payment page |
| GET | `/api/branding/[slug]` | — | Get instructor branding by slug |
| GET | `/api/instructors/search` | — | Search instructors by location |
| GET | `/api/availability/slots` | — | Get available slots |
| GET | `/api/health` | — | Health check |

---

## Payments

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/payments/create-intent` | — | Create Stripe PaymentIntent |
| POST | `/api/stripe/webhook` | Stripe sig | Handle Stripe events |
| POST | `/api/subscriptions/checkout` | INSTRUCTOR | Create Stripe Checkout session |

---

## Client

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/client/bookings` | CLIENT | List client bookings |
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
| POST | `/api/bookings/send-payment-link` | INSTRUCTOR | Email wallet top-up link |

---

## Instructor

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/instructor/profile` | INSTRUCTOR | Get profile |
| PATCH | `/api/instructor/profile` | INSTRUCTOR | Update profile |
| GET | `/api/instructor/branding` | INSTRUCTOR | Get branding settings |
| POST | `/api/instructor/branding` | INSTRUCTOR | Update branding |
| GET | `/api/instructor/availability` | INSTRUCTOR | Get working hours |
| POST | `/api/instructor/availability` | INSTRUCTOR | Update working hours |
| GET | `/api/instructor/clients` | INSTRUCTOR | List clients |
| POST | `/api/instructor/clients` | INSTRUCTOR | Add client |
| GET | `/api/instructor/subscription` | INSTRUCTOR | Get subscription |
| POST | `/api/instructor/subscription` | INSTRUCTOR | Create/update subscription |
| DELETE | `/api/instructor/subscription` | INSTRUCTOR | Cancel subscription |
| POST | `/api/instructor/subscription/change-plan` | INSTRUCTOR | Change tier |
| POST | `/api/instructor/subscription/billing-portal` | INSTRUCTOR | Stripe billing portal |
| GET/POST/DELETE | `/api/instructor/subscription/mobile` | JWT | Mobile subscription |
| GET | `/api/instructor/earnings` | INSTRUCTOR | Earnings breakdown |
| GET | `/api/instructor/payout-settings` | INSTRUCTOR | Get payout method + tax details |
| POST | `/api/instructor/payout-settings` | INSTRUCTOR | Update payout method + tax details |

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
| GET | `/api/cron/cleanup-expired-bookings` | CRON_SECRET | Expire stale `PENDING_PAYMENT` bookings (runs daily) |
| GET | `/api/cron/recheck-abn` | CRON_SECRET | Recheck all verified ABNs against ABR (runs weekly, Mondays 2am AWST) |

Both endpoints require `Authorization: Bearer <CRON_SECRET>`. Triggered automatically by Vercel Cron (configured in `vercel.json`). The ABN recheck clears `abnVerified`, sets `abnStatus = CANCELLED`, and reverts `withholdingTaxRate` to 47% for any instructor whose ABN is no longer active. Creates an `ABN_VERIFICATION_REVOKED` audit entry per affected instructor.

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
