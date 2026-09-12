# DriveBook Hybrid — Architecture

**Last Updated:** July 2026  
**Status:** Production

---

## System Overview

DriveBook is a two-service architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    DriveBook (Vercel)                    │
│  Next.js app — bookings, payments, dashboards, admin     │
│  PostgreSQL (Neon) · Prisma · NextAuth · Stripe          │
└────────────────────┬────────────────────────────────────┘
                     │ REST API + webhooks
                     │
┌────────────────────┴────────────────────────────────────┐
│              drivebook-hybrid (Railway)                  │
│  Node.js/Express — voice AI receptionist                 │
│  VAPI voice AI · Twilio SMS · main-app-proxy             │
└────────────────────────────────────────────────────────┘
```

---

## Voice AI Flow

```
Student calls instructor's AI line
        ↓
Twilio routes to VAPI webhook
        ↓
VAPI assistant runs conversation (see VAPI_SYSTEM_PROMPT.md)
        ↓
VAPI calls tools via main-app-proxy.js:
  ├── findInstructors (GET /api/instructors/recommendations)
  ├── getAvailableSlots (GET /api/availability/slots)
  ├── getPackages (GET /api/packages)
  ├── createBooking (POST /api/public/bookings/bulk)
  ├── validateLocation (POST /api/locations/validate)
  └── checkServiceArea (POST /api/public/instructors/{id}/check-service-area)
        ↓
createBooking creates user account + booking in DB
        ↓
main-app-proxy.js SMS's payment link to student
        ↓
Student taps link → pays → webhook confirms booking
```

---

## Components

### main-app-proxy.js
The core of the hybrid service. Runs an Express server that:
- Receives VAPI tool calls (HTTP POST from VAPI)
- Proxies them to the main DriveBook API
- Handles SMS delivery via Twilio after booking creation
- Manages voice session recovery (Redis)

### VAPI System Prompt (`VAPI_SYSTEM_PROMPT.md`)
Defines the AI assistant's conversation flow, tool contracts, and error handling scripts. Built with `scripts/build-vapi-prompt.js` from source + env vars.

### voice-session-service.js
Redis-backed session recovery. If a call drops mid-booking, the student can call back and resume.

---

## Deployment

**Service:** Railway  
**URL:** `https://voice.drivebook.com.au`  
**Build:** Node 18, `npm start`  
**ENV required:** See `.env.voice-service.example`

Key env vars:
```
VAPI_API_KEY          — VAPI dashboard key
VAPI_PHONE_NUMBER     — Assigned VAPI number
MAIN_APP_URL          — https://drivebook.com.au
VOICE_SERVICE_API_KEY — Auth token for /api/* calls
TWILIO_ACCOUNT_SID    — Twilio credentials
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
UPSTASH_REDIS_REST_URL      — Session recovery
UPSTASH_REDIS_REST_TOKEN
```

---

## Database

**No local database.** The hybrid service is stateless:
- All booking/availability data → main DriveBook PostgreSQL via API
- Session recovery → Upstash Redis (ephemeral, 1h TTL)
- No SQLite, no MongoDB, no local cache

---

## Auth

The hybrid service calls the main app with `X-API-Key: VOICE_SERVICE_API_KEY` on protected routes. Public booking routes (`/api/public/*`) need no auth.

---

## Related Files

| File | Purpose |
|------|---------|
| `routes/main-app-proxy.js` | VAPI tool handler + SMS dispatch |
| `services/voice-session-service.js` | Redis session recovery |
| `VAPI_SYSTEM_PROMPT.md` | AI conversation script |
| `scripts/build-vapi-prompt.js` | Builds prompt from source + env |
| `.env.voice-service.example` | All required environment variables |
