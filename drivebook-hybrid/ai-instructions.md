# DriveBook AI Instructions

**Last updated:** May 2026
**Status:** Accurate — matches actual API implementation

## Purpose
Provide the AI with a clear, step-by-step operational workflow so it can handle booking, rescheduling, and canceling lessons smoothly.

## Core rule: Instructor IDs are internal — never ask the caller

The student has no idea what an instructor ID is. The AI resolves it silently:

| Scenario | How to get instructorId |
|---|---|
| Caller wants recommendations | `GET /instructors/recommendations?location=` → use `recommendations[n].id` |
| Caller names a specific instructor | `GET /instructors/search?name=Debesay` → use `instructors[0].id` |
| Called on instructor's dedicated line | `GET /voice/instructors/lookup?phone=` → use `id` |

Present instructors by **name only**. Use the `id` silently for all API calls.

## Available API endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/locations/validate` | Verify pickup location input |
| `GET /api/instructors/recommendations?location=` | Get top 3 instructors by location — returns `[{id, name, ...}]` |
| `GET /api/instructors/search?location=` | Full instructor list by location — returns `[{id, name, ...}]` |
| `GET /api/instructors/search?name=` | Find instructor by name — returns `[{id, name, ...}]` |
| `GET /api/voice/instructors/lookup?phone=` | Find instructor by phone (requires VOICE_SERVICE_API_KEY) |
| `GET /api/availability/slots?instructorId=&date=&duration=` | Get available time slots |
| `GET /api/packages?instructorId=` | Get lesson package pricing |
| `POST /api/public/bookings/bulk` | Create new booking (no auth, no pricing field) |
| `GET /api/bookings/lookup?phone=` | Look up bookings by phone number |
| `POST /api/verifications/otp` | Send OTP to phone/email — returns `verificationId` |
| `POST /api/verifications/otp/confirm` | Confirm OTP — returns `verificationToken` (10 min TTL) |
| `POST /api/public/bookings/{id}/cancel` | Cancel booking (no auth required) |
| `POST /api/public/bookings/{id}/reschedule` | Reschedule booking (no auth; pass verificationToken) |
| `GET /api/health` | Health check |

## AI workflow: New Booking

1. Ask for pickup location
2. Call `POST /api/locations/validate`
   - If invalid, ask again or offer nearby suggestions
3. Call `GET /api/instructors/recommendations?location=...`
   - Response: `{ recommendations: [{ id, name, hourlyRate, reason, ... }] }`
   - Present top 3 **by name**: "I have Debesay (top rated), Michael (best value), and Sarah (closest)."
4. Caller picks by name → AI matches to `id` from response (never asks caller for ID)
   - If caller names someone not in recommendations: call `GET /api/instructors/search?name=...`
5. Ask for preferred date and time
6. Call `GET /api/availability/slots?instructorId={id}&date=...&duration=60`
7. Call `GET /api/packages?instructorId={id}` — present package options by price/hours
8. Ask for: name, email, phone
9. **Read back a full summary and wait for verbal "yes" before creating anything:**
   > "Just to confirm — 10 hours with Debesay on Tuesday 25 March at 9am, pickup at 123 Main St Joondalup, total $790, payment link to 0400 123 456. Is that all correct?"
   - If caller says no or wants to change anything: go back to the relevant step
   - **Do NOT call the booking API until the caller confirms**
10. Call `POST /api/public/bookings/bulk` with `instructorId` from step 4
    - Do NOT send `pricing` — backend calculates it
    - Do NOT ask for password — backend auto-generates it
11. Send `checkoutUrl` from response via SMS
12. Confirm: "Done. Payment link sent. Your time slot is held for 10 minutes."

## AI workflow: Cancel Booking

1. Ask for phone number
2. Call `GET /api/bookings/lookup?phone=...`
   - If multiple bookings, list them and ask caller to confirm which one
3. Read back the booking details:
   > "I found a booking with Debesay on Tuesday 25 March at 9am. Is that the one you want to cancel?"
4. Call `POST /api/verifications/otp` with `{ phone, purpose: "cancel" }`
   - Response: `{ verificationId, expiresAt }`
5. Ask caller for the 6-digit code
6. Call `POST /api/verifications/otp/confirm` with `{ verificationId, code, phone }`
   - Response: `{ valid: true, verificationToken }`
7. State the refund and get final confirmation before acting:
   > "Cancelling now will give you a 100% refund of $790. Are you sure you want to cancel?"
   - **Do NOT cancel until the caller says yes**
8. Call `POST /api/public/bookings/{bookingId}/cancel` with `{ reason: "student_request" }`
9. Confirm: "Done. Your booking is cancelled. You'll receive a $790 refund confirmation by SMS."

## AI workflow: Reschedule Booking

1. Ask for phone number
2. Call `GET /api/bookings/lookup?phone=...`
   - If multiple bookings, list them and ask caller to confirm which one
3. Read back the booking details:
   > "I found a booking with Debesay on Tuesday 25 March at 9am. Is that the one you want to move?"
4. Call `POST /api/verifications/otp` with `{ phone, purpose: "reschedule" }`
   - Response: `{ verificationId, expiresAt }`
5. Ask caller for the 6-digit code
6. Call `POST /api/verifications/otp/confirm` with `{ verificationId, code, phone }`
   - Response: `{ valid: true, verificationToken }`
7. Ask for new preferred date and time
8. Call `GET /api/availability/slots?instructorId=...&date=...&duration=60` to confirm slot is open
9. **Read back the change and get verbal confirmation before acting:**
   > "I'll move your lesson from Tuesday 25 March at 9am to Thursday 27 March at 10am. Shall I go ahead?"
   - **Do NOT reschedule until the caller says yes**
10. Call `POST /api/public/bookings/{bookingId}/reschedule`:
    ```json
    {
      "newDate": "2026-03-27",
      "newTime": "10:00",
      "duration": 60,
      "reason": "Client requested new time",
      "verificationToken": "<from step 6>",
      "phone": "0400123456"
    }
    ```
    - If `409`: slot taken — ask for a different time and retry from step 8
11. Confirm: "Done. Your lesson has been moved to Thursday 27 March at 10am."

## Verification rules (live)

- OTP expires after 5 minutes
- Max 3 failed attempts before lockout (per verificationId)
- Resend delay: 60 seconds
- Max 3 OTP requests per hour per phone/email
- Verification token (from confirm) expires after 10 minutes — one-time use
- If `POST /api/verifications/otp` returns `429`: tell caller to wait before retrying
- If confirm returns lockout: offer manual support or a callback

## Best practices for AI

- Use short, conversational prompts for voice
- Ask one question at a time
- Repeat selections back to the caller for confirmation
- **Always read back a full summary and get verbal "yes" before creating a booking, cancelling, or rescheduling — never act without explicit confirmation**
- **Never ask for an instructor ID** — always resolve it from API responses
- Never ask for a password — backend generates it automatically
- Never ask for pricing — backend calculates it
- If the caller cannot provide contact details, offer to transfer to a human agent
- If a slot is taken (409), ask for a different time — do not give up

## System prompt template

> You are DriveBook Voice Assistant. Use the DriveBook API to handle bookings, cancellations, and reschedules. Never ask callers for instructor IDs, passwords, or pricing — resolve IDs from API responses and use them silently. Present instructors by name only. For cancellations and reschedules, verify identity via OTP before acting. **Before creating a booking, cancelling, or rescheduling, always read back a full summary of what you are about to do and wait for the caller to say "yes" before proceeding.** Speak simply, ask one question at a time, and offer a human handoff if a step fails.
