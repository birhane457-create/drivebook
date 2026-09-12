# Stripe Webhooks

**Endpoint:** `POST /api/stripe/webhook`  
**File:** `app/api/stripe/webhook/route.ts`

**The canonical Stripe webhook path is `/api/stripe/webhook`.** Configure this URL in the Stripe Dashboard → Developers → Webhooks → Add endpoint. The legacy path `/webhooks/stripe` is a backward-compat alias only — do not configure new integrations from it.

---

## Setup

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://drivebook.com.au/api/stripe/webhook`
3. Select events to listen for (see table below)
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` in `.env` and Vercel dashboard

**Current status:** `STRIPE_WEBHOOK_SECRET` is still a placeholder (`whsec_your_webhook_secret_here`). Must be replaced with the real value from Stripe Dashboard before webhooks will work in production.

---

## Events Handled

| Event | Handler |
|-------|---------|
| `checkout.session.completed` | Book Later wallet credit — `metadata.type === 'wallet_credit'` credits client wallet; `metadata.type === 'saas_booking'` handles SAAS direct payments |
| `payment_intent.succeeded` | Confirms booking, credits wallet, notifies instructor |
| `payment_intent.payment_failed` | Marks booking payment as failed |
| `customer.subscription.created` | Creates/updates `Subscription` record, sets `subscriptionTier` and `subscriptionStatus` |
| `customer.subscription.updated` | Syncs `subscriptionTier` (derived from price ID), `subscriptionStatus`, billing period |
| `customer.subscription.deleted` | Sets `subscriptionStatus: CANCELLED` |
| `customer.subscription.trial_will_end` | Sends 3-day trial expiry warning email to instructor |
| `invoice.payment_succeeded` | Sets `subscriptionStatus: ACTIVE`, clears `trialEndsAt` |
| `invoice.payment_failed` | Sets `subscriptionStatus: PAST_DUE` |
| `account.updated` | Stripe Connect — updates `stripeConnectStatus` for payout setup |
| `charge.dispute.created` | Creates `StripeDispute` record, flags payout ON_HOLD |
| `charge.dispute.updated` | Updates dispute status |
| `charge.dispute.closed` | Resolves dispute, releases hold if won |
| `charge.refunded` | Records refund, updates ledger |
| `transfer.failed` | Marks payout FAILED, creates admin alert |

---

## payment_intent.succeeded Flow

1. Verify webhook signature with `STRIPE_WEBHOOK_SECRET`
2. Idempotency check via `WebhookEvent` table (key = `${event.type}_${event.id}_${event.created}`)
3. Find booking by `paymentIntentId`
4. **EXPIRED booking handling:** if cron expired the slot before the webhook arrived, the booking is **NOT** revived. An automatic full refund is issued via `stripe.refunds.create()`, the booking is marked `CANCELLED`, and an admin alert is sent. Stripe already charged the client — the refund reverses it.
5. Validate `amount_received` matches `packageTotalPaid || booking.price` (in cents)
6. Update booking: `status → CONFIRMED`, `isPaid = true`, `paymentCaptured = true`
7. **Wallet operations (package flow):**
   - CREDIT wallet = `packageTotalPaid`
   - DEBIT wallet = `booking.price` (first lesson)
8. Send in-app notification to instructor

## checkout.session.completed Flow (Book Later / Wallet Top-Up)

1. Verify webhook signature
2. Check `session.metadata.type`:
   - `wallet_credit` — credits the client's wallet by `session.amount_total / 100`
   - `saas_booking` — handles SAAS direct payment flow (phase 2)
3. For `wallet_credit`:
   - Create `WalletTransaction` of type `CREDIT` with `metadata.hours` and `metadata.userId`
   - Link to `BookingIdempotencyKey` if present
   - Send wallet top-up receipt email
4. **No Booking row is created here** — the client books lessons from the dashboard after wallet is credited

---

## Idempotency

```typescript
const idempotencyKey = `${event.type}_${event.id}_${event.created}`;
const existing = await prisma.webhookEvent.findUnique({ where: { idempotencyKey } });
if (existing) return { received: true, duplicate: true };
await prisma.webhookEvent.create({ data: { idempotencyKey, ... } });
```

Webhook events are retained indefinitely in PostgreSQL. Add a cleanup cron or Supabase scheduled function if storage becomes a concern.

---

## Signature Verification

```typescript
const sig = req.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
```

If `STRIPE_WEBHOOK_SECRET` is wrong or missing, all webhooks return 400 and are not processed.

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from Stripe Dashboard |
| `STRIPE_SECRET_KEY` | Stripe server-side API key |
| `STRIPE_BASIC_MONTHLY_PRICE_ID` | Stripe price ID for BASIC monthly |
| `STRIPE_BASIC_ANNUAL_PRICE_ID` | Stripe price ID for BASIC annual |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Stripe price ID for PRO monthly |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | Stripe price ID for PRO annual |
| `STRIPE_STUDIO_MONTHLY_PRICE_ID` | Stripe price ID for STUDIO monthly |
| `STRIPE_STUDIO_ANNUAL_PRICE_ID` | Stripe price ID for STUDIO annual |
| `STRIPE_PREMIUM_MONTHLY_PRICE_ID` | Stripe price ID for PREMIUM monthly |
| `STRIPE_PREMIUM_ANNUAL_PRICE_ID` | Stripe price ID for PREMIUM annual |

**Note:** All test-mode price IDs are in `.env`. Create separate live-mode price IDs before go-live and set them in Vercel env vars.

**Error handling:** Handler-level errors (transient DB issues, unexpected state) return `500` so Stripe retries automatically with exponential backoff. The idempotency guard returns `200` for already-processed events (correct — Stripe should not retry those).

Use the Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI provides a temporary webhook secret for local testing.

---

## Testing Webhooks Locally

- `docs/06-payments/STRIPE.md` — Stripe configuration
- `docs/BOOKING_SYSTEM.md` — Webhook handling in booking flow
