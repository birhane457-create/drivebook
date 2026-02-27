# DriveBook-Hybrid: Quick Reference Card

## What is It?
An Express.js microservice that handles incoming phone calls and converts them to bookings via AI (Copilot Studio) + Twilio integration.

## Tech Stack
- **Backend:** Node.js/Express
- **Local DB:** SQLite (instructor cache, messages)
- **Remote DB:** MongoDB (user data, bookings, payments)
- **Telephony:** Twilio (calls, SMS, recordings)
- **AI:** Copilot Studio (conversation)
- **Payments:** Stripe
- **Deployment:** Docker + AWS ECS

## Core Workflow
```
Incoming Call
    ↓
Extract From/To phone numbers
    ↓
Lookup instructor by phone
    ↓
Route to Copilot Agent
    ↓
Agent asks: date, time, duration, pickup location
    ↓
Check availability (call DriveBook API)
    ↓
Create booking (POST /api/bookings)
    ↓
Create payment intent (Stripe)
    ↓
Send SMS confirmation
    ↓
Voicemail fallback if unavailable
```

## Key Files & Their Purpose

| File | Purpose |
|------|---------|
| `server.js` | Express app, middleware, error handling |
| `routes/voice-webhook.js` | Twilio incoming call handler |
| `routes/booking-api.js` | REST endpoint for creating bookings |
| `routes/instructor-api.js` | Lookup instructor by phone |
| `services/drivebook-api-client.js` | **HTTP client for calling main DriveBook APIs** |
| `services/instructor-service.js` | Find instructor (API + local cache) |
| `services/copilot-service.js` | Connect to Copilot agent (HTTP calls) |
| `services/message-service.js` | Store voicemails, rate limiting |
| `services/sms-service.js` | Send SMS via Twilio |
| `services/database-service.js` | Prisma client for SQLite |
| `utils/validators.js` | Zod schemas for phone/date/time |
| `utils/logger.js` | Logging with phone masking |
| `utils/config.js` | Environment config loader |
| `tests/voice.test.js` | Jest tests for voice endpoint |
| `tests/booking.test.js` | Jest tests for booking creation |
| `prisma/schema.prisma` | SQLite schema |

## API Endpoints (What Hybrid Exposes)

```
POST /api/voice/incoming
  Input: {From: "+61400000000", To: "+61411111111"}
  Output: TwiML (dial Copilot or record voicemail)

POST /api/voice/voicemail
  Input: {RecordingUrl: "...", From: "+61400000000"}
  Output: TwiML (confirmation)

GET /api/health
  Output: {status: "ok", uptime: 123.4, database: "connected"}
```

## API Endpoints (What Hybrid Calls)

```
DriveBook Main Platform:
├─ GET /api/instructors?phone={phone}
├─ GET /api/availability/slots?instructorId={id}&date={date}
├─ POST /api/bookings {instructorId, clientId, startTime, endTime, price}
├─ POST /api/create-payment-intent {bookingId, amount}
└─ POST /api/notifications/sms {to, message}

Twilio:
├─ Incoming webhook (automatic)
└─ SMS API (sendMessage)

Copilot Studio:
└─ Calls agent endpoint HTTP (POST with caller data)
```

## Data Models

### Instructor (cached in SQLite)
```
├─ id, phone (UNIQUE), name, hourlyRate
├─ approvalStatus (PENDING|APPROVED|REJECTED)
├─ subscriptionStatus (TRIAL|ACTIVE|CANCELLED)
├─ copilotAgentEndpoint (HTTP URL)
├─ serviceRadiusKm, baseLatitude, baseLongitude
└─ updatedAt
```

### Booking (created in DriveBook MongoDB)
```
├─ id, instructorId, clientId, userId
├─ startTime, endTime, duration, price
├─ status (PENDING|CONFIRMED|COMPLETED|CANCELLED)
├─ pickupAddress, dropoffAddress
├─ isPaid, paymentIntentId
├─ platformFee, instructorPayout
└─ createdBy: "voice"
```

### Message (voicemail in SQLite)
```
├─ id, callerNumber, callerName
├─ message (transcript or URL)
├─ status (new|reviewed|resolved)
└─ createdAt
```

## Environment Variables Required

```
# DriveBook Integration
DRIVEBOOK_BASE_URL=http://localhost:3001
DRIVEBOOK_API_KEY=sk_hybrid_xxxxx

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_NUMBER=+14155552671

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx

# Database
DATABASE_URL=file:./dev.db

# Copilot
COPILOT_BASE_URL=https://copilot.studio.microsoft.com

# Server
NODE_ENV=production
PORT=3000
```

## How Hybrid Gets Instructor Data

```
REQUEST: findInstructorByPhone("+61434123456")

STEP 1: Validate phone format with Zod
  ✓ +61434123456 is valid
  ✗ "badphone" is invalid

STEP 2: Try DriveBook API
  Call: GET /api/instructors?phone=+61434123456
  Success? → Cache locally + return
  Fail? → Continue to step 3

STEP 3: Fall back to SQLite cache
  Query: instructors WHERE phone = "+61434123456"
  Result? → Return with fromCache: true
  Not found? → Return null

STEP 4: Return to caller
  Hybrid: Instructor found ✓
  Hybrid: Instructor not found ✗
```

## Payment Flow

```
CLIENT BOOKS LESSON

Hybrid creates booking:
  POST /api/bookings
  ├─ instructorId
  ├─ clientId
  ├─ startTime, endTime
  └─ price: $70

Hybrid requests payment intent:
  POST /api/create-payment-intent
  ├─ bookingId
  ├─ amount: 70
  ↓
  ← paymentIntentId, clientSecret

Hybrid sends SMS with payment link:
  POST /api/notifications/sms
  ├─ to: "+61425551234"
  ├─ message: "Pay here: https://stripe.com/pay?intent=..."

Client clicks link & pays via Stripe

Stripe webhook fires:
  → DriveBook captures payment
  → Updates booking: isPaid = true
  → Creates Transaction record

Instructor receives notification:
  ← "New booking confirmed - $70"
```

## Error Handling

| Scenario | Response |
|----------|----------|
| **Instructor not found** | Say "Instructor unavailable, leave message" |
| **No availability** | Voicemail: check back later |
| **Copilot timeout (>5s)** | Fallback to voicemail |
| **DriveBook API down** | Use SQLite cache, queue retry |
| **Payment fails** | Booking created but unpaid, send reminder SMS |
| **SMS fails** | Retry up to 2 times |

## Testing Checklist

```
✓ Incoming call parses From/To correctly
✓ Instructor lookup returns correct data
✓ Availability check blocks conflicting slots
✓ Booking creation succeeds end-to-end
✓ Payment intent generated with correct amount
✓ SMS sent within 10 seconds
✓ Voicemail fallback works
✓ Error doesn't crash service
✓ RequestId propagates through logs
✓ Phone numbers masked in logs
✓ Database sync completes successfully
✓ Health endpoint returns accurate status
```

## Running Locally

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Initialize database
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Start dev server (with auto-reload)
npm run dev

# Or production
npm run build
npm start

# Run tests
npm test

# Check health
curl http://localhost:3000/api/health
```

## Production Deployment

```bash
# Build Docker image
docker build -t drivebook-hybrid:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e DRIVEBOOK_API_KEY=$DRIVEBOOK_API_KEY \
  -e TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID \
  -e TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN \
  -e STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY \
  -v /data/hybrid.db:/app/dev.db \
  drivebook-hybrid:latest

# Or use AWS ECS with CloudFormation
# See DEPLOYMENT.md for details
```

## Key Metrics to Monitor

| Metric | Target | Alert |
|--------|--------|-------|
| Calls/hour | 100-500 | >1000 |
| Booking conversion | >20% | <10% |
| API latency (p95) | <500ms | >2000ms |
| Error rate | <0.5% | >5% |
| Copilot success | >95% | <85% |
| SMS delivery | >99% | <98% |
| Cache hit rate | >85% | <75% |
| Uptime | 99.9% | <99% |

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Phone not found" | Instructor not approved | Approve in DriveBook admin |
| Calls disconnecting | Agent timeout (>5s) | Check Copilot server logs |
| SMS not sending | Invalid phone format | Validate Australian format (+61) |
| Slow booking creation | DriveBook API slow | Check MongoDB connection |
| High error rate | Cache out of sync | Run `/sync/instructors` manually |
| Disk full | SQLite database grew | Delete old messages, backup to S3 |

## Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview |
| `INTEGRATION_GUIDE.md` | How to integrate with DriveBook |
| `ARCHITECTURE.md` | System design & data flows |
| `AI_SYSTEM_GUIDE.md` | AI role & functionality |
| `QUICK_REFERENCE.md` | This file |

## Links

- **DriveBook Main:** http://localhost:3001 (dev)
- **Copilot Studio:** https://copilotstudio.microsoft.com
- **Twilio Console:** https://www.twilio.com/console
- **Stripe Dashboard:** https://dashboard.stripe.com
- **AWS Console:** https://console.aws.amazon.com

## Support

- Check logs: `npm run dev` (development)
- Run tests: `npm test`
- Database studio: `npm run db:studio`
- API docs: http://localhost:3000/api/health (status only, full docs in INTEGRATION_GUIDE.md)

---

**Version:** 1.0.0  
**Last Updated:** February 27, 2026  
**Status:** Production Ready
