# Integration Guide — drivebook-hybrid ↔ DriveBook

**Last Updated:** July 2026

---

## Overview

`drivebook-hybrid` (Railway) calls the main DriveBook app (Vercel) via its public API. There is no shared database — all data lives in the main app's PostgreSQL DB (Neon).

---

## Authentication

Most voice booking endpoints are public (`/api/public/*`). Protected endpoints (cancel flow) require:

```
X-API-Key: <VOICE_SERVICE_API_KEY>
```

Both services share this secret via environment variables.

---

## API Contracts

### Find instructors
```
GET /api/instructors/recommendations?location=Bayswater&vehicleType=Automatic

Response: {
  instructors: [{
    id, name, hourlyRate, averageRating,
    voice: { voiceName, summary, serviceArea }
  }]
}
```

### Get available slots
```
GET /api/availability/slots?instructorId={id}&date=YYYY-MM-DD&duration=60

Response: {
  slots: [{ time: "09:00", available: true }],
  availableSlots: [{ startTime, endTime, bookingTime, voice: { speakTime, speakDate, confirmation } }]
}
```

`availableSlots[].voice.*` fields are pre-formatted for VAPI to read aloud.

### Get packages
```
GET /api/packages?instructorId={id}

Response: {
  packages: [{ type, hours, price, discount, voice: { label, priceLabel, savingsLabel } }],
  voicePackages: [...]
}
```

### Create booking
```
POST /api/public/bookings/bulk

Body: {
  instructorId OR instructorQuery,
  packageType: "PACKAGE_6"|"PACKAGE_10"|"PACKAGE_15"|"CUSTOM",
  hours: number,
  bookingType: "now"|"later",
  scheduledBookings: [{ date, time, duration, pickupLocation }],
  accountHolderName, accountHolderEmail, accountHolderPhone,
  accountHolderPassword: ""  // empty = auto-generated + setup link sent
}

Response (bookingType=now): {
  success: true, bookingId, checkoutUrl, isShortNotice,
  voice: { instructor, package, packageHours, firstLesson, confirmation }
}

Response (bookingType=later): {
  success: true, bookingType: "later", checkoutUrl, total
}
```

`main-app-proxy.js` reads `checkoutUrl` and SMS's it to the student after `createBooking`.

### Validate location
```
POST /api/locations/validate
Body: { address: "123 Main St Bayswater" }
Response: { valid: true, formatted, latitude, longitude, suburb, state, postcode }
```

### Check service area
```
POST /api/public/instructors/{id}/check-service-area
Body: { latitude, longitude }
Response: { inServiceArea: true|false, distance, serviceRadius }
```

### Cancel booking
```
POST /api/bookings/{id}/cancel
Headers: X-API-Key: <VOICE_SERVICE_API_KEY>
Response: { success: true, refund: { amount, percentage } }
```

### Cancellation policy
```
GET /api/bookings/{id}/cancellation-policy
Headers: X-API-Key: <VOICE_SERVICE_API_KEY>
Response: { refundPercentage, refundAmount, cutoff, message }
```

---

## Error Handling

All API responses follow:
```json
// Success
{ "success": true, ... }

// Error
{ "error": "Human-readable message", "code": "MACHINE_CODE" }
```

Key error codes the voice service handles:
- `INSTRUCTOR_INACTIVE` — instructor not accepting bookings
- `INSTRUCTOR_PAUSED` — instructor paused new bookings
- `SLOT_TAKEN` — slot conflict (try another time)
- `EMAIL_EXISTS` — account already exists (student should log in)
- `BOOKING_HOURS_EXCEED_PACKAGE` — student over-scheduled hours

---

## Idempotency

`createBooking` accepts an `Idempotency-Key` header. Twilio retries (HTTP 429 / network timeout) with the same key will return the original response without creating a duplicate booking.

```
Idempotency-Key: <callSid>-<timestamp>
```

Set this in `main-app-proxy.js` for all booking creation calls.

---

## SMS Delivery

`main-app-proxy.js` sends SMS via Twilio after `createBooking` succeeds:
- `bookingType: now` → SMS payment link (`/booking/{id}/payment?token={token}`)
- `bookingType: later` → SMS Stripe Checkout URL (`checkoutUrl`)

The student taps the link, pays, and the Stripe webhook confirms the booking.

---

## Rate Limiting

The main app applies rate limits per email+IP:
- Bulk booking: 5 requests/minute per `bulk-booking:{email}:{instructorId}`
- Availability slots: standard per-IP limits

If rate limited (HTTP 429), VAPI should tell the student to try again shortly.
