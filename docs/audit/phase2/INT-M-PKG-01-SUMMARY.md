# INT-M-PKG-01 — Discovery Summary

**Status:** VERIFIED — Ready for fix implementation  
**Date:** 2026-08-15  
**Severity:** MEDIUM (combines IDOR + financial integrity defects)

---

## Quick Facts

| Attribute | Value |
|---|---|
| **Route** | `POST /api/client/packages/mobile` |
| **File** | `app/api/client/packages/mobile/route.ts` (lines 131–216) |
| **Used in production?** | ✅ YES — `mobile/services/api.ts` + `mobile/screens/client/WalletScreen.tsx` |
| **Authentication** | ✅ STRONG — JWT with NEXTAUTH_SECRET, role=CLIENT enforced |
| **Authorization** | ❌ MISSING — No ownership/relationship check between client and provider |
| **Pricing** | ❌ HARDCODED — `price: 500` (line 196) |
| **Booking status** | ❌ IMMEDIATE — `status: 'CONFIRMED'` (line 197) |
| **Payment bypass** | ⚠️ POSSIBLE — `paymentMethod: 'manual'` sets `isPaid: false` |

---

## Three Security Defects in One Route

### 1. IDOR / Cross-Provider Booking Attack

**The vulnerability:**
```typescript
const { packageId, paymentMethod } = await req.json();  // ← Attacker controlled
// ... (no ownership check)
const eligible = await checkProviderEligible(packageId, prisma)  // ← packageId treated as providerId
// ...
const booking = await prisma.booking.create({
  customerId: client.id,              // ← Authenticated user's customer record
  providerId: packageId,              // ← ANY eligible provider ID
  // ...
});
```

**Attack scenario:**
- Client A authenticates (valid JWT)
- Client A has existing relationship with Provider X only
- Client A sends `POST` with `packageId: PROVIDER_Y_ID`
- System creates booking linking Client A → Provider Y
- No check that Client A has any relationship with Provider Y

**Impact:** Authenticated clients can create package bookings with arbitrary providers.

---

### 2. Hardcoded Pricing Bypass

**The vulnerability:**
```typescript
const booking = await prisma.booking.create({
  data: {
    // ...
    packageHours: 10,              // ← HARDCODED
    price: 500,                    // ← HARDCODED (line 196)
    // ...
  },
});
```

**Attack scenario:**
- Provider charges $1,500 for 10-hour package in their catalog
- Client uses mobile endpoint with provider's ID
- System creates booking with `price: 500` (not $1,500)
- Provider loses $1,000 in revenue

**Impact:** Revenue loss for providers, financial reconciliation failures.

---

### 3. Manual Payment Bypass + Immediate Confirmation

**The vulnerability:**
```typescript
const { packageId, paymentMethod } = await req.json();  // ← Attacker controls paymentMethod
// ...
const booking = await prisma.booking.create({
  data: {
    // ...
    status: 'CONFIRMED',                      // ← IMMEDIATE (line 197)
    isPaid: paymentMethod !== 'manual',       // ← Caller can set to false
    // ...
  },
});
```

**Attack scenario:**
- Client sends `paymentMethod: 'manual'`
- System creates booking with `isPaid: false, status: CONFIRMED`
- Client can consume package hours without payment

**Impact:** Unpaid packages, payment reconciliation failures, potential fraud.

---

## Current Safety Gates (Partial Protection)

The route DOES have one safety gate that was added during DOC-EXP-01 remediation:

```typescript
const eligible = await checkProviderEligible(packageId, prisma)
if (!eligible.allowed) {
  return NextResponse.json(
    { error: eligible.error, code: eligible.code },
    { status: eligible.status },
  )
}
```

This checks:
- ✅ Provider exists
- ✅ Provider is APPROVED (not PENDING/SUSPENDED/REJECTED)
- ✅ Provider is active
- ✅ Provider subscription is valid (ACTIVE or TRIAL)
- ✅ Provider is accepting bookings
- ✅ Provider documents are not expired (if DrivingProviderProfile exists)

**But it does NOT check:**
- ❌ Does this client have any relationship with this provider?
- ❌ Does this client have permission to purchase from this provider?
- ❌ Is there an authoritative package catalog entry with correct pricing?

---

## Mobile App Usage Confirmed

The endpoint IS actively used in production:

**API Client:**
```typescript
// mobile/services/api.ts (lines 131-134)
export const clientAPI = {
  getPackages: () => api.get('/api/client/packages/mobile'),
  purchasePackage: (packageId: string, paymentMethod: string) =>
    api.post('/api/client/packages/mobile', { packageId, paymentMethod }),
  // ...
}
```

**UI Component:**
```typescript
// mobile/screens/client/WalletScreen.tsx
// Displays package listing and calls clientAPI.getPackages()
```

**Conclusion:** The route cannot be deleted. It must be fixed.

---

## Fix Design Options

### Option 1: Package Catalog Model (Recommended)

**Create authoritative package catalog:**

```prisma
model InstructorPackage {
  id               String   @id @default(cuid())
  providerId       String
  provider         Provider @relation(fields: [providerId], references: [id])
  name             String
  description      String?
  hours            Int
  price            Int      // cents
  durationDays     Int      // expiry period
  isActive         Boolean  @default(true)
  isPublished      Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  @@index([providerId, isActive, isPublished])
}
```

**Fixed route logic:**
1. Client provides `packageId` (catalog entry ID, not provider ID)
2. Fetch `InstructorPackage` from database
3. Extract `providerId`, `price`, `hours` from catalog entry (server authority)
4. Check provider eligibility using `providerId` from catalog
5. Create booking with catalog values
6. Require payment before confirmation

**Advantages:**
- ✅ Eliminates IDOR (catalog entry is the authority)
- ✅ Eliminates hardcoded pricing (price from catalog)
- ✅ Providers can manage their own packages
- ✅ Admin can moderate package listings
- ✅ Supports multiple package types per provider

**Implementation scope:** MEDIUM (requires schema migration, admin UI, provider UI)

---

### Option 2: Minimal Safety Gate (Quick Fix)

**Add ownership verification without catalog:**

```typescript
// Verify client has an existing relationship with this provider
const existingBooking = await prisma.booking.findFirst({
  where: {
    customerId: client.id,
    providerId: packageId,
    status: { in: ['COMPLETED', 'CONFIRMED'] },
  },
})

if (!existingBooking) {
  return NextResponse.json(
    { error: 'You must have a completed lesson with this instructor before purchasing a package' },
    { status: 403 }
  )
}
```

**Advantages:**
- ✅ Eliminates IDOR quickly
- ✅ Minimal code change
- ✅ No schema migration required

**Disadvantages:**
- ❌ Still has hardcoded pricing
- ❌ Still has immediate confirmation
- ❌ Requires client to have prior booking (may block legitimate use)
- ❌ Doesn't scale to multiple package types

**Implementation scope:** LOW (single route change)

---

### Option 3: Disable Route + Web-Only Flow

**Approach:**
1. Add feature flag: `ENABLE_MOBILE_PACKAGE_PURCHASE=false`
2. Return 503 from mobile endpoint when disabled
3. Update mobile app to redirect to web booking flow
4. Implement proper package catalog + checkout on web first
5. Re-enable mobile endpoint later with catalog integration

**Advantages:**
- ✅ Eliminates all three vulnerabilities immediately
- ✅ Buys time for proper catalog implementation
- ✅ No broken mobile app (graceful degradation)

**Disadvantages:**
- ⚠️ Temporary feature loss for mobile users
- ⚠️ Requires mobile app update

**Implementation scope:** LOW (feature flag + mobile app update)

---

## Recommended Approach

**Phase 1 (Immediate):** Option 3 — Disable mobile package purchase with feature flag
- Add `ENABLE_MOBILE_PACKAGE_PURCHASE=false` to `.env`
- Update route to return 503 with helpful error message
- Update mobile app to show "Purchase packages via web app" message
- Deploy both changes together

**Phase 2 (Next sprint):** Option 1 — Implement package catalog
- Design `InstructorPackage` schema
- Build admin UI for package management
- Build provider UI for package creation
- Implement proper checkout flow with Stripe payment
- Update mobile endpoint to use catalog
- Re-enable mobile package purchase

**Timeline:**
- Phase 1: 1 day (immediate risk mitigation)
- Phase 2: 1-2 weeks (complete solution)

---

## Test Plan

See `INT-M-PKG-01-DISCOVERY.md` Section "Test Plan" for detailed test cases:

- **D1:** Prove IDOR (cross-provider booking)
- **D2:** Prove hardcoded pricing bypass
- **D3:** Prove manual payment bypass

All three vulnerabilities confirmed in source code review. Ready for reproduction tests once fix is designed.

---

## Next Steps

1. **Decision required:** Choose fix approach (Options 1, 2, or 3)
2. **If Option 1 or 3:** Design phase before implementation
3. **If Option 2:** Proceed to implementation immediately
4. **Write integration tests** (D1-D3 reproduction + regression)
5. **Update AUDIT-MASTER-TRACKER** when fix starts

---

## References

- **Full discovery:** `phase2/INT-M-PKG-01-DISCOVERY.md`
- **Tracker:** `AUDIT-MASTER-TRACKER.md` line 65
- **Vulnerable route:** `app/api/client/packages/mobile/route.ts`
- **Mobile usage:** `mobile/services/api.ts`, `mobile/screens/client/WalletScreen.tsx`
- **Related finding:** DOC-EXP-01 (added minimal `checkProviderEligible` gate)
