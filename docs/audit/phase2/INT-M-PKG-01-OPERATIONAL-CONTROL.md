# INT-M-PKG-01 — Operational Control: Re-Enable Gate

**Status:** CRITICAL OPERATIONAL CONTROL  
**Type:** Production environment configuration gate  
**Risk Level:** HIGH (re-enabling exposes all three original defects)

---

## Control Statement

**No operator may set `ENABLE_MOBILE_PACKAGE_PURCHASE=true` in the production environment until INT-M-PKG-01 root-cause remediation has passed ALL of the following gates:**

1. ✅ **FIX-VERIFIED** — Package catalog + payment integration implemented
2. ✅ **Authorization Tests** — Client entitlement verification proven
3. ✅ **Payment Tests** — Payment-before-activation flow proven
4. ✅ **IDOR Prevention Tests** — Cross-provider booking blocked
5. ✅ **Financial Correctness Tests** — Server-side pricing authority verified
6. ✅ **Regression Tests** — All three original defects independently proven fixed
7. ✅ **Production Verification** — Live environment testing complete
8. ✅ **Independent Review** — Security reviewer approval for re-enable

---

## Why This Control Is Critical

### Current State (Containment)

The mobile package purchase endpoint is **disabled** via server-side kill switch:

```typescript
const enabled = process.env.ENABLE_MOBILE_PACKAGE_PURCHASE === 'true'

if (!enabled) {
  return NextResponse.json(..., { status: 503 })
}

// Vulnerable code below (unreachable while disabled)
```

### What Happens If Re-Enabled Prematurely

If someone sets `ENABLE_MOBILE_PACKAGE_PURCHASE=true` **before** root-cause remediation:

| Defect | Reactivated Vulnerability | Attack Vector |
|---|---|---|
| **IDOR** | `packageId` from request → `providerId` without ownership check | Client can create package booking with ANY eligible provider |
| **Hardcoded Pricing** | `price: 500`, `packageHours: 10` (server constants) | Provider charges $1,500 but system creates booking for $500 |
| **Payment Bypass** | `status: 'CONFIRMED'` regardless of `isPaid` | Client sets `paymentMethod: 'manual'` → unpaid package activated |

**All three defects become immediately exploitable.**

---

## Required Root-Cause Remediation

Before re-enabling, the following must be implemented and verified:

### 1. Package Catalog Model

**Schema:**
```prisma
model InstructorPackage {
  id               String   @id @default(cuid())
  providerId       String   // ← Server-owned
  provider         Provider @relation(fields: [providerId], references: [id])
  name             String
  hours            Int      // ← Server-owned
  price            Int      // ← Server-owned (cents)
  currency         String   @default("AUD")
  durationDays     Int      // ← Server-owned
  isActive         Boolean  @default(true)
  isPublished      Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

**Contract:**
- Client supplies catalog ID (not provider ID)
- Server fetches package from database
- Server extracts `providerId`, `price`, `hours` from catalog entry
- Client cannot substitute any of these values

### 2. Server-Side Authority Flow

**Required implementation:**
```typescript
// Client provides catalog ID
const { packageCatalogId, paymentMethod } = await req.json()

// Server fetches authoritative package
const packageEntry = await prisma.instructorPackage.findUnique({
  where: { id: packageCatalogId, isActive: true, isPublished: true },
})

if (!packageEntry) {
  return NextResponse.json({ error: 'Package not found' }, { status: 404 })
}

// Server derives providerId from catalog (not from client)
const providerId = packageEntry.providerId

// Server verifies provider eligibility
const eligible = await checkProviderEligible(providerId, prisma)
if (!eligible.allowed) {
  return { error: eligible.error, status: eligible.status }
}

// Server creates booking with catalog values (not client values)
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

// Server creates Stripe payment intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: packageEntry.price,
  currency: packageEntry.currency,
  metadata: {
    bookingId: booking.id,
    packageId: packageEntry.id,
  },
})

// Return client secret (payment happens client-side)
return {
  bookingId: booking.id,
  clientSecret: paymentIntent.client_secret,
}
```

### 3. Payment-Before-Activation

**Webhook handler must confirm payment:**
```typescript
// app/api/stripe/webhook/route.ts
async function handlePaymentIntentSucceeded(paymentIntent) {
  const bookingId = paymentIntent.metadata.bookingId
  
  // Update booking ONLY after payment confirmed
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CONFIRMED',
      isPaid: true,
      stripePaymentIntentId: paymentIntent.id,
    },
  })
}
```

**Contract:**
- No direct path from client request → `status: 'CONFIRMED'`
- Payment must succeed before activation
- Webhook is authoritative for confirmation

---

## Test Gates Required for Re-Enable

Before setting `ENABLE_MOBILE_PACKAGE_PURCHASE=true`, execute and document:

### Gate 1: Authorization Tests

**Test:** Client A cannot purchase package intended for Provider B without authorization

```typescript
// R1: IDOR Prevention
const response = await POST('/api/client/packages/mobile', {
  packageCatalogId: PROVIDER_B_PACKAGE_ID,  // ← Not Client A's provider
}, CLIENT_A_JWT)

expect(response.status).toBe(403)  // ← Not 201
expect(bookingCreated).toBe(false)
```

**Required evidence:** Test execution log showing 403 response + no booking created

### Gate 2: Payment Tests

**Test:** Booking requires payment before confirmation

```typescript
// R2: Payment-Before-Activation
const response = await POST('/api/client/packages/mobile', {
  packageCatalogId: VALID_CATALOG_ID,
}, CLIENT_JWT)

expect(response.data.clientSecret).toBeDefined()
const booking = await prisma.booking.findUnique(...)
expect(booking.status).toBe('PENDING_PAYMENT')  // ← Not CONFIRMED
expect(booking.isPaid).toBe(false)
```

**Required evidence:** Test execution log showing `PENDING_PAYMENT` status before webhook

### Gate 3: Financial Correctness Tests

**Test:** Price comes from catalog, not client or hardcoded value

```typescript
// R3: Server-Side Pricing Authority
const catalogEntry = await prisma.instructorPackage.create({
  providerId: PROVIDER_ID,
  price: 150000,  // $1,500.00
  hours: 10,
})

const response = await POST('/api/client/packages/mobile', {
  packageCatalogId: catalogEntry.id,
}, CLIENT_JWT)

const booking = await prisma.booking.findUnique(...)
expect(booking.price).toBe(150000)  // ← From catalog, not 500
expect(booking.packageHours).toBe(10)  // ← From catalog, not hardcoded
expect(booking.providerId).toBe(PROVIDER_ID)  // ← From catalog, not client
```

**Required evidence:** Test execution log showing catalog values in booking

### Gate 4: Regression Tests

**Test:** All three original defects are independently proven fixed

```typescript
// R4a: IDOR Attack Blocked
// R4b: Hardcoded Price Eliminated
// R4c: Payment Bypass Prevented
```

**Required evidence:** Test suite covering all three attack vectors

### Gate 5: Production Verification

**Test:** Live environment with real Stripe payment

```typescript
// R5: End-to-End Production Flow
// 1. Client selects package from catalog
// 2. Server creates PENDING_PAYMENT booking
// 3. Client completes Stripe payment
// 4. Webhook confirms payment
// 5. Booking status → CONFIRMED
// 6. All financial values match catalog
```

**Required evidence:** Production test log with real payment intent

---

## Enforcement Mechanism

### Environment Configuration Audit

**Production `.env` file must NOT contain:**
```
ENABLE_MOBILE_PACKAGE_PURCHASE=true
```

**Acceptable production configurations:**
```
# Option 1: Variable absent (implicit false)
# (no ENABLE_MOBILE_PACKAGE_PURCHASE line)

# Option 2: Explicit false
ENABLE_MOBILE_PACKAGE_PURCHASE=false
```

### Deployment Gate

Add to CI/CD pipeline:

```bash
#!/bin/bash
# scripts/check-mobile-package-disabled.sh

if grep -q "ENABLE_MOBILE_PACKAGE_PURCHASE=true" .env 2>/dev/null; then
  echo "ERROR: ENABLE_MOBILE_PACKAGE_PURCHASE=true detected in production"
  echo "INT-M-PKG-01 root-cause remediation has not passed all gates"
  echo "See: docs/audit/phase2/INT-M-PKG-01-OPERATIONAL-CONTROL.md"
  exit 1
fi

echo "✓ Mobile package purchase correctly disabled"
exit 0
```

### Vercel Environment Variables

**Production environment variables must NOT contain:**
```
ENABLE_MOBILE_PACKAGE_PURCHASE = true
```

**To verify:**
```bash
vercel env ls production | grep ENABLE_MOBILE_PACKAGE_PURCHASE
# Should return: (not found) or ENABLE_MOBILE_PACKAGE_PURCHASE = false
```

---

## Re-Enable Approval Process

When root-cause remediation is complete:

### Step 1: Implementation Complete

Developer confirms:
- ✅ Package catalog schema deployed
- ✅ Server-side authority flow implemented
- ✅ Payment-before-activation enforced
- ✅ All three defects addressed in code

### Step 2: Test Evidence Package

Developer provides:
- ✅ Authorization test execution (R1)
- ✅ Payment test execution (R2)
- ✅ Financial correctness test execution (R3)
- ✅ Regression test execution (R4a-c)
- ✅ Production verification (R5)

### Step 3: Security Review

Security reviewer independently verifies:
- ✅ IDOR blocked (no cross-provider booking)
- ✅ Pricing authority (catalog values only)
- ✅ Payment required (no bypass possible)
- ✅ Test evidence is genuine
- ✅ Production environment ready

### Step 4: Approval Documentation

Security reviewer signs off:

```markdown
INT-M-PKG-01 ROOT-CAUSE REMEDIATION: APPROVED FOR RE-ENABLE

Reviewer: [Name]
Date: [YYYY-MM-DD]
Commit: [SHA]

Evidence reviewed:
- Authorization tests: [commit/link]
- Payment tests: [commit/link]
- Financial tests: [commit/link]
- Regression tests: [commit/link]
- Production verification: [commit/link]

All three defects independently verified as fixed:
✅ IDOR blocked
✅ Hardcoded pricing eliminated
✅ Payment bypass prevented

APPROVED: ENABLE_MOBILE_PACKAGE_PURCHASE may be set to true in production.
```

### Step 5: Configuration Change

DevOps sets production environment variable:
```bash
vercel env add ENABLE_MOBILE_PACKAGE_PURCHASE production
# Value: true
```

### Step 6: Post-Enable Verification

After re-enabling, verify:
1. POST creates PENDING_PAYMENT booking (not CONFIRMED)
2. Payment intent returned with client_secret
3. Stripe payment completes successfully
4. Webhook updates booking to CONFIRMED
5. No cross-provider bookings possible
6. Pricing matches catalog entries

---

## Violation Response

**If `ENABLE_MOBILE_PACKAGE_PURCHASE=true` is detected in production before approval:**

### Immediate Actions

1. **Disable immediately:**
   ```bash
   vercel env rm ENABLE_MOBILE_PACKAGE_PURCHASE production
   ```

2. **Notify security team** — Potential vulnerability re-activation

3. **Audit recent bookings:**
   ```sql
   SELECT * FROM "Booking"
   WHERE "isPackageBooking" = true
     AND "createdAt" > '[timestamp_when_enabled]'
   ORDER BY "createdAt" DESC;
   ```

4. **Check for exploitation:**
   - Cross-provider bookings (IDOR)
   - Bookings with `price: 500` (hardcoded pricing)
   - CONFIRMED bookings with `isPaid: false` (payment bypass)

5. **Incident report** — Document unauthorized re-enable

---

## Current Status (2026-08-15)

| Control | Status | Evidence |
|---|---|---|
| Production env contains `ENABLE_MOBILE_PACKAGE_PURCHASE=true` | ❌ MUST BE FALSE | Verify with `vercel env ls` |
| Root-cause remediation complete | ❌ NOT STARTED | Package catalog not implemented |
| Authorization tests passing | ❌ NOT EXECUTED | R1 test not written |
| Payment tests passing | ❌ NOT EXECUTED | R2 test not written |
| Financial tests passing | ❌ NOT EXECUTED | R3 test not written |
| Regression tests passing | ❌ NOT EXECUTED | R4 tests not written |
| Production verification complete | ❌ NOT DONE | R5 verification pending |
| Security approval for re-enable | ❌ NOT GRANTED | Remediation incomplete |

**Authorized to re-enable?** ❌ **NO**

---

## References

- **Finding:** `INT-M-PKG-01` in AUDIT-MASTER-TRACKER.md
- **Discovery:** `docs/audit/phase2/INT-M-PKG-01-DISCOVERY.md`
- **Containment:** Commit `80c31f97`
- **Security Contract:** `docs/audit/phase2/INT-M-PKG-01-CONTAINMENT-EVIDENCE.md`
- **Test Execution:** `docs/audit/phase2/INT-M-PKG-01-TEST-EXECUTION.md`

---

**CRITICAL:** This control remains in effect until INT-M-PKG-01 is marked **CLOSED** in the audit tracker following complete remediation and independent verification.
