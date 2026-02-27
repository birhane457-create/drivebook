# DriveBook Hybrid System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DriveBook Ecosystem                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐     ┌──────────────────┐   ┌─────────────────┐   │
│  │   Clients        │     │   Instructors    │   │   Admin Portal  │   │
│  │  (Web/Mobile)    │     │   (Mobile/Web)   │   │   (Dashboard)   │   │
│  └────────┬─────────┘     └────────┬─────────┘   └────────┬────────┘   │
│           │                        │                      │             │
│           └────────────────────────┼──────────────────────┘             │
│                                    │                                     │
│                    ┌───────────────────────────────┐                     │
│                    │   DriveBook Main (Next.js)   │                     │
│                    │   - Booking API              │                     │
│                    │   - Availability API         │                     │
│                    │   - Payment Processing       │                     │
│                    │   - User Management          │                     │
│                    │   - Calendar Sync            │                     │
│                    └───────────┬───────────────────┘                     │
│                                │                                         │
│              ┌─────────────────┴─────────────────┐                       │
│              │                                   │                       │
│    ┌─────────────────────┐         ┌─────────────────────┐              │
│    │  MongoDB (Main DB)  │         │  Stripe (Payments)  │              │
│    │  - Users            │         │  - Payment Intents  │              │
│    │  - Bookings         │         │  - Transfers        │              │
│    │  - Instructors      │         │  - Webhook Events   │              │
│    │  - Transactions     │         │  - Refunds          │              │
│    │  - Clients          │         └─────────────────────┘              │
│    └─────────────────────┘                                              │
│                                                                          │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
    ┌───────────────────────────┐   ┌─────────────────────┐
    │  DriveBook-Hybrid (REST)  │   │  Twilio            │
    │  - Voice Webhook Handler  │◄──┤  - Incoming Calls  │
    │  - Availability Sync      │   │  - SMS Service     │
    │  - Message Storage        │   │  - Recordings      │
    │  - Instructor Cache       │   └─────────────────────┘
    └────────┬──────────────────┘
             │
    ┌────────────────────────────┐
    │  SQLite (Hybrid Cache)     │
    │  - Instructor replica      │
    │  - Voicemails             │
    │  - Sync logs              │
    └────────────────────────────┘
                │
    ┌───────────────────────────┐
    │  Copilot Studio Agent     │
    │  - Call handling          │
    │  - Booking dialog         │
    │  - Payment confirmation   │
    │  - Natural language input │
    └───────────────────────────┘
```

---

## Call Flow: Voice → Booking → Payment

```
STEP 1: Incoming Call
───────────────────────────────────────────
  Caller               Twilio                Hybrid
     │                   │                     │
     ├──[Call]──────────►│                     │
     │                   ├─[Webhook POST]────►│
     │                   │   /api/voice/incoming
     │                   │   {From, To}        │
     │                   │                ◄────┤ Parse caller/instructor
     │                   │                ◄────┤ Lookup instructor
     │                   │                ◄────┤ Check availability
     │                   │◄─[TwiML]───────┤   
     │                   │   <Connect>        │
     │                   │   <Copilot>        │


STEP 2: Copilot Agent Conversation
───────────────────────────────────────────
  Caller           Copilot Agent          Hybrid
     │                   │                   │
     ├──[Voice]─────────►│                   │
     │   "Book lesson"   │                   │
     │                   ├──[HTTP]──────────►│
     │                   │   POST /availability/check
     │                   │   instructorId, date, time
     │                   │   ◄────────────────┤ Query slots
     │                   │◄[Available slots]──┤
     │◄──[Say]───────────┤                   │
     │   "Morning slots" │                   │
     │                   │                   │
     ├──[Voice]─────────►│                   │
     │   "9am, tuesday"  │                   │
     │                   ├──[HTTP]──────────►│
     │                   │   POST /bookings
     │                   │   {instructorId, clientName,
     │                   │    date, time, duration, phone}
     │                   │   ◄────────────────┤ Create booking
     │                   │◄[Booking Created]──┤ {bookingId}
     │◄──[Say]───────────┤                   │
     │   "Booked!"       │                   │
     │   "Text confirm"  │                   │
     │                   │                   ├─[SMS]─► Caller
     │                   │                   │  "Your booking #123"
     │                   │                   │  Payment link


STEP 3: Payment Processing
───────────────────────────────────────────
  Caller              Hybrid             DriveBook/Stripe
     │                 │                      │
     ├─[SMS]──────────►│                      │
     │  Payment link   │                      │
     │                 ├─[HTTP]──────────────►│
     │                 │ POST /create-payment-intent
     │                 │ {bookingId, amount}
     │                 │ ◄──────────────────┤ paymentIntentId
     │                 │ ◄──────────────────┤ clientSecret
     │                 │                     │
     ├─[Open link]───►Stripe Hosted Form     │
     │  (Checkout)    │                      │
     │                │                      │
     ├─[Card info]───►│                      │
     │                ├──[Confirm]───────────►│
     │                │                  [Verify]
     │                │◄─[Payment Success]────┤
     │◄─[Confirm]─────┤                      │
     │                │                      │
     │                │  ◄─[Webhook]─────────┤
     │                │  payment_intent.succeeded


STEP 4: Instructor Notification
───────────────────────────────────────────
  Hybrid          Instructor App        Instructor
    │                 │                    │
    ├─[Update]──────►DriveBook             │
    │  Booking:      Dashboard             │
    │  status=CONFIRMED
    │  isPaid=true
    │                 ├─[Realtime]────────►│
    │                 │  Notification:     │
    │                 │  "New booking"     │
    │                 │  Date: Tue 9am     │
    │                 │  Client: John      │
    │                 │  Amount: $60       │
    │                 │                    │
    │                 │ ◄─[Accept]────────┤
    │                 │  (auto if enabled)
    │
    ├─[SMS]──────────────────────────────►│
    │ "Lesson confirmed - Tue 9am"
```

---

## Data Flow: Sync & Cache Management

```
Every 6 Hours or On-Demand
───────────────────────────────────────────

  Hybrid              DriveBook          MongoDB
    │                    │                  │
    ├─[HTTP GET]────────►│                  │
    │ /api/instructors   │                  │
    │ ?updatedAfter=..   │                  │
    │                    ├─[Query]─────────►│
    │                    │ Select instructors
    │                    │ where updatedAt > time
    │                    │ ◄─[Result set]────┤
    │◄─[JSON]────────────┤                  │
    │ [{id, name, phone,
    │   hourlyRate,
    │   approvalStatus,
    │   subscriptionStatus,
    │   workingHours,
    │   serviceRadius}]
    │
    ├─[Upsert]──────────►SQLite             │
    │  instructor cache   │                  │
    │  (107 records)      │                  │
    │
    ├─[Insert]──────────►SQLite             │
    │  sync_log           │                  │
    │  {timestamp, count}
```

---

## Component Details

### DriveBook Main (Next.js)
**Responsibilities:**
- RESTful API for all business logic
- MongoDB ORM through Prisma
- Stripe payment processing
- Google Calendar integration
- User authentication (NextAuth)
- Admin dashboard
- Mobile app backend

**Key Routes:**
```
/api/bookings              - Booking CRUD
/api/instructors           - Instructor search
/api/availability/check    - Slot availability
/api/create-payment-intent - Stripe payment
/api/reviews               - Client feedback
/api/stripe/webhook        - Payment webhooks
```

### DriveBook-Hybrid (Express.js)
**Responsibilities:**
- Twilio webhook handler
- Copilot Studio connector
- Local instructor cache (SQLite)
- Voicemail storage
- SMS notifications
- Request routing to DriveBook APIs

**Key Routes:**
```
POST /api/voice/incoming   - Twilio incoming call
POST /api/voice/voicemail  - Record voicemail
GET  /api/health           - Health check
POST /sync/instructors     - Refresh cache (internal)
```

### Copilot Studio
**Responsibilities:**
- Natural language understanding
- Call conversation flow
- Booking intent extraction
- Error handling & fallbacks
- Voice synthesis & audio playback

**Inputs from Hybrid:**
```
{
  "callerPhone": "+61400000000",
  "instructorId": "uuid",
  "instructorName": "John Smith",
  "availableSlots": [
    {"date": "2026-03-01", "time": "09:00"},
    {"date": "2026-03-01", "time": "14:00"}
  ]
}
```

### SQLite Cache (Hybrid)
**Purpose:** Local replica of instructor data for resilience

**Schema:**
```sql
instructors
├─ id (PK)
├─ name
├─ phone (UNIQUE)
├─ hourlyRate
├─ serviceRadiusKm
├─ approvalStatus
├─ subscriptionStatus
├─ workingHours (JSON)
├─ baseLatitude
├─ baseLongitude
├─ copilotAgentEndpoint
└─ updatedAt (INDEX)

messages
├─ id (PK)
├─ callerNumber
├─ callerName
├─ message
├─ voicemailUrl
├─ status
└─ createdAt

sync_log
├─ id (PK)
├─ entity
├─ lastSyncAt
└─ recordCount
```

---

## Error Handling Strategy

```
SCENARIO: DriveBook API Unavailable
──────────────────────────────────────┐
                                       ▼
  Hybrid Cache Hit?
  ├─ YES: Use local SQLite data
  │       ├─ Try to create booking (will fail)
  │       └─ Store in local queue for retry
  │
  └─ NO: Return voicemail prompt
         └─ "Instructor unavailable, leave message"


SCENARIO: Copilot Agent Timeout (>5s)
──────────────────────────────────────┐
                                       ▼
  Return TwiML with fallback:
  "Sorry, our agent is busy.
   Please try again or leave a message"


SCENARIO: Payment Intent Fails
──────────────────────────────────────┐
                                       ▼
  Booking created but unpaid:
  - status = PENDING
  - isPaid = false
  - SMS reminder in 6 hours
  - Auto-cancel if unpaid after 24h


SCENARIO: Instructor Not Found
──────────────────────────────────────┐
                                       ▼
  Return: "We couldn't find that instructor.
           Would you like to leave a message?"
  - Store voicemail with unknown instructorId
  - Admin reviews in morning report
```

---

## Security Model

```
┌─────────────────────────────────────────┐
│  Caller & Instructor Data               │
├─────────────────────────────────────────┤
│  Phone numbers: Hashed or masked in logs│
│  Voice recordings: Encrypted in transit │
│  Payment info: Never logged (PCI-DSS)   │
│  Timing: HTTPS only, no HTTP fallback   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  API Secrets                            │
├─────────────────────────────────────────┤
│  Hybrid ← DriveBook: API Key in header  │
│  Hybrid ← Twilio: Account SID + Token   │
│  Hybrid ← Stripe: Secret Key (never    │
│           in frontend)                  │
│  All stored in .env, never in git       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Request Authentication                 │
├─────────────────────────────────────────┤
│  Twilio ─X─ DriveBook (direct)         │
│           (use Twilio signing)         │
│                                         │
│  Twilio ──► Hybrid                     │
│           (validate X-Twilio-Signature)│
│                                         │
│  Hybrid ──► DriveBook                  │
│           (X-API-Key header)           │
└─────────────────────────────────────────┘
```

---

## Deployment Topology

```
┌─────────────────────────────────────────┐
│         Production AWS                   │
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  EC2 or ECS Cluster              │   │
│  │  drivebook-hybrid container      │   │
│  │  - Node.js 18                    │   │
│  │  - Port 3000                     │   │
│  │  - 2+ replicas (HA)              │   │
│  └──┬───────────────────────────────┘   │
│     │                                    │
│  ┌──┴────────────────────────────────┐  │
│  │  Load Balancer (ALB)              │  │
│  │  - HTTPS termination              │  │
│  │  - Route /api/voice → Hybrid       │  │
│  │  - Route /* → DriveBook            │  │
│  └──┬───────────────────────────────┘   │
│     │                                    │
│  ┌──┴────────────────────────────────┐  │
│  │  EBS Volume                       │  │
│  │  - SQLite database (shared mount) │  │
│  │  - Backups: daily to S3           │  │
│  └──────────────────────────────────┘   │
│                                          │
│  Secrets Manager:                        │
│  - DRIVEBOOK_API_KEY                    │
│  - TWILIO_ACCOUNT_SID                   │
│  - TWILIO_AUTH_TOKEN                    │
│  - STRIPE_SECRET_KEY                    │
│                                          │
└─────────────────────────────────────────┘
        │                      │
        │                      │
    ┌───┴──────────┐       ┌───┴──────────┐
    │ Twilio       │       │ CloudWatch   │
    │ ├─ Webhooks  │       │ ├─ Metrics   │
    │ ├─ SMS API   │       │ ├─ Logs      │
    │ └─ Recording │       │ └─ Alarms    │
    │    Storage   │       └──────────────┘
    └──────────────┘
```

---

## Monitoring Dashboard

Key metrics visible in real-time:

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Call Volume (per hour) | 100-500 | > 1000 |
| Copilot Success Rate | >95% | < 85% |
| Booking Completion Rate | >20% | < 10% |
| Payment Success Rate | >98% | < 95% |
| API Latency (p95) | <500ms | > 2000ms |
| Cache Hit Rate | >90% | < 75% |
| SMS Delivery Rate | >99% | < 98% |
| Database Sync Success | 100% | 1 failure |

---

## Summary

DriveBook-Hybrid operates as a **specialized microservice** that:

1. **Listens** for incoming Twilio calls
2. **Routes** to Copilot AI agents for conversation
3. **Queries** DriveBook APIs for availability & booking
4. **Caches** instructor data locally for resilience
5. **Triggers** SMS confirmations
6. **Logs** all interactions securely
7. **Falls back** to voicemail when agents unavailable
8. **Syncs** with DriveBook every 6 hours

The system is **stateless** (can scale horizontally), **resilient** (local cache), and **secure** (encrypted, masked PII, API keys).
