# INT-M-PKG-01 — Mobile Package Purchase IDOR + Hardcoded Pricing

**Classification:** MEDIUM  
**Status:** DISCOVERY — Claim verified  
**Date:** 2026-08-15  
**Route:** `POST /api/client/packages/mobile`  
**File:** `app/api/client/packages/mobile/route.ts` (lines 131–216)

---

## Executive Summary

The mobile package purchase endpoint combines two security-relevant defects in a single reachable code path:

1. **IDOR / Provider Binding Failure**: The `packageId` parameter, supplied by the caller, is used directly as `providerId` without verifying that the authenticated client has any existing relationship with that provider.

2. **Hardcoded Pricing**: The route creates bookings with a hardcoded `price: 500` (line 202) instead of fetching an authoritative package price from a database record.

3. **Direct CONFIRMED Status**: Bookings are created with `status: 'CONFIRMED'` (line 203) immediately, bypassing any approval workflow.

---

## Vulnerability Proof

### Route Flow Map

```typescript
POST /api/client/packages/mobile
↓
validateMobileToken(req) — JWT auth, role === 'CLIENT'
↓
const { packageId, paymentMethod } = await req.json()  ← CALLER CONTROLLED
↓
client = prisma.customer.findFirst({ where: { userId: auth.user!.id } })
↓
checkProviderEligible(packageId, prisma)  ← packageId TREATED AS providerId
  ↳ Provider.exists? approvalStatus='APPROVED'? isActive? subscription? docs?
↓
prisma.booking.create({
  customerId:       client.id,
  providerId:       packageId,           ← NO ownership check
  isPackageBooking: true,
  packageHours:     10,                  ← HARDCODED
  packageStatus:    'active',
  packageExpiryDate: Date.now() + 90d,
  price:            500,                 ← HARDCODED
  status:           'CONFIRMED',         ← IMMEDIATE CONFIRMATION
  isPaid:           paymentMethod !== 'manual',
  duration:         10,
  startTime:        new Date(),
  endTime:          new Date() + 10h,
  createdBy:        auth.user!.id,
})
```

### Input Validation Audit

| Input | Source | Validation | Can attacker control? |
|---|---|---|---|
| `packageId` | Request body | Required (400 if missing), passed to `checkProviderEligible()` | ✅ YES |
| `paymentMethod` | Request body | No validation; affects `isPaid` boolean only | ✅ YES |
| `auth.user.id` | JWT token | Verified via `validateMobileToken()`, signed with `NEXTAUTH_SECRET` | ❌ NO (cryptographically bound) |
| `auth.user.role` | JWT token | Must be `'CLIENT'` (403 if not) | ❌ NO (enforced) |
| `client.id` | Database lookup via `userId` | Derived from authenticated user; returns 404 if no Customer record | ❌ NO |
| `price` | Hardcoded | Always 500 | ⚠️ Not attacker-controlled, but wrong |
| `packageHours` | Hardcoded | Always 10 | ⚠️ Not attacker-controlled, but wrong |
| `status` | Hardcoded | Always `'CONFIRMED'` | ⚠️ Not attacker-controlled, but permits immediate activation |

### Authorization Flow

**Current behavior:**
1. Client authenticates with valid JWT (cryptographically strong)
2. Client provides arbitrary `packageId` in request body
3. Route treats `packageId` as `providerId`
4. Route calls `checkProviderEligible(packageId)` which verifies:
   - Provider exists
   - Provider is APPROVED
   - Provider is active
   - Provider subscription is valid
   - Provider documents are not expired
5. **Missing check**: Does the authenticated client have any relationship with this provider?
6. Route creates booking linking `client.id` → `packageId (as providerId)`

**Attack scenario:**
```
Attacker: Authenticated CLIENT user (valid JWT, clientId=VICTIM_CLIENT)
Target:   Provider B (eligible, but no prior relationship with attacker)

POST /api/client/packages/mobile
Authorization: Bearer <attacker_jwt>
{
  "packageId": "PROVIDER_B_ID",
  "paymentMethod": "manual"
}

Result:
✅ checkProviderEligible passes (Provider B is eligible)
✅ Booking created:
    customerId:  VICTIM_CLIENT
    providerId:  PROVIDER_B_ID     ← Cross-provider IDOR
    price:       500                ← Not Provider B's actual package price
    status:      CONFIRMED          ← Immediately active
    isPaid:      false              ← paymentMethod='manual' bypasses payment
```

**Consequence:**
- Attacker can create a package booking with ANY eligible provider
- Attacker uses hardcoded $500 price regardless of provider's actual pricing
- Attacker can set `isPaid: false` via `paymentMethod: 'manual'`
- Booking is immediately `CONFIRMED` without admin approval

---

## Code Evidence

**File:** `app/api/client/packages/mobile/route.ts`  
**Lines:** 131–216

### Critical Section (lines 177–208)

```typescript
// Create package booking from packageId (which is actually booking or instructor package)
// NOTE: packageId is used as providerId — deeper validation tracked in INT-M-PKG-01
// Minimum safety gate: verify the provider exists and is eligible (DOC-EXP-01)
const eligible = await checkProviderEligible(packageId, prisma)
if (!eligible.allowed) {
  return NextResponse.json(
    { error: eligible.error, code: eligible.code },
    { status: eligible.status },
  )
}

// For now, just create a basic package booking
const booking = await prisma.booking.create({
  data: {
    customerId: client.id,
    providerId: packageId, // packageId should be instructor ID in this context
    isPackageBooking: true,
    packageHours: 10, // Default package hours
    packageStatus: 'active',
    packageExpiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    price: 500,
    status: 'CONFIRMED',
    isPaid: paymentMethod !== 'manual',
    duration: 10,
    startTime: new Date(),
    endTime: new Date(Date.now() + 10 * 60 * 60 * 1000),
    createdBy: auth.user!.id,
  },
});
```

**Observations:**
- Line 177: Comment explicitly acknowledges `packageId` is used as `providerId`
- Line 178: Comment references INT-M-PKG-01 as tracking issue
- Line 179: Comment describes `checkProviderEligible()` as "minimum safety gate"
- Line 190: `providerId: packageId` — direct assignment without ownership check
- Line 195: `packageExpiryDate` calculated as 90 days from now
- Line 196: `price: 500` — hardcoded value
- Line 197: `status: 'CONFIRMED'` — immediate activation
- Line 198: `isPaid: paymentMethod !== 'manual'` — caller can set to false

### Authentication (lines 134–147)

```typescript
// Validate mobile token
const auth = await validateMobileToken(req);
if (!auth.valid) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const { packageId, paymentMethod } = await req.json();

if (!packageId) {
  return NextResponse.json(
    { error: 'Package ID is required' },
    { status: 400 }
  );
}

// Verify user is a client
if (auth.user?.role !== 'CLIENT') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Authentication is correct:**
- JWT validation with `NEXTAUTH_SECRET` (cryptographically strong)
- Role enforcement (`CLIENT` only)
- User lookup in database confirms user still exists

**Authorization is missing:**
- No check that `packageId` (as `providerId`) has any relationship to `auth.user.id`
- No check that client has purchased a package from this provider before
- No check that a package catalog entry exists for this provider

---

## Threat Model

### Attacker Profile

**Who:** Authenticated CLIENT user with valid mobile JWT token  
**Goal:** Create package bookings with arbitrary providers at hardcoded price

### Attack Vectors

#### A1: Cross-Provider IDOR

**Steps:**
1. Attacker authenticates as CLIENT (valid JWT)
2. Attacker enumerates eligible provider IDs (via public instructor listing or leaked IDs)
3. Attacker sends `POST /api/client/packages/mobile` with `packageId: TARGET_PROVIDER_ID`
4. System creates booking linking attacker → target provider
5. Booking is immediately CONFIRMED

**Impact:**
- Attacker can create package bookings with providers they have no relationship with
- Attacker bypasses provider's actual package purchase flow
- Attacker uses hardcoded $500 regardless of provider's actual pricing

#### A2: Price Manipulation (via hardcoded value)

**Steps:**
1. Provider charges $1,500 for 10-hour package in their catalog
2. Attacker uses mobile endpoint with provider's ID
3. System creates booking with `price: 500`
4. Attacker gets 10-hour package for $500 instead of $1,500

**Impact:**
- Revenue loss for providers
- Financial reconciliation mismatch
- Audit trail shows incorrect pricing

#### A3: Manual Payment Bypass

**Steps:**
1. Attacker sends `paymentMethod: 'manual'`
2. System creates booking with `isPaid: false`
3. Booking is still `status: CONFIRMED` (immediately active)
4. Attacker can consume package hours without payment

**Impact:**
- Unpaid package bookings
- Payment reconciliation failures
- Potential fraud

---

## Related Systems

### Dependencies

| System | Role | Security boundary |
|---|---|---|
| `validateMobileToken()` | JWT authentication | ✅ STRONG — uses NEXTAUTH_SECRET |
| `checkProviderEligible()` | Provider eligibility gate | ⚠️ PARTIAL — checks provider status, not ownership |
| `prisma.booking.create()` | Database write | ❌ NO AUTHORIZATION — trusts route logic |

### Callers

**Question:** Is this endpoint actually used in production mobile app?

Needs investigation:
- Check `mobile/` directory for API client code
- Check for calls to `/api/client/packages/mobile`
- If route is unused, consider deleting instead of fixing

---

## Risk Assessment

### Severity: MEDIUM

**Justification:**
- **Authentication is strong** (JWT with NEXTAUTH_SECRET)
- **Role enforcement is correct** (CLIENT only)
- **Authorization is missing** (no ownership/relationship check)
- **Financial impact is limited** (hardcoded $500, not arbitrary amounts)
- **Attack requires valid CLIENT account** (reduces attack surface)
- **Status is immediately CONFIRMED** (bypasses approval workflow)

### CVSS Estimate (Informal)

- **AV:N** (Network - requires network access to API)
- **AC:L** (Low complexity - just needs valid CLIENT JWT)
- **PR:L** (Low privileges - requires CLIENT account)
- **UI:N** (No user interaction needed)
- **S:U** (Unchanged scope)
- **C:N** (No confidentiality impact)
- **I:L** (Low integrity impact - creates incorrect bookings)
- **A:N** (No availability impact)

**Estimated Score:** 4.3 (MEDIUM)

---

## Fix Design (Proposed — Not Implemented)

### Option 1: Delete Route (Preferred if unused)

If the mobile app doesn't actually call this endpoint:
1. Delete `app/api/client/packages/mobile/route.ts`
2. Update mobile app to use standard web booking flow
3. Document deletion in changelog

### Option 2: Implement Proper Authorization (If route is needed)

**Requirements:**
1. Create `InstructorPackage` catalog table with authorized pricing
2. Require `packageId` to be a catalog entry ID, not provider ID
3. Fetch `providerId` from catalog entry (server-side authority)
4. Fetch `price` from catalog entry (server-side authority)
5. Verify client has permission to purchase from this catalog
6. Change status to `PENDING_PAYMENT` (not `CONFIRMED`)
7. Require payment flow before confirmation

**Schema addition:**
```prisma
model InstructorPackage {
  id               String   @id @default(cuid())
  providerId       String
  provider         Provider @relation(fields: [providerId], references: [id])
  name             String
  hours            Int
  price            Int      // cents
  durationDays     Int
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

**Fixed route logic:**
```typescript
// Get package catalog entry
const packageEntry = await prisma.instructorPackage.findUnique({
  where: { id: packageId, isActive: true },
  include: { provider: true },
})

if (!packageEntry) {
  return NextResponse.json(
    { error: 'Package not found or no longer available' },
    { status: 404 }
  )
}

// Check provider eligibility
const eligible = await checkProviderEligible(packageEntry.providerId, prisma)
if (!eligible.allowed) {
  return NextResponse.json(
    { error: eligible.error, code: eligible.code },
    { status: eligible.status },
  )
}

// Create booking with authoritative values
const booking = await prisma.booking.create({
  data: {
    customerId:       client.id,
    providerId:       packageEntry.providerId,  // ← from catalog
    isPackageBooking: true,
    packageHours:     packageEntry.hours,       // ← from catalog
    packageStatus:    'pending_payment',
    packageExpiryDate: new Date(Date.now() + packageEntry.durationDays * 86400000),
    price:            packageEntry.price,       // ← from catalog
    status:           'PENDING_PAYMENT',        // ← requires payment
    isPaid:           false,
    duration:         packageEntry.hours,
    startTime:        new Date(),
    endTime:          new Date(Date.now() + packageEntry.hours * 3600000),
    createdBy:        auth.user!.id,
  },
})

// Return payment intent for Stripe
return NextResponse.json({
  success: true,
  bookingId: booking.id,
  paymentRequired: true,
  amount: packageEntry.price,
  clientSecret: paymentIntent.client_secret,
})
```

---

## Test Plan (Discovery Phase)

### D1: Prove IDOR (Cross-Provider Booking)

**Setup:**
- Create Provider A (eligible)
- Create Provider B (eligible)
- Create Client X (has prior booking with Provider A only)
- Authenticate as Client X

**Attack:**
```bash
curl -X POST http://localhost:3000/api/client/packages/mobile \
  -H "Authorization: Bearer <CLIENT_X_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"packageId": "<PROVIDER_B_ID>", "paymentMethod": "manual"}'
```

**Expected (vulnerable) result:**
- HTTP 201
- Booking created with `customerId: CLIENT_X, providerId: PROVIDER_B`
- Booking status: `CONFIRMED`
- Price: `500`

**Expected (fixed) result:**
- HTTP 404 or 403
- Error: Package not found / not authorized

### D2: Prove Hardcoded Pricing

**Setup:**
- Create Provider C with hourlyRate = 150 (would imply 10h package = $1500)
- Authenticate as valid CLIENT

**Attack:**
```bash
curl -X POST http://localhost:3000/api/client/packages/mobile \
  -H "Authorization: Bearer <CLIENT_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"packageId": "<PROVIDER_C_ID>", "paymentMethod": "manual"}'
```

**Expected (vulnerable) result:**
- Booking created with `price: 500` (not $1500)

**Expected (fixed) result:**
- Booking created with `price` from catalog entry

### D3: Prove Manual Payment Bypass

**Setup:**
- Authenticate as valid CLIENT

**Attack:**
```bash
curl -X POST http://localhost:3000/api/client/packages/mobile \
  -H "Authorization: Bearer <CLIENT_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"packageId": "<PROVIDER_ID>", "paymentMethod": "manual"}'
```

**Expected (vulnerable) result:**
- Booking created with `isPaid: false, status: CONFIRMED`
- Client can use package without payment

**Expected (fixed) result:**
- Booking requires payment flow
- Status remains `PENDING_PAYMENT` until payment confirmed

---

## Next Actions

1. **Verify route is actually used** (check mobile app source)
2. **If unused:** Delete route, update mobile app
3. **If used:** Implement Option 2 (proper authorization + catalog)
4. **Write integration tests** D1–D3
5. **Update AUDIT-MASTER-TRACKER** status to VERIFIED → FIX-STARTED

---

## References

- **Discovery commit:** (this document creation)
- **Tracker:** `docs/audit/AUDIT-MASTER-TRACKER.md` line (INT-M-PKG-01)
- **Related finding:** DOC-EXP-01 (discovered during that remediation)
- **checkProviderEligible:** `lib/booking/checkProviderEligible.ts` (DOC-EXP-01 fix)

---

## Appendix: Full Route Source

See: `app/api/client/packages/mobile/route.ts` lines 131–216

Key observations:
- Line 177: Comment acknowledges `packageId` → `providerId` issue
- Line 178: Comment references INT-M-PKG-01 tracking
- Line 190: Direct assignment without ownership check
- Line 196: Hardcoded `price: 500`
- Line 197: Immediate `status: 'CONFIRMED'`
- Line 198: Caller-controlled `isPaid` via `paymentMethod`

---

**Status:** DISCOVERY COMPLETE — Ready for verification gate
