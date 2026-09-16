# SUB-22 Test Modification Plan

**Purpose:** Convert `sub-22-concurrent.test.ts` from `simulateWebhookTransaction()` to real **POST /api/stripe/webhook**

**Status:** 🔴 **BLOCKED** - Requires staging database

---

## Current Test Structure (INADEQUATE)

```typescript
// ❌ CURRENT: Simulates internal transaction logic
async function simulateWebhookTransaction(event: Stripe.Event, label: string) {
  return await prisma.$transaction(async (tx) => {
    // Mimics handleSubscriptionUpdate behavior
    // Does NOT exercise:
    // - Stripe signature verification
    // - POST /api/stripe/webhook route
    // - Full production error handling
    // - HTTP response codes
  });
}
```

---

## Required Test Structure

```typescript
// ✅ REQUIRED: POST to actual webhook endpoint
async function postWebhook(event: Stripe.Event): Promise<Response> {
  const payload = JSON.stringify(event);
  
  // Generate valid Stripe signature
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });
  
  // POST to actual route
  return await fetch('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body: payload,
  });
}
```

---

## Production Sequence Exercised

With real POST approach, tests will exercise:

```
1. POST /api/stripe/webhook
2. ↓ Stripe signature verification (verifyStripeWebhook)
3. ↓ Rate limiting check (webhookRateLimit)
4. ↓ Idempotency key generation
5. ↓ handleStripeEvent dispatch
6. ↓ handleSubscriptionUpdate
7. ↓ SERIALIZABLE transaction
8. ↓ recordWebhookEvent (atomic idempotency)
9. ↓ updateMany() / create()
10. ↓ PostgreSQL unique constraints
11. ↓ P2002 / P2034 handling
12. ↓ HTTP response (200/409/500)
```

**This is what proves the fix works in production.**

---

## Test Modifications Required

### 1. Add Stripe Signature Generation

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

function generateWebhookSignature(payload: string): string {
  return stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });
}
```

### 2. Replace simulateWebhookTransaction with postWebhook

```typescript
async function postWebhook(event: Stripe.Event) {
  const payload = JSON.stringify(event);
  const signature = generateWebhookSignature(payload);
  
  const response = await fetch('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body: payload,
  });
  
  return {
    status: response.status,
    body: await response.json(),
  };
}
```

### 3. Update Test Scenarios

**Before:**
```typescript
const results = await Promise.allSettled([
  simulateWebhookTransaction(event1, 'label1'),
  simulateWebhookTransaction(event2, 'label2'),
]);
```

**After:**
```typescript
const results = await Promise.allSettled([
  postWebhook(event1),
  postWebhook(event2),
]);

// Verify HTTP responses
expect(results[0].status).toBe(200); // Winner
expect(results[1].status).toBe(409 or 500); // Loser (if different Stripe IDs)
```

### 4. Add HTTP Response Verification

```typescript
// Check status codes
const winnerResponse = results.find(r => r.status === 'fulfilled' && r.value.status === 200);
const loserResponse = results.find(r => r.status === 'fulfilled' && r.value.status !== 200);

expect(winnerResponse).toBeDefined();
expect(loserResponse?.value.status).toBeOneOf([409, 500]); // Controlled error
expect(loserResponse?.value.body).toHaveProperty('error'); // Error message present
```

### 5. Verify Webhook Event Recording

```typescript
// Check that losing request recorded webhook event appropriately
const webhookEvents = await prisma.webhookEvent.findMany({
  where: {
    OR: [
      { idempotencyKey: `customer.subscription.created_${event1.id}` },
      { idempotencyKey: `customer.subscription.created_${event2.id}` },
    ]
  }
});

// Both events should be recorded (even loser)
expect(webhookEvents.length).toBe(2);
```

---

## Environment Setup Required

### 1. Test Server Running

```bash
# Terminal 1: Start Next.js dev server
npm run dev
```

### 2. Staging Database

```bash
# Set in .env.test or similar
DATABASE_URL="postgresql://staging_user:staging_pass@staging_host:5432/staging_db"
STRIPE_WEBHOOK_SECRET="whsec_test_..."
```

### 3. Migration Applied

```bash
# Against staging database
npx prisma migrate deploy
```

---

## Critical Tests to Add

### Test: P2002 Inside Transaction Verification

```typescript
it('verifies P2002 recovery works inside aborted transaction', async () => {
  const { provider } = await createTestProvider(99);
  await createTrialSubscription(provider.id, provider.stripeCustomerId!);
  
  const event1 = createMockSubscriptionEvent(
    'customer.subscription.created',
    'sub_p2002_test_A',
    provider.id,
    provider.stripeCustomerId!,
    `evt_p2002_A_${Date.now()}`
  );
  
  const event2 = createMockSubscriptionEvent(
    'customer.subscription.created',
    'sub_p2002_test_B',
    provider.id,
    provider.stripeCustomerId!,
    `evt_p2002_B_${Date.now()}`
  );
  
  // Fire concurrently
  const [result1, result2] = await Promise.allSettled([
    postWebhook(event1),
    postWebhook(event2),
  ]);
  
  // One succeeds, one hits P2002
  const responses = [result1, result2]
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
  
  const winner = responses.find(r => r.status === 200);
  const loser = responses.find(r => r.status !== 200);
  
  expect(winner).toBeDefined();
  expect(loser).toBeDefined();
  expect(loser.status).toBeOneOf([409, 500]);
  
  // Verify database state
  const finalSub = await prisma.subscription.findFirst({
    where: { providerId: provider.id, status: { in: ['TRIAL', 'ACTIVE'] }}
  });
  
  expect(finalSub).toBeDefined();
  expect(finalSub!.stripeSubscriptionId).toBeOneOf(['sub_p2002_test_A', 'sub_p2002_test_B']);
  expect(finalSub!.stripeSubscriptionId).not.toBeNull();
  
  // Verify loser's error mentions conflict
  expect(loser.body).toHaveProperty('error');
  expect(loser.body.error).toContain('conflict' or 'duplicate');
});
```

### Test: Replay After Conflict

```typescript
it('verifies losing ID cannot overwrite winner during replay', async () => {
  // ... setup and initial race ...
  
  const winnerStripeId = finalSub.stripeSubscriptionId;
  const loserStripeId = winnerStripeId === 'sub_A' ? 'sub_B' : 'sub_A';
  
  // Replay both events
  const replayWinner = await postWebhook(createEventWith(winnerStripeId));
  const replayLoser = await postWebhook(createEventWith(loserStripeId));
  
  expect(replayWinner.status).toBe(200); // Idempotent success
  expect(replayLoser.status).toBeOneOf([409, 500]); // Still fails
  
  const finalCheck = await prisma.subscription.findFirst({...});
  expect(finalCheck!.stripeSubscriptionId).toBe(winnerStripeId); // Unchanged!
});
```

---

## Blockers

1. 🔴 **No staging database** - Cannot run tests against production
2. 🔴 **Dev server not running** - Need `npm run dev` for POST tests
3. 🟡 **STRIPE_WEBHOOK_SECRET** - Need test webhook secret in env

---

## Next Steps (In Order)

1. ✅ Obtain staging Supabase database
2. ✅ Run migration against staging
3. ✅ Set `DATABASE_URL` to point to staging
4. ✅ Start `npm run dev`
5. ✅ Modify test file with above changes
6. ✅ Run tests: `npm test -- app/api/stripe/webhook/__tests__/sub-22-concurrent.test.ts`
7. ✅ Record actual HTTP responses, P2002 behavior, database state
8. ✅ Update verification checklist with evidence

**DO NOT modify tests until staging database is available.**

---

**Status:** Plan complete, awaiting staging database to proceed with code changes.
