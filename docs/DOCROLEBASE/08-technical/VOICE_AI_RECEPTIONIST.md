# Voice AI Receptionist

**Status:** ✅ PRODUCTION (July 2026)

---

## Overview

DriveBook's AI phone receptionist handles inbound calls for booking, rescheduling, and cancellation. It is built on VAPI with GPT-4o-mini, routes through a Node.js hybrid server on Railway, and calls the Next.js app on Vercel.

---

## Infrastructure

| Component | Technology | Hosted on |
|---|---|---|
| AI model | GPT-4o-mini (temperature 0.1) | VAPI |
| Transcriber | Deepgram Nova 2 (en-AU) | VAPI |
| Voice | 11Labs Adam (consider switching to Azure en-AU-NatashaNeural) | VAPI |
| Hybrid proxy | Node.js/Express | Railway |
| Next.js API | Next.js 14 | Vercel |
| Session storage | In-process Map (single instance) or Redis if `REDIS_URL` set | Railway |

**VAPI Assistant ID:** `a97b2303-b75c-4764-abb8-28e13e0416b9`  
**Railway service:** watches GitHub `birhane457-create/drivebook` branch `main`  
**Vercel app:** watches GitLab `debesay304/drivebook2` branch `production-hardening-june-2026`

---

## Booking Flow

1. Caller gives postcode (preferred) or suburb
2. AI calls `findInstructors` → presents `voice.voiceName` + `voice.summary` verbatim
3. AI calls `getPackages` → reads `voicePackages` array verbatim (no calculation)
4. Caller chooses Book Now or Buy Later
5. AI collects name, email (normalised from spoken format), phone
6. AI calls `createBooking`
7. Backend creates user account + sends account setup link via **both SMS and email**
8. Buy Later: Stripe Checkout Session created. The hybrid server SMS's the `checkoutUrl` to the student's phone. No Booking row created until Stripe webhook fires after payment.
9. Book Now: Booking row created, slot reserved 10 min, payment link SMS sent via hybrid server

---

## Account Creation (Voice Path)

- Account created **before payment** during `createBooking` call
- Password auto-generated (cryptographic), never spoken to caller
- Setup link sent via **both SMS and email**
- `/set-password` page allows student to set password AND correct email if AI misheard it
- Setup token expires 24 hours; instructor booking emails always regenerate a fresh token

---

## Tool Definitions

All tools are `apiRequest` type. GET tools use `{{variable}}` LiquidJS URL templates.

| Tool | Method | Endpoint |
|---|---|---|
| findInstructors | GET | `/api/instructors/recommendations?location={{location}}&vehicleType={{vehicleType}}` |
| getPackages | GET | `/api/packages?instructorId={{instructorId}}` |
| getAvailableSlots | GET | `/api/availability/slots?instructorId={{instructorId}}&date={{date}}&lessonDurationMinutes={{lessonDurationMinutes}}` |
| validateLocation | POST | `/api/locations/validate` |
| checkServiceArea | GET | `/api/public/check-service-area?instructorId={{instructorId}}&address={{address}}` |
| createBooking | POST | `/api/public/bookings/bulk` |
| lookupBookings | GET | `/api/bookings/lookup?phone={{phone}}` |
| getCancellationPolicy | GET | `/api/bookings/{{id}}/cancellation-policy` |
| sendOtp | POST | `/api/verifications/otp` |
| confirmOtp | POST | `/api/verifications/otp/confirm` |
| cancelBooking | POST | `/api/public/bookings/{{id}}/cancel` |
| rescheduleBooking | POST | `/api/public/bookings/{{id}}/reschedule` |

Authentication: VAPI `VAPI_WEBHOOK_SECRET` Bearer Token credential applied to all tools. Hybrid middleware accepts both `x-vapi-secret` header and `Authorization: Bearer` header.

---

## Backend Voice Response Fields

### `GET /api/instructors/recommendations`
Returns `voice.voiceName` (phonetic spelling) and `voice.summary` (verbatim read string).

### `GET /api/packages`
Returns `voicePackages` array of pre-formatted strings:
```
["6 hours for 427.89 dollars, that is 5 percent off", ...]
```
AI reads these verbatim — never calculates prices.

### `POST /api/public/bookings/bulk`
Returns `voice.confirmation` (pre-assembled), `voice.remainingHours`, `voice.package`.  
Buy Later returns `checkoutUrl` only — no `voice` object, no `Booking` row until Stripe webhook.

---

## System Prompt Key Rules

- Postcode first (strip spaces: `"6 0 5 1"` → `"6051"`)
- `vehicleType` always `AUTO` or `MANUAL` (never `"Automatic"`)
- STOP → execute tool → WAIT for response → ONLY THEN speak
- Never announce success before `bookingId` or `checkoutUrl` in response
- Read `voice.voiceName` for instructor names (never pronounce raw name)
- Read `voicePackages` verbatim (never calculate)
- STT glitch: infer closest option, confirm once

System prompt file: `drivebook-hybrid/VAPI_SYSTEM_PROMPT.md`  
Update script: `node update-prompt-only.js VAPI_API_KEY ASSISTANT_ID`  
Rebuild script: `node rebuild-vapi-assistant.js VAPI_API_KEY OLD_ASSISTANT_ID`

---

## Known Gaps / TODO

- Instructor `DEBESAY WELDEGEBRIEL BIRHANE` has address typo (`Maylamds`) — fix in admin dashboard → baseLatitude/baseLongitude will re-geocode
- Support phone `0488 000 000` in system prompt is a placeholder — replace with real number
- Voice for TTS: Adam mispronounces "Debesay" — consider Azure `en-AU-NatashaNeural`
- `voicePackages` and `voice.voiceName` pending Vercel deploy (GitLab push needed)

---

## Deployment

```bash
# Push to Railway (hybrid server)
git push origin main

# Push to Vercel (Next.js app) — preview first
git push gitlab main
# then merge main → production-hardening-june-2026 on GitLab

# Update VAPI system prompt only (no tools changed)
node update-prompt-only.js VAPI_API_KEY ASSISTANT_ID

# Full rebuild (tools + prompt + new assistant)
node rebuild-vapi-assistant.js VAPI_API_KEY OLD_ASSISTANT_ID
# then update phone number in VAPI dashboard to new assistant ID
```
