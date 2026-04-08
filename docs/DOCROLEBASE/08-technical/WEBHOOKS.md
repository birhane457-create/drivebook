# Stripe Webhooks

**Endpoint:** `POST /api/stripe/webhook`  
**File:** `app/api/stripe/webhook/route.ts`

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
| `payment_intent.succeeded` | Confirms booking, credits wallet, notifies instructor |
| `customer.subscription.updated` | Updates `subscriptionStatus` and `subscriptionTier` on instructor |
| `customer.subscription.deleted` | Sets `subscriptionStatus: CANCELLED` |
| `invoice.payment_failed` | Sets `subscriptionStatus: PAST_DUE` |

---

## payment_intent.succeeded Flow

1. Verify webhook signature with `STRIPE_WEBHOOK_SECRET`
2. Idempotency check via `WebhookEvent` table (key = `${event.type}_${event.id}_${event.created}`)
3. Find booking by `paymentIntentId`
4. **EXPIRED booking recovery:** if cron expired the slot just before webhook arrived, revive to `CONFIRMED` — Stripe already charged the client
5. Validate `amount_received` matches `packageTotalPaid || booking.price` (in cents)
6. Update booking: `status → CONFIRMED`, `isPaid = true`, `paymentCaptured = true`
7. **Wallet operations (package flow):**
   - CREDIT wallet = `packageTotalPaid`
   - DEBIT wallet = `booking.price` (first lesson)
8. Send in-app notification to instructor

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

## Testing Webhooks Locally

Use the Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI provides a temporary webhook secret for local testing.

---

## Related

- `docs/06-payments/STRIPE.md` — Stripe configuration
- `docs/BOOKING_SYSTEM.md` — Webhook handling in booking flow
