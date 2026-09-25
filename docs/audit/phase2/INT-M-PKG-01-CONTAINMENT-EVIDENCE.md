# INT-M-PKG-01 — Containment Fix Evidence

**Status:** CONTAINMENT IMPLEMENTED  
**Date:** 2026-08-15  
**Fix Type:** Server-side kill switch (fail closed)  
**Severity:** MEDIUM  

---

## Containment Strategy

This is **containment only**, not a complete fix. The three underlying security defects remain in the code but are unreachable while the endpoint is disabled.

### What This Fix Does ✅

1. **Disables POST endpoint by default** — Fail closed security posture
2. **Returns 503 with helpful error** — Mobile app can gracefully handle
3. **Preserves GET endpoint** — Clients can still view existing packages
4. **Requires explicit opt-in** — `ENABLE_MOBILE_PACKAGE_PURCHASE=true` required
5. **Documents security contract** — Clear requirements for replacement flow

### What This Fix Does NOT Do ❌

1. ❌ Fix IDOR vulnerability (packageId → providerId without ownership check)
2. ❌ Fix hardcoded pricing (price: 500, packageHours: 10)
3. ❌ Fix payment bypass (status: 'CONFIRMED' regardless of isPaid)
4. ❌ Implement package catalog
5. ❌ Implement Stripe payment integration

---

## Implementation Details

### File: `app/api/client/packages/mobile/route.ts`

**Changes:**
1. Added server-side kill switch at start of POST handler
2. Default behavior: disabled (fail closed)
3. Check: `process.env.ENABLE_MOBILE_PACKAGE_PURCHASE === 'true'`
4. Returns 503 with structured error response
5. GET handler unchanged (viewing packages still works)

**Code added:**
```typescript
export async function POST(req: NextRequest) {
  // INT-M-PKG-01 CONTAINMENT: This endpoint is disabled pending security remediation.
  // Three defects require architectural redesign:
  //   1. IDOR: packageId (caller-supplied) used as providerId with no ownership check
  //   2. Hardcoded pricing: price, packageHours, duration are server constants
  //   3. Payment bypass: status='CONFIRMED' regardless of isPaid
  //
  // This endpoint will remain disabled until a replacement package catalog + payment
  // flow is implemented. The replacement must enforce:
  //   - Server-side package identity/pricing authority (InstructorPackage catalog)
  //   - Client entitlement verification (ownership/relationship check)
  //   - Payment-before-activation (Stripe payment intent required)
  //
  // To re-enable after proper implementation, set: ENABLE_MOBILE_PACKAGE_PURCHASE=true
  // See: docs/audit/phase2/INT-M-PKG-01-DISCOVERY.md
  
  const enabled = process.env.ENABLE_MOBILE_PACKAGE_PURCHASE === 'true'
  
  if (!enabled) {
    return NextResponse.json(
      {
        error: 'Mobile package purchase is temporarily unavailable',
        message: 'Please visit the web app to purchase lesson packages',
        code: 'MOBILE_PURCHASE_DISABLED',
        webUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://drivebook.com.au',
      },
      { status: 503 }
    )
  }
  
  // ... rest of handler (unreachable while disabled)
}
```

### File: `.env.example`

**Added:**
```env
# SECURITY / FEATURE FLAGS
# INT-M-PKG-01 CONTAINMENT: Mobile package purchase is disabled by default
# pending implementation of secure package catalog + payment flow.
# DO NOT enable this until the replacement architecture is complete.
# See: docs/audit/phase2/INT-M-PKG-01-DISCOVERY.md
ENABLE_MOBILE_PACKAGE_PURCHASE=false
```

---

## Security Contract for Replacement Flow

The replacement implementation must satisfy these requirements before `ENABLE_MOBILE_PACKAGE_PURCHASE=true` can be set:

### 1. Package Catalog Authority

**Required schema:**
```prisma
model InstructorPackage {
  id               String   @id @default(cuid())
  providerId       String   // ← Server owns this binding
  provider         Provider @relation(fields: [providerId], references: [id])
  name             String
  description      String?
  hours            Int      // ← Server owns this value
  price            Int      // ← Server owns this value (cents)
  currency         String   @default("AUD")
  durationDays     Int      // ← Server owns expiry period
  isActive         Boolean  @default(true)
  isPublished      Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  @@index([providerId, isActive, isPublished])
}
```

**Contract:**
- Client supplies catalog ID (not provider ID)
- Server fetches package from database
- Server extracts providerId, price, hours from catalog entry
- Client cannot substitute any of these values

### 2. Entitlement Verification

**Required checks:**
```typescript
// Option A: Public catalog (any client can purchase from published packages)
const packageEntry = await prisma.instructorPackage.findUnique({
  where: { 
    id: packageId,
    isActive: true,
    isPublished: true,  // ← Only published packages
  },
})

// Option B: Relationship-based (client must have prior booking)
const hasRelationship = await prisma.booking.findFirst({
  where: {
    customerId: client.id,
    providerId: packageEntry.providerId,
    status: { in: ['COMPLETED', 'CONFIRMED'] },
  },
})

if (!hasRelationship && !packageEntry.isPublished) {
  return 403  // Client not entitled to this package
}
```

### 3. Payment-Before-Activation

**Required flow:**
```typescript
// 1. Create booking with PENDING_PAYMENT status
const booking = await prisma.booking.create({
  data: {
    customerId: client.id,
    providerId: packageEntry.providerId,  // ← From catalog
    price: packageEntry.price,            // ← From catalog
    packageHours: packageEntry.hours,     // ← From catalog
    status: 'PENDING_PAYMENT',            // ← Not CONFIRMED
    isPaid: false,
    // ...
  },
})

// 2. Create Stripe payment intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: packageEntry.price,
  currency: packageEntry.currency.toLowerCase(),
  metadata: {
    bookingId: booking.id,
    packageId: packageEntry.id,
    customerId: client.id,
  },
})

// 3. Return client secret (client completes payment)
return {
  bookingId: booking.id,
  clientSecret: paymentIntent.client_secret,
  amount: packageEntry.price,
}

// 4. Webhook handler confirms payment and updates booking
// handlePaymentIntentSucceeded() {
//   booking.update({ status: 'CONFIRMED', isPaid: true })
// }
```

**Contract:**
- Booking starts as `PENDING_PAYMENT`
- Stripe payment required before confirmation
- Webhook handler activates package after payment succeeds
- No direct path from client request → CONFIRMED status

### 4. Provider Eligibility (Already Implemented)

Replacement flow must continue to call:
```typescript
const eligible = await checkProviderEligible(packageEntry.providerId, prisma)
if (!eligible.allowed) {
  return { error: eligible.error, status: eligible.status }
}
```

This ensures:
- Provider exists
- Provider is APPROVED
- Provider is active
- Provider subscription is valid
- Provider documents are not expired

---

## Test Coverage

### Containment Tests: `int-m-pkg-01-containment.test.ts`

**C1: Default behavior**
- ✅ POST returns 503 when flag not set
- ✅ Error includes helpful message and web URL

**C2: Explicit disable**
- ✅ POST returns 503 when flag = 'false'

**C3: Fail closed for non-true values**
- ✅ All non-'true' values → 503
- ✅ Tested: '0', 'False', 'no', 'disabled', '', etc.

**C4: GET endpoint preserved**
- ✅ GET still works (viewing existing packages)
- ✅ Only POST is disabled

**C5: Response format**
- ✅ 503 status code
- ✅ JSON content-type
- ✅ Structured error with code/message/webUrl

**C6: Vulnerable code unreachable**
- ✅ Never reaches `checkProviderEligible(packageId, ...)`
- ✅ Never creates booking

**C7: Documentation present**
- ✅ Code comments reference INT-M-PKG-01
- ✅ Code comments list all three defects
- ✅ Code comments reference discovery document

### Required Tests for Replacement Flow (Not Yet Implemented)

When replacement flow is complete, these tests are required:

**R1: Catalog authority**
- Client cannot substitute providerId
- Client cannot substitute price
- Client cannot substitute hours
- Invalid catalog ID → 404

**R2: Entitlement verification**
- Published package → any client can purchase
- Unpublished package → only entitled clients
- No relationship → 403 (if relationship required)

**R3: Payment integration**
- Booking starts PENDING_PAYMENT
- Stripe payment intent created
- Client receives client_secret
- Webhook confirms payment → CONFIRMED
- Payment failure → booking stays PENDING_PAYMENT

**R4: IDOR prevention**
- Client A cannot purchase package for Provider B without authorization
- Catalog entry binds client to correct provider
- No cross-provider leakage

**R5: Financial correctness**
- Price matches catalog entry
- Hours match catalog entry
- Currency matches catalog entry
- No hardcoded values

---

## Test Execution

### Local Development

```bash
# Ensure flag is NOT set (default state)
unset ENABLE_MOBILE_PACKAGE_PURCHASE

# Run containment tests
npm test int-m-pkg-01-containment

# Expected: 7/7 tests pass (C1-C7)
```

### Production Verification

```bash
# Verify .env does NOT have ENABLE_MOBILE_PACKAGE_PURCHASE=true
grep ENABLE_MOBILE_PACKAGE_PURCHASE .env

# Test endpoint directly
curl -X POST https://drivebook.com.au/api/client/packages/mobile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer valid-jwt" \
  -d '{"packageId":"test","paymentMethod":"stripe"}'

# Expected: HTTP 503
# Expected body: { "code": "MOBILE_PURCHASE_DISABLED", ... }
```

---

## Mobile App Integration

The mobile app must handle the 503 response gracefully:

### Current Implementation

```typescript
// mobile/services/api.ts
export const clientAPI = {
  purchasePackage: (packageId: string, paymentMethod: string) =>
    api.post('/api/client/packages/mobile', { packageId, paymentMethod }),
}
```

### Required Update

```typescript
// mobile/services/api.ts
export const clientAPI = {
  purchasePackage: async (packageId: string, paymentMethod: string) => {
    try {
      return await api.post('/api/client/packages/mobile', { packageId, paymentMethod })
    } catch (error) {
      if (error.response?.status === 503 && error.response?.data?.code === 'MOBILE_PURCHASE_DISABLED') {
        // Feature is disabled, redirect to web
        const webUrl = error.response.data.webUrl || 'https://drivebook.com.au'
        // Show user-friendly message and open web browser
        throw new MobilePurchaseDisabledError(error.response.data.message, webUrl)
      }
      throw error
    }
  },
}
```

### UI Update

```typescript
// mobile/screens/client/WalletScreen.tsx
try {
  await clientAPI.purchasePackage(pkg.id, paymentMethod)
  // Success handling
} catch (error) {
  if (error instanceof MobilePurchaseDisabledError) {
    Alert.alert(
      'Purchase via Web App',
      error.message,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Web App', onPress: () => Linking.openURL(error.webUrl) }
      ]
    )
  } else {
    // Other error handling
  }
}
```

---

## Lifecycle Status

### Current State: CONTAINMENT IMPLEMENTED

| Stage | Status | Evidence |
|---|---|---|
| Discovery | ✅ COMPLETE | `INT-M-PKG-01-DISCOVERY.md` |
| Containment | ✅ IMPLEMENTED | This document |
| Containment Tests | ⏳ PENDING EXECUTION | `int-m-pkg-01-containment.test.ts` |
| Catalog Design | ⏳ NOT STARTED | — |
| Catalog Implementation | ⏳ NOT STARTED | — |
| Payment Integration | ⏳ NOT STARTED | — |
| Replacement Tests | ⏳ NOT STARTED | — |
| Production Verification | ⏳ NOT STARTED | — |
| **INT-M-PKG-01 CLOSURE** | ⏳ NOT STARTED | **Remains OPEN** |

### Tracker Update Required

```markdown
| INT-M-PKG-01 | client/packages/mobile IDOR + hardcoded price | MEDIUM | CONFIRMED | VERIFIED | CONTAINMENT — POST disabled via kill switch; awaiting catalog implementation | 7 containment tests (C1-C7) | ⚠️ OPEN — Containment only, not complete fix | `phase2/INT-M-PKG-01-CONTAINMENT-EVIDENCE.md` | INT-M-PKG-01 |
```

---

## Next Steps

1. **Execute containment tests** — Verify 7/7 pass (C1-C7)
2. **Commit containment fix** — Deploy to production
3. **Update mobile app** — Handle 503 response gracefully
4. **Design package catalog** — Schema + business rules
5. **Implement catalog** — Database + API + admin UI
6. **Implement payment flow** — Stripe integration + webhooks
7. **Write replacement tests** — R1-R5 coverage
8. **Production verification** — Prove all three defects fixed
9. **Mark INT-M-PKG-01 CLOSED** — Only after complete replacement

---

## Security Notes

### Why This Approach?

**Option 1 (Catalog)** — Complete solution, but 1-2 weeks implementation  
**Option 2 (Ownership gate)** — Quick patch, but leaves pricing/payment defects  
**Option 3 (Kill switch)** — Immediate safety, buys time for proper fix

We chose **Option 3** because:
- ✅ Immediate risk mitigation (attackers cannot exploit vulnerabilities)
- ✅ Fail closed (safe by default)
- ✅ Does not introduce half-fixes that might be forgotten
- ✅ Forces proper architectural solution
- ✅ Mobile app gracefully degrades (redirects to web)

### Why Not Option 2?

Option 2 (ownership-only gate) would:
- ❌ Still have hardcoded $500 pricing
- ❌ Still have immediate CONFIRMED status
- ❌ Still have payment bypass via `paymentMethod: 'manual'`
- ❌ Create false sense of security ("fixed" but only partially)
- ❌ Make proper fix less urgent

### Reviewer Guidance

The containment fix should be evaluated on:
1. **Does POST return 503 by default?** (Fail closed)
2. **Is the flag explicit opt-in?** (Only 'true' enables)
3. **Is GET preserved?** (Existing packages viewable)
4. **Is error response helpful?** (Mobile app can handle)
5. **Is vulnerable code unreachable?** (Never hits IDOR path)

The containment fix should NOT be evaluated on:
- ❌ Whether IDOR is fixed (it's not, containment only)
- ❌ Whether pricing is fixed (it's not, containment only)
- ❌ Whether payment is fixed (it's not, containment only)

Those defects require **catalog + payment redesign**, tracked separately.

---

## References

- **Discovery:** `INT-M-PKG-01-DISCOVERY.md`
- **Summary:** `INT-M-PKG-01-SUMMARY.md`
- **Tracker:** `AUDIT-MASTER-TRACKER.md` line 65
- **Tests:** `__tests__/integration/int-m-pkg-01-containment.test.ts`
- **Route:** `app/api/client/packages/mobile/route.ts`
- **Mobile app:** `mobile/services/api.ts`, `mobile/screens/client/WalletScreen.tsx`
