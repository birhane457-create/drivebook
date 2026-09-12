# Instructor Bulk Booking

**Purpose:** Allow instructors to create multiple bookings at once for client wallet credits or payment plan groups.

**Status:** ✅ VERIFIED COMPLETE (June 16, 2026)

**Audit (June 16, 2026):** Batch route hardened — strict Zod validation, batched client lookup, transactional slot/`isFirstBooking` checks, limited concurrency (4), Google Calendar sync on confirmed bookings. Docs aligned with `app/api/bookings/batch/route.ts`.

---

## AS IS: Current Implementation (✅ COMPLETE)

### API Endpoint

**POST `/api/bookings/batch`**

**Location:** `app/api/bookings/batch/route.ts`

**Authentication:** Instructor only (verified via NextAuth session)

**Request Body:**
```json
{
  "bookings": [
    {
      "clientId": "client_1",
      "startTime": "2026-06-20T10:00:00Z",
      "endTime": "2026-06-20T11:00:00Z",
      "bookingType": "LESSON",
      "pickupAddress": "123 Main St",
      "pickupLatitude": -31.9505,
      "pickupLongitude": 115.8605,
      "dropoffAddress": "456 Oak Ave",
      "notes": "Bring learner permit"
    },
    {
      "clientId": "client_2",
      "startTime": "2026-06-20T11:00:00Z",
      "endTime": "2026-06-20T12:00:00Z",
      "bookingType": "LESSON"
    }
  ]
}
```

### Validation & Checks

**1. Authentication:**
- Instructor must be authenticated via NextAuth
- Returns 401 if not authenticated

**2. Rate Limiting:**
- 5 bulk requests per minute per instructor
- Returns 429 if exceeded with retry-after headers

**3. Subscription Check:**
- Instructor must have ACTIVE subscription (status='ACTIVE')
- Returns 403 if subscription inactive

**4. Approval Check:**
- Instructor must have `approvalStatus = APPROVED`
- Returns 403 if pending approval

**5. Per-Booking Validations (strict Zod schema):**
- Cannot create bookings in the past
- End time must be after start time
- Duration: 30 minutes minimum, 8 hours maximum
- Pickup coordinates (if provided): latitude −90..90, longitude −180..180
- Unknown/legacy fields rejected (`.strict()` — e.g. `specialService*`, `customPackage*`)
- Clients pre-fetched in one query (batch lookup by unique `clientId`)
- Client must belong to instructor
- Client must have valid userId (account set up)
- Slot conflict checked inside transaction (atomic with create/deduct)
- `isFirstBooking` computed inside transaction (race-safe)
- Up to 4 bookings processed concurrently per request

### Pricing Calculation

**Pricing lookup**:
```typescript
lessonPrice = instructor.hourlyRate × durationHours
```

### Payment Logic (✅ FULLY IMPLEMENTED)

**For each booking independently:**

#### **If wallet balance >= lesson price:**
```
✅ Status: CONFIRMED
✅ Wallet deducted immediately
✅ isPaid: true
✅ Confirmation email sent to client
✅ Google Calendar event created (non-blocking, when instructor has sync enabled)
✅ Lesson can proceed immediately
```

#### **If wallet balance < lesson price:**
```
⚠️ Status: PENDING_PAYMENT
❌ Wallet NOT deducted
✅ Slot conflict checked inside transaction (atomic with create)
✅ Top-up email sent to client
✅ Lesson awaits payment confirmation
```

### Response (Success)

```json
{
  "successful": [
    {
      "index": 0,
      "id": "bk_001",
      "clientId": "client_1",
      "status": "CONFIRMED",
      "price": 80.00,
      "message": "Confirmed and paid"
    },
    {
      "index": 1,
      "id": "bk_002",
      "clientId": "client_2",
      "status": "PENDING_PAYMENT",
      "price": 60.00,
      "message": "Pending payment — top-up email sent"
    }
  ],
  "failed": [],
  "summary": {
    "total": 2,
    "created": 2,
    "failed": 0
  }
}
```

### Response (With Failures)

```json
{
  "successful": [
    { "index": 0, "id": "bk_001", "clientId": "client_1", "status": "CONFIRMED" }
  ],
  "failed": [
    {
      "index": 1,
      "clientId": "client_2",
      "error": "Time slot already booked by another request",
      "status": 409
    },
    {
      "index": 2,
      "clientId": "client_3",
      "error": "Client not found or does not belong to your clients",
      "status": 404
    }
  ],
  "summary": {
    "total": 3,
    "created": 1,
    "failed": 2
  }
}
```

### Current Features (✅ ALL IMPLEMENTED)

**✅ Implemented:**
- Batch creation endpoint (up to 50 bookings per request)
- Strict request schema (`.strict()` — rejects unknown/legacy fields at parse time)
- Dynamic pricing from hourly rate × duration (hourly only; no special services / custom packages)
- Clients pre-fetched in one query per batch (unique `clientId`s)
- Up to 4 bookings processed concurrently (`BATCH_CONCURRENCY`)
- Wallet validation: pre-check for path selection; balance re-verified inside transaction before debit
- Payment logic: CONFIRMED if sufficient, PENDING_PAYMENT if insufficient
- Atomic transactions for both CONFIRMED and PENDING_PAYMENT paths (slot lock + create)
- `isFirstBooking` computed inside transaction (race-safe)
- Wallet deduction (ledger-based, same as single booking)
- Commission rate fetched once per request (instructor tier)
- Audit logging for each booking
- Email notifications:
  - Confirmation email if CONFIRMED
  - Top-up request email if PENDING_PAYMENT
  - Batch summary email to instructor
- Google Calendar event on CONFIRMED bookings when `syncGoogleCalendar` enabled (non-blocking)
- Rate limiting per instructor (5 requests/min)
- Client account validation (`userId` required)

**❌ NOT Implemented (Not Required):**
- Recurring/series bookings (can be added later as separate endpoint)
- Preview endpoint (not in scope)

---

## AS IT SHOULD BE: Future Enhancements (Phase 2+)

### 1. Booking Preview/Confirmation (Medium Priority - Phase 2)

**Endpoint:** `POST /api/bookings/preview`

**Purpose:** Preview total cost before committing batch

**Request:**
```json
{
  "bookings": [ ... ]
}
```

**Response:**
```json
{
  "bookings": [
    { 
      "clientId": "c1", 
      "price": 150.00, 
      "platformFee": 5.40,
      "instructorPayout": 144.60,
      "walletImpact": "balance_before: $200, balance_after: $50"
    }
  ],
  "totalCost": 450.00,
  "walletImpact": "$200 → $0 remaining"
}
```

**Use Case:** Instructor sees total cost before batch confirm, can cancel if needed

**Effort:** 1-2 hours

### 2. Series/Recurring Bookings (Low Priority - Phase 2+)

**Endpoint:** `POST /api/bookings/series`

**Purpose:** Auto-generate bookings on recurring schedule

**Request:**
```json
{
  "clientId": "c1",
  "duration": 60,
  "count": 6,
  "frequency": "weekly",
  "startDate": "2026-06-20",
  "startTime": "10:00"
}
```

**Action:** Create 6 bookings automatically, one per week

**Effort:** 2-3 hours

### 3. Bulk Payment Method (Low Priority - Phase 3)

**Issue:** Currently only supports wallet deduction

**Option:** Create group invoicing or payment links

**Effort:** Medium (~3-4 hours)

---

## Implementation Plan

**⚠️ DETAILED IMPLEMENTATION STEPS MOVED TO SEPARATE FILE**

See: `docs/DOCROLEBASE/08-technical/IMPLEMENTATION_PLAN.md` → Task 6: Bulk Booking

**Quick Reference:**
1. Test POST `/api/bookings/batch` endpoint (created)
2. Create POST `/api/bookings/preview` endpoint
3. Create series booking endpoint (optional)

**Files to Create:**
- `app/api/bookings/preview/route.ts`
- `app/api/bookings/series/route.ts` (optional)

---

## Testing

### Test 1: Single Booking Creation

**Setup:** Instructor with active subscription

**Request:**
```
POST /api/bookings
{ "clientId": "...", "startTime": "2026-06-20T10:00:00Z", "endTime": "2026-06-20T11:00:00Z" }
```

**Verify:**
1. Booking created with status CONFIRMED or PENDING_PAYMENT
2. Wallet transaction created if balance sufficient
3. Audit log entry created
4. Email sent to client + instructor
5. Google Calendar event created (if enabled)

### Test 2: Batch Booking

**Setup:** Instructor creates 3 bookings at once

**Request:**
```
POST /api/bookings/batch
{ "bookings": [ booking1, booking2, booking3 ] }
```

**Verify:**
1. All 3 created successfully
2. Returns summary with success count
3. If one fails (e.g., slot conflict), others still created
4. Returns failed entry with reason

### Test 3: Rate Limiting

**Setup:** Create 11 bookings in 60 seconds

**Verify:**
1. First 10 succeed
2. 11th returns 429 with retry-after header
3. Wait 60 seconds, 11th succeeds
4. Next minute, counter resets

### Test 4: Wallet Deduction

**Setup:** Client with $100 wallet balance, booking costs $150

**Verify:**
1. Booking created with status PENDING_PAYMENT
2. Wallet transaction NOT created (insufficient funds)
3. Booking awaits payment before client can use lesson

---

## References

- **Batch endpoint:** `app/api/bookings/batch/route.ts`
- **Single booking (parity reference):** `app/api/bookings/route.ts`
- **Rate Limiting:** `lib/ratelimit.ts` → `bulkBookingRateLimit`
- **Wallet Logic:** `lib/services/wallet-helpers.ts`
- **Google Calendar:** `lib/services/googleCalendar.ts` → `createCalendarEvent`
- **Database Model:** `prisma/schema.prisma` → `Booking`, `ClientWallet`

