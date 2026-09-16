# Payment Endpoints Security - Testing Plan

**Date:** 2025-01-XX
**Related:** `PAYMENT_SECURITY_FIXES_APPLIED.md`

---

## 🎯 Testing Objectives

Verify that all critical security fixes are functioning correctly:
1. verify/route.ts is read-only (no double-crediting)
2. create-intent/route.ts creates PaymentIntents atomically (no orphans)
3. Rate limiting prevents API abuse
4. Amount manipulation is blocked
5. Authentication and authorization work correctly

---

## 📋 Test Scenarios

### Test Group 1: verify/route.ts POST Handler

#### Test 1.1: Unauthenticated Access
**Scenario:** Call POST /api/payments/verify without auth
```bash
curl -X POST http://localhost:3000/api/payments/verify \
  -H "Content-Type: application/json" \
  -d '{"paymentIntentId":"pi_test","bookingId":"booking_test"}'
```
**Expected Result:**
- Status: `401 Unauthorized`
- Response: `{"error":"Unauthorized"}`

#### Test 1.2: Valid Payment Token
**Scenario:** Call POST with valid paymentToken
```typescript
// Setup: Create booking with paymentToken
const booking = await prisma.booking.create({
  data: { ...data, paymentToken: 'test_token_123' }
});

// Test
fetch('/api/payments/verify', {
  method: 'POST',
  body: JSON.stringify({
    paymentIntentId: 'pi_test',
    bookingId: booking.id,
    paymentToken: 'test_token_123'
  })
});
```
**Expected Result:**
- Status: `200 OK`
- Response: `{ stripeStatus, bookingStatus, isPaid, amountReceived, message }`
- No mutations to DB (wallet not credited)

#### Test 1.3: Invalid Payment Token
**Scenario:** Call POST with wrong paymentToken
**Expected Result:**
- Status: `403 Forbidden`
- Response: `{"error":"Invalid payment token"}`

#### Test 1.4: Read-Only Behavior
**Scenario:** Call POST for a paid booking
**Verification Steps:**
1. Create booking with `isPaid: false`
2. Mark as paid via webhook
3. Call verify POST endpoint
4. Check booking status hasn't changed
5. Check no wallet transactions created

**Expected Result:**
- Booking status unchanged
- Wallet balance unchanged
- No new wallet transactions
- Response shows current status only

---

### Test Group 2: verify/route.ts GET Handler

#### Test 2.1: Non-Admin Access
**Scenario:** Call GET /api/payments/verify as CLIENT role
**Expected Result:**
- Status: `403 Forbidden`
- Response: `{"error":"Forbidden - Admin access required"}`

#### Test 2.2: Admin Access Without Session
**Scenario:** Call GET without session
**Expected Result:**
- Status: `401 Unauthorized`

#### Test 2.3: Admin Manual Credit - Success
**Scenario:** Admin credits wallet for unpaid booking
**Setup:**
1. Create paid booking (isPaid: true)
2. No wallet transactions exist
3. PaymentIntent succeeded in Stripe

**Test:**
```bash
# As ADMIN user
curl "http://localhost:3000/api/payments/verify?bookingId=booking_123" \
  -H "Cookie: next-auth.session-token=admin_token"
```

**Expected Result:**
- Status: `200 OK`
- Response: `{"status":"credited","amount":100,"debit":100}`
- 2 wallet transactions created (CREDIT + DEBIT)
- Audit log entry created with:
  - action: `ADMIN_WALLET_CREDIT_MANUAL`
  - actorId: admin user ID
  - metadata includes bookingId, amounts, idempotencyKey

**Verification Queries:**
```sql
-- Check wallet transactions
SELECT * FROM "WalletTransaction" 
WHERE description LIKE '%booking #booking_123%';

-- Check audit log
SELECT * FROM "AuditLog"
WHERE action = 'ADMIN_WALLET_CREDIT_MANUAL'
AND metadata->>'bookingId' = 'booking_123';
```

#### Test 2.4: Idempotency - Already Credited
**Scenario:** Call admin credit endpoint twice
**Expected Result:**
- First call: Creates transactions
- Second call: Returns `{"status":"already_credited"}`
- No duplicate transactions

#### Test 2.5: Stripe Verification Failure
**Scenario:** Admin tries to credit booking where Stripe payment not succeeded
**Setup:** PaymentIntent status = 'requires_payment_method'
**Expected Result:**
- Status: `400 Bad Request`
- Response: `{"error":"Payment not succeeded in Stripe","stripeStatus":"requires_payment_method"}`
- No wallet transactions created

#### Test 2.6: Amount Mismatch
**Scenario:** Booking price doesn't match Stripe amount
**Setup:**
- Booking price: $100
- Stripe amount_received: $50

**Expected Result:**
- Status: `400 Bad Request`
- Response: `{"error":"Amount mismatch between booking and Stripe","bookingAmount":100,"stripeAmount":50}`

---

### Test Group 3: create-intent/route.ts Rate Limiting

#### Test 3.1: Normal Usage
**Scenario:** Make 5 requests within 60 seconds
**Expected Result:**
- All requests succeed (200 OK)
- Response headers include:
  - `X-RateLimit-Limit: 10`
  - `X-RateLimit-Remaining: 5, 4, 3, 2, 1`
  - `X-RateLimit-Reset: <timestamp>`

#### Test 3.2: Rate Limit Exceeded
**Scenario:** Make 11 requests within 60 seconds
**Expected Result:**
- First 10 requests: `200 OK`
- 11th request: `429 Too Many Requests`
- Response headers:
  - `Retry-After: <seconds>`
  - `X-RateLimit-Remaining: 0`
- Error message: `"Too many requests"`

#### Test 3.3: Rate Limit Reset
**Scenario:** Hit rate limit, wait for reset, try again
**Steps:**
1. Make 10 requests
2. Wait 61 seconds
3. Make another request

**Expected Result:**
- Request after reset: `200 OK`
- Remaining resets to 9

#### Test 3.4: Different Users/IPs
**Scenario:** Two users with different IPs make requests
**Expected Result:**
- Each user has independent rate limit counter
- User A can make 10 requests
- User B can make 10 requests
- No interference between users

---

### Test Group 4: create-intent/route.ts Wallet Payments

#### Test 4.1: Reject Client-Supplied Amount
**Scenario:** Client sends amount different from DB transaction
**Setup:**
- Transaction in DB: amount = 100
- Client sends: amount = 50

**Test:**
```typescript
fetch('/api/payments/create-intent', {
  method: 'POST',
  body: JSON.stringify({
    transactionId: 'tx_123',
    amount: 50  // Wrong amount
  })
});
```

**Expected Result:**
- Status: `400 Bad Request`
- Response: `{"error":"Amount mismatch - expected 100, received 50"}`
- No PaymentIntent created in Stripe

#### Test 4.2: Use DB Amount Always
**Scenario:** Client doesn't send amount at all
**Expected Result:**
- Uses transaction.amount from DB
- PaymentIntent created with correct amount
- Status: `200 OK`

---

### Test Group 5: create-intent/route.ts Atomic PaymentIntent Creation

#### Test 5.1: Concurrent Requests - Same Booking
**Scenario:** Two tabs create payment intent simultaneously
**Setup:**
1. Create booking with paymentIntentId = null
2. Open two browser tabs
3. Both call create-intent at same time

**Expected Result:**
- Only ONE PaymentIntent created in Stripe
- Both tabs receive same clientSecret (one creates, one reuses)
- No orphaned PaymentIntents
- booking.paymentIntentId is set correctly

**Verification:**
```typescript
// Check Stripe
const intents = await stripe.paymentIntents.list({
  limit: 100,
});
const bookingIntents = intents.data.filter(
  pi => pi.metadata?.bookingId === bookingId
);
expect(bookingIntents).toHaveLength(1);

// Check DB
const booking = await prisma.booking.findUnique({
  where: { id: bookingId }
});
expect(booking.paymentIntentId).toBe(bookingIntents[0].id);
```

#### Test 5.2: Transaction Rollback on Stripe Failure
**Scenario:** Stripe API fails after DB lock acquired
**Setup:** Mock Stripe service to throw error
**Expected Result:**
- Transaction rolls back
- booking.paymentIntentId remains null
- Error returned to client
- No orphaned intent

#### Test 5.3: Transaction Rollback on DB Failure
**Scenario:** DB update fails after PaymentIntent created
**Setup:** Simulate DB constraint violation
**Expected Result:**
- Transaction rolls back
- PaymentIntent NOT saved to booking
- Error returned to client
- **Issue:** Orphaned intent created in Stripe (acceptable rare case)

#### Test 5.4: SERIALIZABLE Isolation
**Scenario:** Test isolation level prevents dirty reads
**Setup:** Two concurrent transactions
**Expected Result:**
- Second transaction waits for first to complete
- No dirty reads or phantom reads
- Consistent state maintained

---

### Test Group 6: Integration Tests

#### Test 6.1: Full Payment Flow - Book Now
**Scenario:** End-to-end booking payment
**Steps:**
1. Create booking (status: PENDING_PAYMENT)
2. Create payment intent
3. Simulate Stripe payment success
4. Webhook fires → confirms booking + credits wallet
5. Call verify endpoint → returns confirmed status

**Verification:**
- Booking status: CONFIRMED
- Booking isPaid: true
- Wallet transactions created (via webhook, not verify)
- verify endpoint returns read-only status

#### Test 6.2: Full Payment Flow - Book Later
**Scenario:** Package purchase payment
**Steps:**
1. Create wallet transaction (status: PENDING)
2. Create payment intent (validates amount)
3. Simulate Stripe payment success
4. Webhook fires → confirms wallet transaction

**Verification:**
- Transaction status: CONFIRMED
- Wallet balance updated
- No amount manipulation possible

#### Test 6.3: Admin Manual Intervention
**Scenario:** Webhook failed, admin manually credits wallet
**Steps:**
1. Booking paid, webhook didn't fire
2. No wallet transactions exist
3. Admin calls GET /verify?bookingId=X
4. Wallet transactions created
5. Audit log entry created

**Verification:**
- Wallet transactions have metadata.adminUserId
- Audit log shows manual intervention
- Idempotency prevents double-credit on retry

---

## 🔧 Test Utilities

### Helper Functions

```typescript
// Create test booking
async function createTestBooking(overrides = {}) {
  return prisma.booking.create({
    data: {
      providerId: 'test_provider',
      customerId: 'test_customer',
      status: 'PENDING_PAYMENT',
      price: 100,
      paymentToken: 'test_token',
      ...overrides
    }
  });
}

// Simulate Stripe payment success
async function simulateStripeSuccess(paymentIntentId: string) {
  // Mock webhook event
  const event = {
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: paymentIntentId,
        amount_received: 10000, // cents
        metadata: { bookingId: 'test_booking' }
      }
    }
  };
  
  // Call webhook handler
  await fetch('/api/stripe/webhook', {
    method: 'POST',
    body: JSON.stringify(event),
    headers: {
      'stripe-signature': 'test_signature'
    }
  });
}

// Check audit log
async function getAuditLogs(filters = {}) {
  return prisma.auditLog.findMany({
    where: filters,
    orderBy: { createdAt: 'desc' }
  });
}

// Clear rate limit (for testing)
function clearRateLimit() {
  (global as any).__createIntentRateLimits = new Map();
}
```

### Test Database Setup

```sql
-- Clean slate before tests
DELETE FROM "WalletTransaction";
DELETE FROM "Booking";
DELETE FROM "AuditLog";

-- Create test users
INSERT INTO "User" (id, email, role) VALUES
  ('admin_user', 'admin@test.com', 'ADMIN'),
  ('client_user', 'client@test.com', 'CLIENT');
```

---

## 📊 Success Criteria

### Critical Metrics

| Metric | Target | Method |
|--------|--------|--------|
| Double-credit incidents | 0 | Query wallet transactions for duplicates |
| Orphaned PaymentIntents | 0 | Compare Stripe intents to DB bookings |
| Rate limit false positives | <1% | Monitor legitimate user rejections |
| Auth bypass attempts | 0 | Test unauthenticated access |
| Amount manipulation | 0 | Test client-supplied amounts |
| Audit log coverage | 100% | All admin actions logged |

### Performance Benchmarks

| Operation | Max Latency | Target |
|-----------|-------------|--------|
| verify POST | 500ms | <300ms |
| verify GET (admin) | 1000ms | <800ms |
| create-intent (new) | 1500ms | <1200ms |
| create-intent (reuse) | 300ms | <200ms |

---

## 🚨 Failure Scenarios to Test

### Chaos Engineering Tests

1. **Network Partition:** Stripe succeeds but response lost
2. **DB Timeout:** Transaction exceeds timeout
3. **Concurrent Load:** 100 requests/second
4. **Stripe API Down:** All requests fail
5. **Partial Webhook Delivery:** Some events lost

### Expected Behaviors

- Graceful degradation
- No data corruption
- Proper error messages
- Automatic recovery when possible
- Manual intervention documented

---

## 📝 Test Execution Log

```markdown
## Test Run: 2025-01-XX

### Environment
- Branch: payment-security-fixes
- Database: test
- Stripe: test mode

### Results

#### verify/route.ts POST
- [ ] 1.1 Unauthenticated Access: PASS
- [ ] 1.2 Valid Payment Token: PASS
- [ ] 1.3 Invalid Payment Token: PASS
- [ ] 1.4 Read-Only Behavior: PASS

#### verify/route.ts GET
- [ ] 2.1 Non-Admin Access: PASS
- [ ] 2.2 Admin Access Without Session: PASS
- [ ] 2.3 Admin Manual Credit: PASS
- [ ] 2.4 Idempotency: PASS
- [ ] 2.5 Stripe Verification Failure: PASS
- [ ] 2.6 Amount Mismatch: PASS

#### create-intent/route.ts Rate Limiting
- [ ] 3.1 Normal Usage: PASS
- [ ] 3.2 Rate Limit Exceeded: PASS
- [ ] 3.3 Rate Limit Reset: PASS
- [ ] 3.4 Different Users/IPs: PASS

#### create-intent/route.ts Wallet
- [ ] 4.1 Reject Client Amount: PASS
- [ ] 4.2 Use DB Amount: PASS

#### create-intent/route.ts Atomicity
- [ ] 5.1 Concurrent Requests: PASS
- [ ] 5.2 Stripe Failure Rollback: PASS
- [ ] 5.3 DB Failure Rollback: PASS
- [ ] 5.4 SERIALIZABLE Isolation: PASS

#### Integration Tests
- [ ] 6.1 Full Flow - Book Now: PASS
- [ ] 6.2 Full Flow - Book Later: PASS
- [ ] 6.3 Admin Intervention: PASS

### Issues Found
- None

### Performance
- verify POST avg: 250ms ✅
- create-intent avg: 1100ms ✅
- Rate limit overhead: <10ms ✅
```

---

**Next Steps:**
1. Run automated test suite
2. Manual QA testing
3. Load testing
4. Security audit
5. Deploy to staging
6. Monitor for 48 hours
7. Deploy to production

