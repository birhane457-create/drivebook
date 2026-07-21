# AI Voice Receptionist — System Guide

**Last Updated:** July 2026  
**AI Engine:** VAPI (Voice AI Platform)  
**Telephony:** Twilio  
**Deployment:** Railway (`voice.drivebook.com.au`)

---

## What It Does

Each PRO+ instructor gets a dedicated phone number. When a student calls, VAPI answers and runs an AI conversation that can:

1. Find instructors near a suburb/postcode
2. Check available lesson slots
3. Get package pricing
4. Create a booking (student account + booking record in DB)
5. Validate the pickup address against the instructor's service area
6. SMS the student a payment link

The conversation script is in `VAPI_SYSTEM_PROMPT.md`. The tool implementations are in `routes/main-app-proxy.js`.

---

## Tools (VAPI → DriveBook API)

| Tool | API endpoint | What it does |
|------|-------------|-------------|
| `findInstructors` | `GET /api/instructors/recommendations` | Find instructors by suburb/postcode + transmission type |
| `getAvailableSlots` | `GET /api/availability/slots` | Get open lesson times for a specific date |
| `getPackages` | `GET /api/packages` | Get package options (6/10/15 hrs) with prices |
| `createBooking` | `POST /api/public/bookings/bulk` | Create user account + booking, returns payment link |
| `validateLocation` | `POST /api/locations/validate` | Geocode the spoken address |
| `checkServiceArea` | `POST /api/public/instructors/{id}/check-service-area` | Verify address is within instructor's radius |
| `cancelBooking` | `POST /api/bookings/{id}/cancel` | Cancel a booking (uses `VOICE_SERVICE_API_KEY`) |
| `getCancellationPolicy` | `GET /api/bookings/{id}/cancellation-policy` | Get refund terms for cancellation |

---

## After createBooking

`createBooking` creates the booking and user account (if new). It returns:
- `bookingType: 'now'` → student receives SMS with DriveBook payment page link
- `bookingType: 'later'` → student receives SMS with Stripe Checkout link

`main-app-proxy.js` detects the response and sends the appropriate SMS via Twilio automatically.

---

## Session Recovery

If a call drops mid-booking, VAPI will start a new session. The hybrid service stores session state in Upstash Redis (1h TTL) so the conversation can resume. This is handled by `services/voice-session-service.js`.

---

## Call Flows

**Book Now:**
```
Student calls → VAPI greets → collects suburb + transmission →
findInstructors → student picks instructor →
getPackages → student picks package →
getAvailableSlots (date) → student picks time →
validateLocation + checkServiceArea →
createBooking → SMS payment link sent →
VAPI confirms booking
```

**Book Later:**
```
Same as Book Now but skips slot selection →
createBooking with bookingType=later →
SMS Stripe Checkout link sent →
Student pays → wallet credited → books lessons later from dashboard
```

**Cancel:**
```
Student calls → VAPI identifies booking by phone →
getCancellationPolicy → confirms refund terms →
cancelBooking → confirmation SMS sent
```

---

## Updating the AI Prompt

The full conversation script is in `VAPI_SYSTEM_PROMPT.md`. To deploy changes:

1. Edit `VAPI_SYSTEM_PROMPT.md`
2. Run `node scripts/build-vapi-prompt.js` (replaces env var placeholders)
3. Update the prompt in VAPI dashboard → Assistant → System Prompt

The script replaces:
- `{{SUPPORT_PHONE}}` → value from `process.env.SUPPORT_PHONE`
- Any other `{{ENV_VAR}}` placeholders

---

## Testing

```bash
# Test a tool call directly
curl -X POST https://voice.drivebook.com.au/api/findInstructors \
  -H "Content-Type: application/json" \
  -d '{"suburb":"Bayswater","transmissionType":"Automatic"}'

# Test health
curl https://voice.drivebook.com.au/api/health
```

For end-to-end testing, call the VAPI test number from the VAPI dashboard (doesn't use Twilio credits).

---

## Known Issues / Limitations

- TTS (Adam, 11Labs) occasionally mispronounces Eritrean names. Consider `en-AU-NatashaNeural` (Azure) as an alternative.
- The `/set-password` flow (new accounts after voice booking) needs manual QA: call → book later → receive SMS → click link → correct email → set password.
- `SUPPORT_PHONE` in `VAPI_SYSTEM_PROMPT.md` is a placeholder until a real number is set.
