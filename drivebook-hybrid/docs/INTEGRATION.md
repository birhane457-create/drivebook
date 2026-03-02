# DriveBook Hybrid AI Voice Receptionist - Integration Blueprint

**Last Updated:** February 27, 2026  
**Status:** Ready for integration with main DriveBook platform

---

## Executive Overview

**DriveBook-Hybrid** is a specialized microservice running alongside the main DriveBook Next.js platform. It handles:
- **Incoming phone calls** from clients and instructors via Twilio integration
- **Intelligent call routing** to Copilot AI agents or voicemail
- **Real-time instructor lookups** by phone number
- **Voice booking creation** via natural language processing
- **SMS notifications** for confirmations and reminders

**Main DriveBook System**: Next.js full-stack app (MongoDB, Stripe, Google Calendar)  
**DriveBook-Hybrid**: Express.js microservice (SQLite, Twilio, Copilot Studio)

---

## DriveBook Core Architecture

### Tech Stack (Main App)
- **Backend:** Next.js 14 (API routes)
- **Database:** MongoDB Atlas (Prisma ORM)
- **Frontend:** React 18 + Tailwind CSS
- **Payments:** Stripe (with Stripe Connect for instructor payouts)
- **Authentication:** NextAuth.js (email/password)
- **Calendar:** Google Calendar API sync
- **Maps:** Google Maps API
- **Email:** Resend + Nodemailer

### Core Features
1. **Marketplace:** Multi-instructor platform with escrow payments
2. **Booking System:** Real-time availability with 15-min granularity
3. **Financial Engine:** Double-entry ledger, weekly payouts, cancellation policies
4. **Compliance:** Document verification (license, insurance, police check)
5. **Mobile App:** React Native for instructors/clients
6. **Admin Dashboard:** Full management capabilities

---

## Data Models (Key Entities)

### User
```
- id (ObjectId)
- email (unique)
- password (bcrypt)
- role: INSTRUCTOR | CLIENT | ADMIN | STAFF | SUPER_ADMIN
- resetToken, resetTokenExpiry
```

### Instructor
```
- id, userId (FK)
- name, phone (unique), bio, profileImage
- baseLatitude, baseLongitude, baseAddress
- hourlyRate, serviceRadiusKm (default 20km)
- workingHours: {monday: [{start: "09:00", end: "17:00"}], ...}
- allowedDurations: [60, 120] (minutes)
- bookingBufferMinutes: 15
- googleCalendarId, googleAccessToken, googleRefreshToken
- approvalStatus: PENDING | APPROVED | REJECTED | SUSPENDED
- subscriptionTier: BASIC | PRO | BUSINESS
- subscriptionStatus: TRIAL | ACTIVE | PAST_DUE | CANCELLED
- stripeAccountId (for payouts)
- documentsVerified: boolean
- vehicleTypes: [AUTO, MANUAL]
- languages: []
- serviceAreas: [{suburb, postcode, state}]
```

### Client
```
- id, userId (FK optional), instructorId (FK)
- name, phone, email
- addressLatitude, addressLongitude, addressText
- preferredLessonType: string
- notes: string
- relationship: "self" | "child" | "partner" | etc
```

### Booking
```
- id, instructorId (FK), clientId (FK), userId (FK)
- status: PENDING | CONFIRMED | COMPLETED | CANCELLED
- startTime, endTime, duration (hours)
- pickupLatitude, pickupLongitude, pickupAddress
- dropoffLatitude, dropoffLongitude, dropoffAddress
- price, notes, createdBy: "client" | "instructor"
- googleCalendarEventId
- checkInTime, checkInLocation, checkInPhoto (GPS verification)
- checkOutTime, checkOutLocation, checkOutPhoto
- actualDuration (minutes)
- clientShowedUp, instructorShowedUp (booleans)
- isPaid, paidAt, paymentIntentId (Stripe)
- platformFee, instructorPayout, commissionRate
- isPackageBooking, packageHours, packageExpiryDate
- outcome: "completed" | "client_no_show" | "cancelled" | etc
- isReviewed, reviews[]
```

### Transaction (Financial Ledger)
```
- id, bookingId (FK), instructorId (FK)
- type: BOOKING_PAYMENT | SUBSCRIPTION_PAYMENT | REFUND | PAYOUT | COMMISSION | PENALTY
- amount, platformFee, instructorPayout, commissionRate
- status: PENDING | COMPLETED | FAILED | REFUNDED | CANCELLED
- stripePaymentIntentId, stripeChargeId, stripeRefundId
- description, metadata (JSON)
- processedAt, failedAt, failureReason
```

---

## Payment Flow

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT BOOKS LESSON (via web/app/voice)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ CREATE PAYMENT INTENT (Stripe)                              │
│ - bookingId, instructorId, clientId, amount                 │
│ - status: PENDING                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ CLIENT CONFIRMS PAYMENT (Stripe form)                       │
│ - paymentIntentId stored in booking                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LESSON COMPLETED + CHECK-IN/CHECK-OUT VERIFIED              │
│ - Instructor captures GPS location + photo                  │
│ - System confirms no disputes                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ CAPTURE PAYMENT (Stripe)                                    │
│ - paymentCaptured = true                                    │
│ - Transaction created (BOOKING_PAYMENT)                     │
│ - platformFee calculated, instructorPayout calculated       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ WEEKLY PAYOUT CYCLE (Monday-Sunday)                         │
│ - Monday-Tuesday: Review window (no payouts)                │
│ - Tuesday evening: Automated batch transfer                 │
│ - Stripe Connect: Transfer to instructor account            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ INSTRUCTOR RECEIVES PAYOUT                                  │
│ - Bank deposit via Stripe Connect                           │
│ - Platform retains commission (12-15% depending on tier)     │
└─────────────────────────────────────────────────────────────┘
```

---

## Cancellation Policies

```
>48 hours before:    100% refund to client, 0% to instructor
24-48 hours before:   50% refund to client, 50% to instructor
<24 hours:             0% refund to client, 100% to instructor
Instructor no-show:   100% refund to client, penalty to instructor
Client no-show:       100% to instructor (no refund)
```

---

## Subscription Tiers & Pricing

| Tier | Monthly | Commission | Custom Domain | Multi-Instructor | Features |
|------|---------|------------|---------------|------------------|----------|
| **BASIC** (Trial) | Free (14 days) | 15% | ❌ | 1 | Core bookings |
| **PRO** | $29/mo | 12% | ✅ | 1 | Branded page, priority support |
| **BUSINESS** | $59/mo | 7% | ✅ | Unlimited | Full white-label, API access |

---

## Main DriveBook API Endpoints

### Authentication
```
POST   /api/auth/signin           - Email/password login
POST   /api/auth/signup           - New instructor registration
POST   /api/auth/[...nextauth]    - NextAuth routes
```

### Bookings
```
GET    /api/bookings              - List instructor's bookings (paginated)
GET    /api/bookings/[id]         - Get specific booking
POST   /api/bookings              - Create new booking (instructor)
PUT    /api/bookings/[id]         - Update booking (reschedule/cancel)
POST   /api/bookings/mobile/*     - Mobile-specific endpoints
```

### Availability
```
POST   /api/availability/check    - Check if instructor available at time
POST   /api/availability/slots    - Get available time slots for date range
GET    /api/availability/[id]     - Get instructor working hours
```

### Instructors
```
GET    /api/instructors           - Search instructors (by location, rate)
GET    /api/instructors/[id]      - Get instructor profile
PUT    /api/instructors/[id]      - Update instructor profile
POST   /api/instructor/register   - Instructor registration
```

### Clients
```
GET    /api/clients               - List instructor's clients
POST   /api/clients               - Create new client record
GET    /api/clients/[id]          - Get client details
PUT    /api/clients/[id]          - Update client info
```

### Payments
```
POST   /api/create-payment-intent - Stripe payment intent creation
POST   /api/payments/webhook      - Stripe webhook handler
GET    /api/payments/balance      - Get account balance (from ledger)
```

### Google Calendar
```
POST   /api/google-calendar/sync  - Sync instructor's calendar
POST   /api/google-calendar/auth  - OAuth redirect handler
```

### Reviews
```
POST   /api/reviews               - Submit lesson review
GET    /api/reviews/[id]          - Get reviews for instructor
```

---

## Integration Points for DriveBook-Hybrid

### 1. **Instructor Lookup by Phone**
```
REQUIREMENT: Hybrid needs to lookup instructors in DriveBook by phone number

SOLUTION:
- Hybrid maintains local SQLite cache of instructors (sync nightly)
- Cache includes: id, name, phone, hourlyRate, copilotAgentEndpoint
- Alternative: Call DriveBook API /api/instructors?phone={phone}
  (requires API key authentication)
```

### 2. **Create Booking from Voice**
```
FLOW:
1. Caller says: "I'd like to book a lesson"
2. Copilot extracts: clientName, clientPhone, preferredDate, duration
3. Hybrid calls DriveBook /api/bookings
4. DriveBook validates:
   - Instructor exists and is approved
   - Time slot available (checks working hours + existing bookings)
   - Client is not duplicate
5. Returns: bookingId, confirmationCode, payment status
```

### 3. **Check Availability**
```
REQUIREMENT: Hybrid needs to check if instructor is available at time

ENDPOINT CALLS:
- /api/availability/check?instructorId={id}&startTime={iso}&endTime={iso}
- /api/availability/slots?instructorId={id}&date={YYYY-MM-DD}
- Returns: available time slots in 15-minute increments
```

### 4. **Send SMS Confirmations**
```
REQUIREMENT: After booking, notify client via SMS

INTEGRATION:
- Hybrid uses Twilio to send SMS (already in drivebook-hybrid)
- SMS includes: bookingId, instructor name, date/time, amount, cancellation link
- Add callback webhook so DriveBook knows SMS was delivered
```

### 5. **Voice-to-Payment**
```
FLOW:
1. Caller says: "Confirm and pay for this booking"
2. Hybrid calls: POST /api/create-payment-intent
3. DriveBook returns: paymentIntentId, clientSecret
4. Hybrid guides caller to payment link (SMS or voice)
5. After successful payment, booking status → CONFIRMED
```

---

## Database Sync Strategy

### DriveBook-Hybrid SQLite Schema
```sql
-- Cached from DriveBook
CREATE TABLE instructors (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT UNIQUE,
  hourlyRate FLOAT,
  copilotAgentEndpoint TEXT,  -- Where to route calls
  serviceRadiusKm INT DEFAULT 20,
  approvalStatus TEXT,        -- PENDING|APPROVED|REJECTED
  subscriptionStatus TEXT,    -- TRIAL|ACTIVE|CANCELLED
  workingHours TEXT,          -- JSON
  baseLatitude FLOAT,
  baseLongitude FLOAT,
  baseAddress TEXT,
  updatedAt TIMESTAMP
);

-- Local voice messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  callerNumber TEXT,
  callerName TEXT,
  message TEXT,
  voicemailUrl TEXT,          -- Twilio recording URL
  created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'new'
);

-- Sync log
CREATE TABLE sync_log (
  id TEXT PRIMARY KEY,
  entity TEXT,  -- 'instructor', 'booking'
  lastSyncAt TIMESTAMP,
  recordCount INT
);
```

### Sync Process
```
FREQUENCY: Every 6 hours (or on-demand)

1. Hybrid calls: GET /api/instructors?updatedAfter={lastSyncTime}
2. DriveBook returns changed instructor records
3. Hybrid upserts into local SQLite
4. Update sync_log with timestamp and count

ALTERNATIVE: WebSocket or Server-Sent Events for real-time sync
```

---

## Copilot Studio Integration

### Agent Configuration
```
COPILOT AGENT FLOW:

1. Incoming Call → Twilio webhook (drivebook-hybrid /api/voice/incoming)
2. Extract: From (caller phone), To (instructor phone)
3. Lookup instructor in local cache
4. If found and available:
   - Route to Copilot agent at: {copilotAgentEndpoint}
   - Agent receives: callerPhone, instructorId, callerName
   - Agent conversation handles:
     a) Identity verification
     b) Lesson details (date, time, location)
     c) Payment confirmation
     d) Booking creation (calls DriveBook API)
5. If not available or agent timeout:
   - Fallback to voicemail
```

### Copilot Response Format
```json
{
  "type": "dial",      // or "say", "voicemail"
  "number": "+14155552671",  // For dial type
  "text": "Please wait while we connect you...",  // For say type
  "agentId": "uuid",
  "sessionId": "uuid",
  "transcript": "conversation log"
}
```

---

## Security & Authentication

### API Authentication (Hybrid → DriveBook)
```
Required for Hybrid to call DriveBook APIs:

1. API Key: Store in .env (DRIVEBOOK_API_KEY)
2. Header: X-API-Key: {DRIVEBOOK_API_KEY}
3. Scope: hybrid:bookings, hybrid:availability, hybrid:instructors

DriveBook creates special "hybrid-service" user with limited permissions
```

### Phone Number Privacy
```
REQUIREMENT: Protect caller phone numbers

IMPLEMENTATION in Logger:
- Mask phone numbers in logs: +61 4** *** ***
- Never log full phone in plaintext
- Store only hashed representation in audit log
- Comply with Australian Privacy Act
```

### Rate Limiting
```
TWILIO WEBHOOK:
- 100 requests/minute per instructor phone number
- 1000 requests/minute globally
- Return 429 with Retry-After header

BOOKING CREATION:
- 10 bookings/minute per instructor
- 100 voismails/hour per instructor
```

---

## Error Handling & Fallbacks

### Scenario: DriveBook API Down
```
1. Hybrid falls back to local SQLite cache
2. Can still list instructors, but cannot create bookings
3. Log error and alert admin
4. Voicemail request stored in local DB
5. Retry job every 5 minutes
```

### Scenario: Instructor Not Found
```
1. Return TwiML saying "Instructor not found"
2. Prompt: "Leave a message and we'll notify them"
3. Store voicemail with unknown instructorId
4. Admin reviews unhandled voicemails daily
```

### Scenario: Copilot Agent Timeout
```
1. 5-second timeout on Copilot HTTP request
2. Fall through to voicemail option
3. Log timeout incident
4. Alert ops if >10% timeout rate
```

---

## Monitoring & Observability

### Key Metrics to Track
```
1. Call Volume: calls/hour, calls/day, calls/week
2. Conversion: calls → bookings (target: >20%)
3. Error Rate: failed calls, voicemail fallbacks
4. Latency: avg response time (target: <2s)
5. Copilot Performance: agent success rate, timeout rate
6. SMS Delivery: sent vs delivered vs failed
7. Booking Success: payment success rate, cancellation rate
```

### Logging Strategy
```
DEVELOPMENT: Console JSON logs
PRODUCTION: Write to file + cloud logger (e.g., Papertrail)

LOG LEVELS: info, warn, error, debug
LOG FIELDS: timestamp, level, requestId, instructorId (masked phone), message
```

### Health Checks
```
GET /api/health
{
  "status": "ok",
  "uptime": 3600.5,
  "database": "connected",
  "twilio": "configured",
  "lastSyncAt": "2026-02-27T15:30:00Z",
  "cachedInstructors": 127
}
```

---

## Deployment Strategy

### Environment Variables
```
# DriveBook integration
DRIVEBOOK_BASE_URL=https://drivebook.com
DRIVEBOOK_API_KEY=sk_hybrid_xxxxx

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_NUMBER=+14155552671

# Copilot Studio
COPILOT_BASE_URL=https://copilot.studio.Microsoft

# Database
DATABASE_URL=file:./dev.db  (SQLite for hybrid service)

# Logging
LOG_LEVEL=info
SENTRY_DSN=https://xxxxx@sentry.io/proj

# Stripe (for payment-related features)
STRIPE_SECRET_KEY=sk_xxxxx
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "start"]
```

---

## Testing Checklist

- [ ] Incoming call routes to correct instructor
- [ ] Copilot agent receives caller data correctly
- [ ] Booking creation succeeds end-to-end
- [ ] SMS confirmation sent within 10 seconds
- [ ] Payment intent created and captured
- [ ] Voicemail fallback works when agent unavailable
- [ ] Instructor lookup returns correct data
- [ ] Rate limiting blocks spam attempts
- [ ] Error scenarios don't crash service
- [ ] Database sync recovers from failures
- [ ] Phone numbers masked in logs
- [ ] RequestId propagates through log chain
- [ ] Health endpoint reports accurate status

---

## Next Steps

1. **Deploy Hybrid microservice** to production server
2. **Configure Twilio** phone number routing
3. **Set up Copilot Studio** agents for each instructor
4. **Establish API authentication** with DriveBook
5. **Run full system test** (end-to-end: call → booking → payment)
6. **Enable SMS notifications**
7. **Set up monitoring & alerts**
8. **Train instructors** on voice booking workflow
9. **Soft launch** with beta users
10. **Monitor metrics** and iterate

---

## Summary

**DriveBook-Hybrid** is a **Twilio-powered voice microservice** that extends DriveBook's booking capabilities to phone calls. It:

✅ Routes incoming calls to instructors via Copilot AI  
✅ Creates bookings via voice commands  
✅ Manages voicemail fallbacks  
✅ Sends SMS confirmations  
✅ Integrates with DriveBook's financial system via REST APIs  
✅ Caches instructor data locally for resilience  
✅ Logs securely with phone number masking  
✅ Scales horizontally in Docker containers  

This document serves as the **integration blueprint** for connecting Hybrid to the main DriveBook platform.
