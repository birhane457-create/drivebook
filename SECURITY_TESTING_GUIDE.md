# 🧪 SECURITY TESTING GUIDE

**Date:** February 26, 2026  
**Purpose:** Verify all security fixes are working correctly  
**Time Required:** 30 minutes

---

## 🎯 WHAT TO TEST

All critical security fixes applied to instructor dashboard endpoints:
1. Authorization checks
2. State machine validation
3. Rate limiting
4. Audit logging
5. Idempotency protection
6. Client validation

---

## 🔐 TEST 1: Authorization Checks

### Test Unauthorized Check-Out
**Expected:** 403 Forbidden

```bash
# As Instructor A, try to check-out Instructor B's booking
POST /api/bookings/{instructor_b_booking_id}/check-out
Authorization: Bearer {instructor_a_token}

# Expected Response:
{
  "error": "Forbidden - You do not have permission to access this booking"
}
```

### Test Unauthorized Cancel
**Expected:** 403 Forbidden

```bash
# As Instructor A, try to cancel Instructor B's booking
POST /api/bookings/{instructor_b_booking_id}/cancel
Authorization: Bearer {instructor_a_token}

# Expected Response:
{
  "error": "Forbidden - You do not have permission to cancel this booking"
}
```

### Test Unauthorized Reschedule
**Expected:** 403 Forbidden

```bash
# As Instructor A, try to reschedule Instructor B's booking
POST /api/bookings/{instructor_b_booking_id}/reschedule
Authorization: Bearer {instructor_a_token}
Body: {
  "newDate": "2026-03-01",
  "newTime": "10:00"
}

# Expected Response:
{
  "error": "Forbidden - You do not have permission to reschedule this booking"
}
```

✅ **PASS CRITERIA:** All return 403 Forbidden

---

## 🔄 TEST 2: State Machine Validation

### Test Cancel Completed Booking
**Expected:** 400 Bad Request

```bash
# Create booking
POST /api/bookings
Body: { ... }

# Check-in
POST /api/bookings/{id}/check-in

# Check-out (completes booking)
POST /api/bookings/{id}/check-out

# Try to cancel completed booking
POST /api/bookings/{id}/cancel

# Expected Response:
{
  "error": "Cannot transition from COMPLETED to CANCELLED"
}
```

### Test Reschedule Completed Booking
**Expected:** 400 Bad Request

```bash
# Try to reschedule completed booking
POST /api/bookings/{completed_booking_id}/reschedule
Body: {
  "newDate": "2026-03-01",
  "newTime": "10:00"
}

# Expected Response:
{
  "error": "Cannot reschedule completed bookings. Only confirmed bookings can be rescheduled."
}
```

### Test Edit Completed Booking
**Expected:** 403 Forbidden

```bash
# Try to edit completed booking
PATCH /api/bookings/{completed_booking_id}
Body: {
  "notes": "Trying to edit completed booking"
}

# Expected Response:
{
  "error": "Cannot edit completed bookings"
}
```

✅ **PASS CRITERIA:** All return appropriate error codes

---

## ⏱️ TEST 3: Rate Limiting

### Test Check-Out Rate Limit
**Expected:** 429 Too Many Requests after 10 requests

```bash
# Make 11 check-out attempts in 1 minute
for i in {1..11}; do
  curl -X POST /api/bookings/{id}/check-out \
    -H "Authorization: Bearer {token}"
done

# First 10: Success or "Already checked out"
# 11th request: 429 Too Many Requests

# Expected Response (11th):
{
  "error": "Rate limit exceeded. Please wait X seconds before trying again."
}

# Headers should include:
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2026-02-26T10:01:00Z
```

### Test Cancel Rate Limit
**Expected:** 429 after 10 requests

```bash
# Make 11 cancel attempts in 1 minute
for i in {1..11}; do
  curl -X POST /api/bookings/{id}/cancel \
    -H "Authorization: Bearer {token}"
done

# 11th request should return 429
```

### Test Booking Creation Rate Limit
**Expected:** 429 after 10 bookings

```bash
# Create 11 bookings in 1 minute
for i in {1..11}; do
  curl -X POST /api/bookings \
    -H "Authorization: Bearer {token}" \
    -d '{ "clientId": "...", "startTime": "...", "endTime": "..." }'
done

# 11th request should return 429
```

✅ **PASS CRITERIA:** 11th request returns 429 with rate limit headers

---

## 🔁 TEST 4: Idempotency Protection

### Test Double Check-Out
**Expected:** Second returns "Already checked out"

```bash
# Check-in booking
POST /api/bookings/{id}/check-in

# Check-out booking (first time)
POST /api/bookings/{id}/check-out
# Response: Success

# Check-out booking (second time)
POST /api/bookings/{id}/check-out
# Expected Response:
{
  "error": "Booking already checked out"
}

# Verify in database: Only ONE transaction exists
SELECT * FROM Transaction WHERE bookingId = '{id}';
# Should return exactly 1 row
```

### Test Double Cancel
**Expected:** Second returns "Already cancelled"

```bash
# Cancel booking (first time)
POST /api/bookings/{id}/cancel
# Response: Success

# Cancel booking (second time)
POST /api/bookings/{id}/cancel
# Expected Response:
{
  "error": "Booking already cancelled"
}
```

✅ **PASS CRITERIA:** No duplicate transactions created

---

## 👥 TEST 5: Client Validation

### Test Booking with Another Instructor's Client
**Expected:** 404 Not Found

```bash
# As Instructor A, try to book with Instructor B's client
POST /api/bookings
Authorization: Bearer {instructor_a_token}
Body: {
  "clientId": "{instructor_b_client_id}",
  "startTime": "2026-03-01T10:00:00Z",
  "endTime": "2026-03-01T11:00:00Z"
}

# Expected Response:
{
  "error": "Client not found or does not belong to you"
}
```

### Test Booking in the Past
**Expected:** 400 Bad Request

```bash
# Try to create booking in the past
POST /api/bookings
Body: {
  "clientId": "{valid_client_id}",
  "startTime": "2026-01-01T10:00:00Z",  # Past date
  "endTime": "2026-01-01T11:00:00Z"
}

# Expected Response:
{
  "error": "Cannot create bookings in the past"
}
```

### Test Booking with Suspended Client
**Expected:** 403 Forbidden

```bash
# First, suspend a client (as admin)
PATCH /api/admin/clients/{client_id}
Body: { "status": "SUSPENDED" }

# Try to book with suspended client
POST /api/bookings
Body: {
  "clientId": "{suspended_client_id}",
  "startTime": "2026-03-01T10:00:00Z",
  "endTime": "2026-03-01T11:00:00Z"
}

# Expected Response:
{
  "error": "Cannot book with suspended client"
}
```

✅ **PASS CRITERIA:** All validation checks work correctly

---

## 📝 TEST 6: Audit Logging

### Verify Audit Logs Created
**Expected:** All actions logged

```bash
# Perform various actions
POST /api/bookings/{id}/check-in
POST /api/bookings/{id}/check-out
POST /api/bookings/{id}/cancel
POST /api/bookings/{id}/reschedule
PATCH /api/bookings/{id}

# Check database for audit logs
SELECT * FROM AuditLog 
WHERE bookingId = '{id}' 
ORDER BY createdAt DESC;

# Expected: 5 audit log entries with:
- action: BOOKING_CHECKED_IN
- action: BOOKING_CHECKED_OUT
- action: BOOKING_CANCELLED
- action: BOOKING_RESCHEDULED
- action: BOOKING_UPDATED

# Each should have:
- actorId (user who performed action)
- actorRole (INSTRUCTOR/CLIENT/ADMIN)
- ipAddress
- userAgent
- success: true
- metadata (action-specific details)
```

### Verify Unauthorized Attempts Logged
**Expected:** Failed attempts logged

```bash
# Try unauthorized action
POST /api/bookings/{other_instructor_booking}/cancel
Authorization: Bearer {your_token}

# Check audit log
SELECT * FROM AuditLog 
WHERE bookingId = '{other_instructor_booking}' 
AND action = 'UNAUTHORIZED_ATTEMPT'
ORDER BY createdAt DESC;

# Expected: 1 entry with:
- success: false
- errorMessage: "Attempted to cancel booking they do not own"
- actorId: {your_user_id}
```

✅ **PASS CRITERIA:** All actions logged with correct metadata

---

## 💰 TEST 7: Financial Integrity

### Test Transaction Creation
**Expected:** Transaction created immediately with booking

```bash
# Create booking
POST /api/bookings
Body: {
  "clientId": "{client_id}",
  "startTime": "2026-03-01T10:00:00Z",
  "endTime": "2026-03-01T11:00:00Z",
  "price": 70
}

# Response includes booking ID
# Immediately check database
SELECT * FROM Transaction WHERE bookingId = '{booking_id}';

# Expected: 1 transaction with:
- status: 'PENDING'
- amount: 70
- platformFee: 10.50 (15%)
- instructorPayout: 59.50
```

### Test Transaction Update on Check-Out
**Expected:** Transaction status updated to COMPLETED

```bash
# Check-in
POST /api/bookings/{id}/check-in

# Check-out
POST /api/bookings/{id}/check-out

# Check transaction status
SELECT status FROM Transaction WHERE bookingId = '{id}';

# Expected: 'COMPLETED'
```

### Test Transaction Update on Cancel
**Expected:** Transaction status updated to CANCELLED

```bash
# Cancel booking
POST /api/bookings/{id}/cancel

# Check transaction status
SELECT status FROM Transaction WHERE bookingId = '{id}';

# Expected: 'CANCELLED'
```

✅ **PASS CRITERIA:** Transaction status always in sync with booking

---

## 🔍 TEST 8: Double Booking Prevention

### Test Reschedule to Occupied Slot
**Expected:** 409 Conflict

```bash
# Create booking A: 10:00-11:00
POST /api/bookings
Body: {
  "startTime": "2026-03-01T10:00:00Z",
  "endTime": "2026-03-01T11:00:00Z"
}

# Create booking B: 14:00-15:00
POST /api/bookings
Body: {
  "startTime": "2026-03-01T14:00:00Z",
  "endTime": "2026-03-01T15:00:00Z"
}

# Try to reschedule B to overlap with A
POST /api/bookings/{booking_b_id}/reschedule
Body: {
  "newDate": "2026-03-01",
  "newTime": "10:30"  # Overlaps with booking A
}

# Expected Response:
{
  "error": "The new time slot is already booked. Please choose a different time."
}
```

✅ **PASS CRITERIA:** Cannot create overlapping bookings

---

## 📊 TESTING CHECKLIST

### Authorization ✅
- [ ] Unauthorized check-out returns 403
- [ ] Unauthorized cancel returns 403
- [ ] Unauthorized reschedule returns 403
- [ ] Unauthorized edit returns 403

### State Machine ✅
- [ ] Cannot cancel completed booking
- [ ] Cannot reschedule completed booking
- [ ] Cannot edit completed booking
- [ ] Cannot edit cancelled booking

### Rate Limiting ✅
- [ ] 11th check-out returns 429
- [ ] 11th cancel returns 429
- [ ] 11th booking creation returns 429
- [ ] Rate limit headers present

### Idempotency ✅
- [ ] Double check-out prevented
- [ ] Double cancel prevented
- [ ] Only one transaction per booking

### Client Validation ✅
- [ ] Cannot book with other instructor's client
- [ ] Cannot book in the past
- [ ] Cannot book with suspended client

### Audit Logging ✅
- [ ] Check-in logged
- [ ] Check-out logged
- [ ] Cancel logged
- [ ] Reschedule logged
- [ ] Edit logged
- [ ] Unauthorized attempts logged

### Financial Integrity ✅
- [ ] Transaction created with booking
- [ ] Transaction updated on check-out
- [ ] Transaction updated on cancel
- [ ] No duplicate transactions

### Double Booking ✅
- [ ] Cannot reschedule to occupied slot
- [ ] Cannot create overlapping bookings

---

## 🚨 FAILURE SCENARIOS

### If Authorization Fails
**Problem:** Returns 200 instead of 403  
**Impact:** CRITICAL - Anyone can modify any booking  
**Action:** DO NOT DEPLOY - Fix immediately

### If Rate Limiting Fails
**Problem:** No 429 after 10 requests  
**Impact:** HIGH - Automation abuse possible  
**Action:** Check Upstash Redis configuration

### If Idempotency Fails
**Problem:** Multiple transactions created  
**Impact:** CRITICAL - Double payouts  
**Action:** DO NOT DEPLOY - Fix immediately

### If Audit Logging Fails
**Problem:** No audit logs created  
**Impact:** MEDIUM - No forensic trail  
**Action:** Fix before launch, but not blocking

---

## ✅ PASS CRITERIA

All tests must pass before production deployment:
- ✅ All authorization checks return 403
- ✅ All state validations return 400
- ✅ All rate limits return 429
- ✅ All idempotency checks prevent duplicates
- ✅ All client validations work
- ✅ All audit logs created
- ✅ All financial operations atomic

---

## 🎯 QUICK TEST SCRIPT

```bash
#!/bin/bash

echo "🧪 Running Security Tests..."

# Test 1: Authorization
echo "Test 1: Unauthorized check-out"
curl -X POST /api/bookings/{other_booking}/check-out \
  -H "Authorization: Bearer {token}" \
  | grep -q "403" && echo "✅ PASS" || echo "❌ FAIL"

# Test 2: State Machine
echo "Test 2: Cancel completed booking"
curl -X POST /api/bookings/{completed_booking}/cancel \
  -H "Authorization: Bearer {token}" \
  | grep -q "400" && echo "✅ PASS" || echo "❌ FAIL"

# Test 3: Rate Limiting
echo "Test 3: Rate limit (11th request)"
for i in {1..11}; do
  curl -X POST /api/bookings/{id}/check-out \
    -H "Authorization: Bearer {token}"
done | tail -1 | grep -q "429" && echo "✅ PASS" || echo "❌ FAIL"

# Test 4: Idempotency
echo "Test 4: Double check-out"
curl -X POST /api/bookings/{id}/check-out \
  -H "Authorization: Bearer {token}"
curl -X POST /api/bookings/{id}/check-out \
  -H "Authorization: Bearer {token}" \
  | grep -q "already checked out" && echo "✅ PASS" || echo "❌ FAIL"

echo "🎉 Security tests complete!"
```

---

**Document Created:** February 26, 2026  
**Purpose:** Verify all security fixes  
**Time Required:** 30 minutes  
**Status:** Ready for testing
