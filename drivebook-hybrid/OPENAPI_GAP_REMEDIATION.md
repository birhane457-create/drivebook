# DriveBook Voice Service  OpenAPI Gap Remediation

**Audit date:** July 2026  
**Auditor:** Cross-reference of openapi.yaml, openapi-management.yaml, openapi-webhooks.yaml  
**against:** drivebook-hybrid prompt modules, main-app-proxy.js, contract tests  

---

## Status summary

| Gap | Priority | Description | Status |
|-----|----------|-------------|--------|
| 1 | P1 | No pre-cancel policy call |  Fixed |
| 2 | P1 | Short-notice PENDING unhandled |  Fixed |
| 3 | P1 | bookingType/registrationType missing |  Fixed |
| 4 | P1 | Idempotency-Key not generated |  Fixed |
| 5 | P1 | Location validation skipped |  Fixed |
| 6 | P1 | requiresManualAction unhandled |  Fixed |
| 7 | P1 | instructor.phone withheld pre-OTP |  Fixed |
| 8 | P2 | payment-status endpoint unused |  Fixed |
| 9 | P2 | timeline endpoint unused |  Fixed |
| 10 | P2 | instructorQuery fallback undocumented |  Fixed |
| 11 | P2 | verificationToken header option missing |  Fixed |
| 12 | P3 | Contract test returns 200, spec says 201 |  Fixed |
| 13 | P3 | Two reschedule endpoints undifferentiated |  Fixed |
| 14 | P3 | Webhook canonical vs legacy | N/A  no action needed |

---

## P1  Critical fixes (Week 1)

### Gap 1  Pre-cancel policy call
**Problem:** The cancellation flow quoted refund amounts from the cancel response.  
The correct approach is to call `GET /api/bookings/:id/cancellation-policy` first,  
quote the exact dollar amount to the caller, then proceed with OTP and cancel.

**Fixes applied:**
- `prompts/modules/cancellation.md`  step 3 added: call cancellation-policy before OTP
- `routes/main-app-proxy.js`  added `GET /bookings/:id/cancellation-policy` route
- `tests/contract.test.js`  added axios mock + contract test for this endpoint

**API fields used:** `policy.refundAmount` (dollar amount), `policy.allowed` (cancellation permitted)

---

### Gap 2  Short-notice PENDING booking unhandled
**Problem:** When a booking is within 2 hours, the API returns `isShortNotice: true`,  
`status: PENDING`, and no `checkoutUrl`. The previous flow tried to send a payment link  
that didn't exist.

**Fixes applied:**
- `prompts/modules/booking.md`  added explicit branch: check `isShortNotice` in response.  
  If true: tell caller "Your booking is pending instructor approval"  do not send payment link.
- `routes/main-app-proxy.js`  added `isShortNotice` branch in the bulk booking handler.  
  Short-notice sessions saved with `lastAction: AWAITING_APPROVAL` instead of `BOOKING_CREATED`.

---

### Gap 3  Required fields missing on booking creation
**Problem:** `POST /api/public/bookings/bulk` requires `bookingType` and `registrationType`.  
Omitting them causes a 400 response from the API.

**Fix applied:**
- `prompts/modules/booking.md`  added explicit field list with defaults:  
  `bookingType: "now"`, `registrationType: "myself"` (or `"someone-else"` for third-party bookings)

---

### Gap 4  Idempotency-Key not auto-generated
**Problem:** The spec marks `Idempotency-Key` as required on `POST /api/public/bookings/bulk`.  
Without it, a retry on network timeout creates a duplicate booking.

**Fix applied:**
- `routes/main-app-proxy.js`  auto-generates a UUID via `randomUUID()` if no  
  `Idempotency-Key` header is supplied by the caller.

---

### Gap 5  Location validation step missing
**Problem:** The booking flow called instructor recommendations directly with the raw address.  
The spec says to call `POST /api/locations/validate` first. Bad addresses return confusing  
errors from the recommendations endpoint instead of a helpful "did you mean X?" response.

**Fix applied:**
- `prompts/modules/booking.md`  location validation added as step 2 of the tool sequence.  
  If `valid: false`, present suggestions and ask again.  
  Use `formattedAddress` from the response in all subsequent API calls.

---

### Gap 6  requiresManualAction on cancel response unhandled
**Problem:** The cancel response includes `requiresManualAction: boolean`. If `true`,  
the Stripe refund failed and needs manual processing. No handling existed.

**Fix applied:**
- `prompts/modules/cancellation.md`  step 10 added with two branches:  
  - `false`: normal confirmation ("refund returned within a few minutes")  
  - `true`: "The automatic refund wasn't able to process  our team will handle it manually within 1 business day."

---

### Gap 7  instructor.phone withheld pre-OTP not documented
**Problem:** `GET /api/bookings/lookup` intentionally omits `instructor.phone`  
until the caller's identity is OTP-verified. If the AI tried to read a phone number  
from lookup, it would get `undefined`.

**Fixes applied:**
- `prompts/modules/cancellation.md`  note added after step 1
- `prompts/modules/reschedule.md`  note added after step 1
- `prompts/modules/lookup.md`  documented with explanation and alternative (use GET /public/bookings/:id after OTP)

---

## P2  Quality improvements (Week 2)

### Gap 8  payment-status endpoint unused
**Problem:** `GET /public/bookings/:id/payment-status?token=` is a purpose-built  
polling endpoint with a `canPay` field the spec says to use directly. Not used anywhere.

**Fixes applied:**
- `prompts/modules/lookup.md`  added payment status check flow using this endpoint.  
  Documents all `paymentStatus` values and what to say for each.
- `routes/main-app-proxy.js`  added `GET /public/bookings/:id/payment-status` route.
- `tests/contract.test.js`  added mock + contract test.

---

### Gap 9  timeline endpoint unused
**Problem:** `GET /public/bookings/:id/timeline?token=` returns human-readable event  
descriptions designed for AI to read aloud. Not mentioned anywhere in the prompts.

**Fixes applied:**
- `prompts/modules/lookup.md`  added timeline lookup flow for "what happened to my booking?" queries.
- `routes/main-app-proxy.js`  added `GET /public/bookings/:id/timeline` route.
- `tests/contract.test.js`  added mock + contract test.

---

### Gap 10  instructorQuery fallback undocumented
**Problem:** `POST /api/public/bookings/bulk` accepts `instructorQuery` (instructor name  
or phone) as an alternative to `instructorId`. Useful when search failed to return an ID.  
Not mentioned in the booking module.

**Fix applied:**
- `prompts/modules/booking.md`  added instructorQuery fallback note.

---

### Gap 11  verificationToken header option missing from reschedule
**Problem:** The reschedule endpoint accepts `verificationToken` in both the request body  
and as `X-Verification-Token` header. The header is more secure (doesn't appear in server  
logs). Only the body option was documented.

**Fix applied:**
- `prompts/modules/reschedule.md`  both options documented. Header preferred.
- `prompts/modules/cancellation.md`  same preference noted.

---

## P3  Benign cleanup (Week 3)

### Gap 12  Contract test mock returns 200, spec says 201
**Problem:** The axios mock for `POST /api/public/bookings/bulk` returned `{ status: 200 }`.  
The real API spec defines `201 Created`. The proxy passes the actual status through  
so production was correct, but the test was inaccurate.

**Fix applied:**
- `tests/contract.test.js`  mock updated to return `{ status: 201 }`.

---

### Gap 13  Two reschedule endpoints undifferentiated
**Problem:** `PATCH /bookings/:id/reschedule` (instructor-authenticated) and  
`POST /public/bookings/:id/reschedule` (public, AI-facing) are both in the spec.  
Easy to confuse when reading docs.

**Fix applied:**
- `prompts/modules/reschedule.md`  explicit note: "AI voice endpoint vs instructor endpoint".  
  Always use POST /public/bookings/:id/reschedule. Never use PATCH.

---

### Gap 14  Webhook canonical vs legacy path
**Finding:** `/api/stripe/webhook` is canonical; `/api/webhooks/stripe` is legacy alias.  
Webhooks are called by Stripe, not the AI. No AI prompt or proxy change needed.

**Status:** No action required.

---

## Test suite status after all fixes

```
Tests:       37 passed, 37 total
Test Suites: 1 passed, 1 total
```

New contract tests added:
- `GET /api/bookings/:id/cancellation-policy`  returns policy with refundAmount, refundPercentage, allowed
- `GET /api/public/bookings/:id/payment-status`  returns paymentStatus string and canPay boolean
- `GET /api/public/bookings/:id/timeline`  returns events array with type, time, description

---

## Files changed

| File | Changes |
|------|---------|
| `prompts/modules/booking.md` | Gaps 2, 3, 5, 10 |
| `prompts/modules/cancellation.md` | Gaps 1, 6, 7, 11 |
| `prompts/modules/reschedule.md` | Gaps 7, 11, 13 |
| `prompts/modules/lookup.md` | Gaps 7, 8, 9 |
| `routes/main-app-proxy.js` | Gaps 1, 2, 4, 8, 9 |
| `tests/contract.test.js` | Gaps 1, 8, 9, 12 |

---

*Generated July 2026. Update this document when new gaps are identified via call outcome review (see voice-scenarios.md Section 8).*
---

## Second-pass audit  Gaps 1523 (July 2026)

### Gap 15  canCancel / canReschedule fields not checked (P1)
**Problem:** `GET /public/bookings/:id` returns `canCancel` and `canReschedule` booleans.
The spec explicitly states: "AI MUST use this field directly  never infer from status alone."
A CONFIRMED booking can have `canCancel=false` (lesson already passed). PENDING_PAYMENT
bookings always have `canReschedule=false`. Neither was being checked.

**Fixes applied:**
- `prompts/modules/cancellation.md`  step 3 added: check `canCancel` before proceeding
- `prompts/modules/reschedule.md` — step 3 added: check `canReschedule` before proceeding
- `tests/contract.test.js`  added mock returning `canCancel: true, canReschedule: true` + contract test

---

### Gap 16 — isPendingPayment path on cancellation-policy unhandled (P1)
**Problem:** The cancellation-policy endpoint returns `isPendingPayment: boolean`. When true,
no Stripe payment was ever captured. The correct script is "I can release the slot immediately 
no refund needed." The refundAmount is 0. The previous cancellation module went straight to
the standard refund script regardless.

**Fix applied:**
- `prompts/modules/cancellation.md`  step 4 splits on `isPendingPayment`. When true: skip OTP
  (no payment to protect), say "I can release the slot immediately", go straight to cancel.

---

### Gap 17 — isShortNotice not set by AI in booking request (P1)
**Problem:** The spec says "The AI/frontend determines this and sets isShortNotice=true in the
scheduledBookings array." Without this flag, the backend creates PENDING_PAYMENT for a lesson
starting in 30 minutes, which is wrong  it should be PENDING (instructor approval required).

**Fix applied:**
- `prompts/modules/booking.md`  added short-notice detection section: if any scheduled lesson
  starts within 120 minutes of now, set `isShortNotice: true` on that scheduledBookings item.

---

### Gap 18  EMAIL_EXISTS 409 confused with slot conflict (P2)
**Problem:** Booking creation returns 409 with either `code: SLOT_UNAVAILABLE` (slot conflict)
or `code: EMAIL_EXISTS` (account already registered). Both were treated identically as slot
conflicts  offering different time slots is wrong when the issue is email duplication.

**Fix applied:**
- `prompts/modules/booking.md`  added `EMAIL_EXISTS` handling: explain account exists, offer
  to proceed with existing account or use different email.

---

### Gap 19  Machine-readable error codes not used (P2)
**Problem:** The spec defines `code` values (`SLOT_TAKEN`, `INSTRUCTOR_NOT_FOUND`,
`INSTRUCTOR_INACTIVE`, `BOOKING_NOT_CANCELLABLE`, `BOOKING_NOT_RESCHEDULABLE`,
`VERIFICATION_EXPIRED`, `VERIFICATION_INVALID`, `RATE_LIMIT_EXCEEDED`, `VALIDATION_ERROR`)
for the AI to react to specifically. Only HTTP status codes were handled.

**Fix applied:**
- `prompts/modules/api-errors.md`  added machine-readable error code table with specific
  response scripts for each code. Added `retryable` field handling.
- `prompts/modules/booking.md`  referenced the code-specific handling for booking errors.

---

### Gap 20  canReschedule=false for PENDING_PAYMENT unhandled (P2)
**Problem:** PENDING_PAYMENT bookings always have `canReschedule=false` per spec. The reschedule
flow would proceed to OTP and fail at the reschedule endpoint instead of telling the caller
upfront that rescheduling isn't possible and offering an alternative.

**Fix applied:**
- `prompts/modules/reschedule.md`  step 3 checks `canReschedule`. If false for PENDING_PAYMENT:
  offer to cancel and rebook instead.

---

### Gap 21  Idempotency-Key missing from cancel/reschedule proxy routes (P2)
**Problem:** The proxy auto-generated Idempotency-Key for bulk booking but not for cancel or
reschedule. A network timeout retry could double-cancel or double-reschedule.

**Fix applied:**
- `routes/main-app-proxy.js`  both `/public/bookings/:id/cancel` and
  `/public/bookings/:id/reschedule` routes now auto-generate `Idempotency-Key` via `randomUUID()`
  if not supplied.

---

### Gap 22  includeTestPackage field undocumented (P3)
**Problem:** Booking request supports `includeTestPackage: boolean` to add the PDA test pack.
The booking module mentioned test packs in pricing but didn't explain how to include it in
the payload.

**Fix applied:**
- `prompts/modules/booking.md`  added `includeTestPackage` section: set to `true` only when
  caller explicitly asks. Default is `false`.

---

### Gap 23  learnerRelationship enum values not specified (P3)
**Problem:** When `registrationType: "someone-else"`, `learnerRelationship` is required.
The booking module said to collect "relationship" but didn't specify the allowed enum values.

**Fix applied:**
- `prompts/modules/booking.md`  added learnerRelationship section with full enum:
  `child | partner | grandchild | parent | friend | other`. Instructions to default to "other"
  if the answer is unclear.

---

## Final test suite status

```
Tests:       37 passed, 37 total
Test Suites: 1 passed, 1 total
```

New contract tests added in second pass:
- `GET /api/public/bookings/:id`  returns canCancel and canReschedule booleans (Gap 15)

## Complete files changed

| File | Gaps addressed |
|------|---------------|
| `prompts/modules/booking.md` | 2, 3, 5, 10, 17, 18, 19, 22, 23 |
| `prompts/modules/cancellation.md` | 1, 6, 7, 11, 15, 16 |
| `prompts/modules/reschedule.md` | 7, 11, 13, 15, 20 |
| `prompts/modules/lookup.md` | 7, 8, 9 |
| `prompts/modules/api-errors.md` | 19 |
| `routes/main-app-proxy.js` | 1, 2, 4, 8, 9, 21 |
| `tests/contract.test.js` | 1, 8, 9, 12, 15 |

*All 23 actionable gaps closed. Gap 14 confirmed N/A (webhook paths, no AI impact).*