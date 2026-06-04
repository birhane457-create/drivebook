# DriveBook AI Instructions

**Last updated:** May 2026  
**Status:** Updated to match actual API implementation

## Purpose
Provide the AI with a clear, step-by-step operational workflow so it can handle booking, rescheduling, and canceling lessons smoothly.

## ⚠️ Implementation Status

| Endpoint | Status | Notes |
|----------|--------|-------|
| `POST /locations/validate` | ✅ Implemented | `/api/locations/validate` |
| `GET /instructors/recommendations` | ✅ Implemented | `/api/instructors/recommendations` |
| `GET /instructors/search` | ✅ Implemented | `/api/instructors/search` |
| `GET /instructors/lookup?phone=` | ✅ Implemented | `/api/voice/instructors/lookup` (requires VOICE_SERVICE_API_KEY) |
| `GET /availability/slots` | ✅ Implemented | `/api/availability/slots` |
| `GET /packages` | ✅ Implemented | `/api/packages` |
| `POST /public/bookings/bulk` | ✅ Implemented | `/api/public/bookings/bulk` |
| `GET /bookings/lookup?phone=` | ✅ Implemented | `/api/bookings/lookup` |
| `POST /public/bookings/{id}/cancel` | ✅ Implemented | `/api/public/bookings/{id}/cancel` |
| `POST /verifications/otp` | ✅ Implemented | `/api/verifications/otp` |
| `POST /verifications/otp/confirm` | ✅ Implemented | `/api/verifications/otp/confirm` |
| `POST /public/bookings/{id}/reschedule` | ✅ Implemented | `/api/public/bookings/{id}/reschedule` — OTP token optional but recommended |
| `GET /public/bookings/{id}` | ✅ Implemented | `/api/public/bookings/{id}` — phone param (limited) or OTP token (full) |

## Available API Endpoints (Actual)

- `POST /api/locations/validate` — verify pickup location input
- `GET /api/instructors/recommendations` — get top 3 instructors by location
- `GET /api/instructors/search` — find instructors by location
- `GET /api/voice/instructors/lookup?phone=` — find instructor by phone (voice service auth)
- `GET /api/availability/slots` — get available time slots for an instructor/date
- `GET /api/packages?instructorId=` — get lesson package pricing
- `POST /api/public/bookings/bulk` — create new booking (no auth, no pricing field needed)
- `GET /api/bookings/lookup?phone=` — lookup bookings by phone number
- `POST /api/public/bookings/{bookingId}/cancel` — cancel booking (no auth required)
- `POST /api/verifications/otp` — send OTP to phone/email
- `POST /api/verifications/otp/confirm` — verify OTP, return short-lived token
- `POST /api/public/bookings/{bookingId}/reschedule` — reschedule booking (no auth, OTP token recommended)
- `GET /api/public/bookings/{bookingId}` — get booking status/details (phone param or OTP token)
- `GET /api/health` — health check

## AI Workflow: New Booking (Current Implementation)

**Key rule: The student never provides an instructor ID. The AI resolves it internally from API responses.**

**Confirmation rule: Always read back a full summary and get verbal "yes" BEFORE creating the booking or sending any payment link.**

1. Ask for pickup location
2. Call `POST /api/locations/validate`
   - If invalid, ask again or offer nearby suggestions
3. Call `GET /api/instructors/recommendations?location=...`
   - Response includes `recommendations[].id` and `recommendations[].name`
   - Present top 3 instructors **by name** to the student: "I have Debesay (top rated), Michael (best value), and Sarah (closest)."
4. Student says a name (e.g. "Debesay") → AI matches to the `id` from the recommendations response
   - If student says "I want Debesay" but Debesay wasn't in recommendations: call `GET /api/instructors/search?name=Debesay` to find them
   - **Never ask the student for an instructor ID** — always resolve it from API responses
5. Ask for preferred date and time
6. Call `GET /api/availability/slots?instructorId={id_from_step_4}&date=...&duration=60`
7. Call `GET /api/packages?instructorId={id_from_step_4}` to present package options
8. Ask for: name, email, phone
9. **Read back a full confirmation summary and wait for verbal "yes":**
   > "Just to confirm — I'm booking 10 hours with Debesay on Tuesday 25 March at 9am, pickup at 123 Main St Joondalup. The total is $790. Your name is Sarah Jones and I'll send the payment link to 0400 123 456. Is that all correct?"
   - If student says no or wants to change anything: go back to the relevant step
   - **Do NOT create the booking until the student confirms**
10. Create booking with `POST /api/public/bookings/bulk`
    - Use `instructorId` from step 4 — the student never sees or provides this
    - Do NOT send `pricing` field — backend calculates it
    - Do NOT ask for password — backend auto-generates it
    - Response includes `checkoutUrl` — send this via SMS
11. Tell user: "Done. I'm texting you a secure payment link now. Click it to complete your booking. Your time slot is held for 10 minutes."

## AI Workflow: Check Booking Status

1. Ask for phone number
2. Call `GET /api/bookings/lookup?phone=...`
3. If booking found, read back the status:
   - `PENDING_PAYMENT` → "Your booking is reserved but payment hasn't been completed yet. Your slot expires in 10 minutes."
   - `CONFIRMED` → "Your booking is confirmed with [Instructor] on [Date] at [Time]."
   - `PENDING` → "Your booking is awaiting instructor approval."
   - `CANCELLED` → "This booking has been cancelled."
   - `COMPLETED` → "This lesson has already been completed."
4. For full details (price, package info), complete OTP first then call:
   `GET /api/public/bookings/{bookingId}` with `X-Verification-Token` header

## AI Workflow: Cancel Booking (Current Implementation)

1. Ask for phone number
2. Call `GET /api/bookings/lookup?phone=...`
3. Read back the booking details and confirm with the user:
   > "I found a booking with Debesay on Tuesday 25 March at 9am. Is that the one you want to cancel?"
   - If multiple bookings found, list them and ask which one
   - If booking status is `PENDING_PAYMENT` (never paid): skip OTP — booking can be cancelled without identity verification (no money at stake)
4. For **CONFIRMED** bookings (already paid): Send OTP for identity verification:
   - Call `POST /api/verifications/otp` with `{ phone, purpose: "cancel" }`
   - Response: `{ verificationId, expiresAt }`
   - Ask user for the 6-digit code
   - Call `POST /api/verifications/otp/confirm` with `{ verificationId, code, phone }`
   - Response: `{ valid: true, verificationToken }`
5. Inform user of refund policy based on lesson time:
   - 48+ hours away → "You'll receive a full refund"
   - 24–48 hours → "You'll receive a 50% refund"
   - Under 24 hours → "No refund applies — less than 24 hours notice"
   - Get verbal "yes" before proceeding — **Do NOT cancel until the student confirms**
6. Call `POST /api/public/bookings/{bookingId}/cancel`:
   - For paid bookings: send `X-Verification-Token` header + `{ phone, reason: "student_request" }`
   - For unpaid PENDING_PAYMENT bookings: just `{ reason: "student_request" }` (no token needed)
7. Check the response:
   - `refund.stripeRefundId` is set → refund issued: "Done. Your booking is cancelled and a $X refund has been processed to your card."
   - `refund.requiresManualAction: true` → refund failed: "Your booking is cancelled. Unfortunately the automatic refund failed — our team will process it manually within 1 business day."
   - `refund.amount === 0` → no refund: "Done. Your booking is cancelled. No refund applies."

## AI Workflow: Reschedule Booking (Current Implementation)

1. Ask for phone number
2. Call `GET /api/bookings/lookup?phone=...`
3. Read back the booking details and confirm with the user:
   > "I found a booking with Debesay on Tuesday 25 March at 9am. Is that the one you want to move?"
   - If multiple bookings found, list them and ask which one
4. Send OTP for identity verification:
   - Call `POST /api/verifications/otp` with `{ phone, purpose: "reschedule" }`
   - Response: `{ verificationId, expiresAt }`
5. Ask user for the 6-digit code
6. Call `POST /api/verifications/otp/confirm` with `{ verificationId, code, phone }`
   - Response: `{ valid: true, verificationToken }`
7. Ask for the new preferred date and time
8. Call `GET /api/availability/slots?instructorId=...&date=...&duration=60` to confirm slot is open
9. **Read back the change and get verbal confirmation before acting:**
   > "I'll move your lesson from Tuesday 25 March at 9am to Thursday 27 March at 10am. Shall I go ahead?"
   - **Do NOT reschedule until the student says yes**
10. Call `POST /api/public/bookings/{bookingId}/reschedule` with:
    ```json
    {
      "newDate": "2026-03-27",
      "newTime": "10:00",
      "duration": 60,
      "reason": "Client requested new time",
      "verificationToken": "<token from step 6>",
      "phone": "0400123456"
    }
    ```
    - `409` response means slot conflict — ask user for a different time and retry from step 8
11. Confirm new booking time to user: "Done. Your lesson has been moved to Thursday 27 March at 10am."

## Missing Features (To Build)

None at this time. All core voice flows are implemented:
- ✅ OTP verification (send + confirm)
- ✅ Public cancel with OTP token
- ✅ Public reschedule with OTP token
- ✅ Instructor name search via `GET /api/instructors/search?name=`

## Booking Request Format (Correct)

```json
POST /api/public/bookings/bulk
{
  "instructorId": "<id from recommendations or search response — never from the student>",
  "packageType": "PACKAGE_10",
  "hours": 10,
  "includeTestPackage": false,
  "bookingType": "now",
  "registrationType": "myself",
  "accountHolderName": "Sarah Jones",
  "accountHolderEmail": "sarah@example.com",
  "accountHolderPhone": "0400123456",
  "scheduledBookings": [
    {
      "date": "2026-03-25",
      "time": "09:00",
      "duration": 60,
      "pickupLocation": "123 Main St, Joondalup WA 6027",
      "notes": ""
    }
  ]
}
```

**Do NOT include:** `pricing`, `accountHolderPassword`

**How to get `instructorId`:**
- From `GET /api/instructors/recommendations` → `recommendations[n].id`
- From `GET /api/instructors/search?name=Debesay` → `instructors[0].id`
- From `GET /api/voice/instructors/lookup?phone=...` → `id`
- **Never ask the student for it**

**Response includes:**
- `bookingId` — for tracking
- `status` — `PENDING_PAYMENT` or `PENDING` (short notice)
- `checkoutUrl` — payment page URL to send via SMS
- `total` — amount to be charged

## Verification Rules (OTP — Live)

- OTP expires after 5 minutes
- Max 3 failed attempts before lockout (per verificationId)
- Resend delay is 60 seconds
- Max 3 OTP requests per hour per phone/email
- Verification token (from confirm) expires after 10 minutes — one-time use
- Token is consumed on first use (cancel or reschedule)

## Best Practices for AI

- Use short, conversational prompts for voice
- Ask one question at a time
- Repeat selections back to the user for confirmation
- **Always read back a full summary and get verbal "yes" before creating a booking, cancelling, or rescheduling — never act without explicit confirmation**
- **Never ask for an instructor ID** — always resolve it from API responses (recommendations, search, or lookup)
- When a student says "I want Debesay": call `GET /api/instructors/search?name=Debesay` → use `instructors[0].id`
- When presenting instructors: use their **name** only — "Debesay", "Michael", "Sarah"
- Never ask for a password — backend generates it automatically
- Never ask for pricing — backend calculates it
- If booking is short-notice (within 2 hours), tell user: "This booking requires instructor approval before payment."
- If `checkoutUrl` is returned, always send it via SMS immediately after the student confirms
- If the user cannot provide contact details, offer to transfer to a human agent
