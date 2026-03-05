# AI Voice Receptionist System

## Overview

The DriveBook AI Voice Receptionist is an intelligent phone system that allows clients to book driving lessons through natural voice conversations. Built as a microservice (drivebook-hybrid), it integrates Twilio telephony with Microsoft Copilot Studio AI agents to provide a seamless booking experience over the phone.

## System Architecture

```
┌─────────────────┐
│  Client Calls   │
│ Twilio Number   │
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│   Twilio Platform        │
│   - Receives call        │
│   - Sends webhook        │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Voice Service           │
│  (drivebook-hybrid)      │
│  ┌────────────────────┐  │
│  │ 1. Parse caller    │  │
│  │ 2. Lookup instructor│ │
│  │ 3. Connect to AI   │  │
│  │ 4. Process booking │  │
│  │ 5. Send SMS        │  │
│  └────────────────────┘  │
└────────┬─────────────────┘
         │
         ├──────────────┬──────────────┐
         ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│ Copilot AI   │ │ DriveBook│ │ Stripe       │
│ Agent        │ │ Platform │ │ Payments     │
└──────────────┘ └──────────┘ └──────────────┘
```

## Key Components

### 1. Voice Service (Express.js Microservice)

**Location**: `drivebook/drivebook-hybrid/`

**Purpose**: Handles incoming phone calls and orchestrates the booking process

**Core Files**:
- `server.js` - Express app with middleware and routing
- `routes/voice-webhook.js` - Twilio webhook handler
- `routes/booking-api.js` - REST booking endpoint
- `routes/instructor-api.js` - Instructor lookup

**Key Features**:
- Twilio signature validation for security
- Request timeout handling (configurable)
- Structured JSON logging
- CORS and helmet security middleware
- Request ID tracking for debugging
- Graceful shutdown with database cleanup
- Health check with database verification

### 2. Service Layer

**Location**: `drivebook/drivebook-hybrid/services/`

**Services**:

- `copilot-service.js` - Microsoft Copilot Studio AI agent integration
- `instructor-service.js` - Instructor lookup and availability checking
- `message-service.js` - Voicemail and message handling
- `sms-service.js` - SMS notifications via Twilio
- `twilio-service.js` - Twilio API wrapper
- `drivebook-api-client.js` - Main platform API client
- `database-service.js` - Direct database operations

### 3. Twilio Integration

**Phone Number Setup**:
- Each instructor gets a dedicated Twilio phone number
- Numbers are stored in the database linked to instructor records
- Incoming calls to these numbers trigger the voice webhook

**Call Flow**:
1. Client calls instructor's Twilio number
2. Twilio sends webhook to `/api/voice/incoming`
3. System validates Twilio signature
4. Looks up instructor by called number
5. Connects to Copilot AI agent
6. AI handles conversation and booking
7. Falls back to voicemail if unavailable

**Security**:
- Twilio signature validation on all webhooks
- Can be disabled in development with `SKIP_TWILIO_VALIDATION=true`
- HTTPS required in production

### 4. Microsoft Copilot Studio Integration

**Purpose**: Provides natural language understanding and conversation management

**Integration Points**:
- Copilot agent receives call context (instructor ID, caller phone)
- Agent uses OpenAPI spec to call booking endpoints
- Agent can query instructor availability
- Agent creates bookings through REST API

**Configuration**:
- Copilot agent URL configured via environment variables
- OpenAPI spec at `drivebook-hybrid/openapi.yaml`
- Agent has access to three main endpoints:
  - `GET /api/instructor/lookup` - Find instructor details
  - `POST /api/bookings` - Create booking
  - `GET /api/health` - System health check

## API Endpoints

### Voice Webhooks

#### POST /api/voice/incoming
Handles incoming phone calls from Twilio

**Request** (from Twilio):
```json
{
  "From": "+61412345678",
  "To": "+61487654321",
  "CallSid": "CA1234567890abcdef"
}
```

**Response**: TwiML XML for call handling

**Process**:
1. Validate Twilio signature
2. Lookup instructor by "To" number
3. Connect to Copilot agent or voicemail
4. Return TwiML response

#### POST /api/voice/voicemail
Handles voicemail recordings

**Request** (from Twilio):
```json
{
  "RecordingUrl": "https://api.twilio.com/...",
  "RecordingSid": "RE1234567890abcdef",
  "From": "+61412345678"
}
```

**Response**: TwiML confirmation message

### Booking API (Used by AI Agent)

#### POST /api/bookings
Create a new driving lesson booking

**Request**:
```json
{
  "instructorId": "clx123abc456",
  "clientPhone": "+61412345678",
  "clientName": "John Smith",
  "date": "2026-03-15",
  "time": "14:00",
  "duration": 60,
  "notes": "First lesson, needs pickup"
}
```

**Response**:
```json
{
  "bookingId": "bk_abc123xyz",
  "message": "Booking confirmed",
  "smsConfirmation": true
}
```

**Validation**:
- Phone numbers must be in international format (+country code)
- Date must be in YYYY-MM-DD format
- Time must be in HH:MM 24-hour format
- Duration defaults to 60 minutes
- Checks instructor availability before confirming

#### GET /api/instructor/lookup?phone={phone}
Find instructor by phone number

**Request**:
```
GET /api/instructor/lookup?phone=+61487654321
```

**Response**:
```json
{
  "id": "clx123abc456",
  "name": "Sarah Johnson",
  "phone": "+61487654321",
  "email": "sarah@example.com",
  "available": true
}
```

### System Endpoints

#### GET /api/health
Health check with database verification

**Response**:
```json
{
  "status": "ok",
  "uptime": 123.45,
  "database": "connected",
  "timestamp": "2026-03-04T10:30:00.000Z"
}
```

## Configuration

### Environment Variables

**Required**:
```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Twilio
TWILIO_ACCOUNT_SID="ACxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_PHONE_NUMBER="+61412345678"

# Copilot Studio
COPILOT_AGENT_URL="https://your-copilot-endpoint"
COPILOT_API_KEY="your_api_key"

# DriveBook Platform
DRIVEBOOK_API_URL="https://your-platform.com"
DRIVEBOOK_API_KEY="your_api_key"
```

**Optional**:
```bash
# Server
PORT=3001
NODE_ENV=production
REQUEST_TIMEOUT=30000

# Security
ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"
SKIP_TWILIO_VALIDATION=false

# Features
VOICEMAIL_MAX_LENGTH=120
SMS_NOTIFICATIONS_ENABLED=true
```

### Configuration Files

- `.env` - Environment variables (not committed)
- `.env.voice-service.example` - Example configuration
- `openapi.yaml` - API specification for Copilot agent
- `railway.json` - Railway deployment configuration

## Deployment

### Railway (Recommended)

1. Connect GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Railway auto-deploys on push to main branch
4. Service runs on Railway-provided URL

**railway.json**:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server.js",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Vercel (Alternative)

Can be deployed as serverless functions:
- Export Express app from `server.js`
- Vercel handles routing automatically
- Set `VERCEL=1` environment variable

### Manual Deployment

```bash
# Install dependencies
npm install

# Run migrations
npx prisma migrate deploy

# Start server
npm start
```

## SMS Notifications

The system sends SMS confirmations for:
- Booking confirmations
- Booking cancellations
- Reminder messages (24 hours before)

**SMS Service** (`services/sms-service.js`):
- Uses Twilio SMS API
- Configurable message templates
- Handles delivery failures gracefully
- Logs all SMS activity

**Example SMS**:
```
Hi John! Your driving lesson with Sarah is confirmed for 
March 15 at 2:00 PM. Duration: 1 hour. See you then!
```

## Error Handling

### Logging

**Structured JSON logging** (`utils/logger.js`):
```javascript
logger.logInfo('Incoming call', { from, to, requestId });
logger.logWarning('Missing signature', { requestId });
logger.logError(error, { context: 'booking', requestId });
```

**Log Levels**:
- `INFO` - Normal operations
- `WARNING` - Potential issues
- `ERROR` - Failures requiring attention

### Error Responses

All errors include:
- HTTP status code
- Error message
- Request ID for tracing
- Timestamp

**Example**:
```json
{
  "error": "Instructor not found",
  "requestId": "req_abc123",
  "timestamp": "2026-03-04T10:30:00.000Z"
}
```

### Graceful Degradation

- If Copilot agent unavailable → Falls back to voicemail
- If SMS fails → Booking still created, logged for retry
- If database slow → Request timeout prevents hanging
- If validation fails → Clear error message to caller

## Testing

### Local Development

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.voice-service.example .env

# Edit .env with your credentials

# Run in development mode
npm run dev
```

### Testing Twilio Webhooks

Use ngrok to expose local server:
```bash
# Start ngrok
ngrok http 3001

# Update Twilio webhook URL to ngrok URL
# Example: https://abc123.ngrok.io/api/voice/incoming
```

### Testing API Endpoints

```bash
# Health check
curl http://localhost:3001/api/health

# Lookup instructor
curl "http://localhost:3001/api/instructor/lookup?phone=+61412345678"

# Create booking
curl -X POST http://localhost:3001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "instructorId": "clx123",
    "clientPhone": "+61412345678",
    "date": "2026-03-15",
    "time": "14:00"
  }'
```

## Monitoring

### Health Checks

- Railway/Vercel automatically monitors `/api/health`
- Checks database connectivity
- Reports uptime and status

### Metrics to Monitor

- Call volume (incoming calls per hour)
- Booking success rate
- Average call duration
- Voicemail rate (fallback indicator)
- API response times
- Database query performance
- SMS delivery rate

### Alerts

Set up alerts for:
- Health check failures
- High error rates (>5%)
- Database connection issues
- Twilio webhook failures
- SMS delivery failures

## Security Considerations

### Authentication

- Twilio signature validation on all webhooks
- API key authentication for Copilot agent
- CORS restricted to allowed origins
- Helmet.js security headers

### Data Protection

- Phone numbers stored in encrypted database
- No credit card data stored (handled by Stripe)
- Voicemail recordings stored securely in Twilio
- Request IDs for audit trails

### Rate Limiting

Consider implementing:
- Per-IP rate limits
- Per-phone-number booking limits
- API key rate limits for Copilot

### Best Practices

- Always use HTTPS in production
- Rotate API keys regularly
- Monitor for suspicious activity
- Keep dependencies updated
- Regular security audits

## Troubleshooting

### Common Issues

**"Invalid Twilio signature"**
- Check `TWILIO_AUTH_TOKEN` is correct
- Verify webhook URL matches exactly (http vs https)
- Ensure request body is not modified by middleware

**"Instructor not found"**
- Verify phone number format (+country code)
- Check instructor record has phone number set
- Confirm database connection

**"Booking failed"**
- Check instructor availability
- Verify date/time format
- Ensure client phone is valid
- Check database constraints

**"Copilot agent not responding"**
- Verify `COPILOT_AGENT_URL` is correct
- Check API key is valid
- Ensure OpenAPI spec is accessible
- System falls back to voicemail

### Debug Mode

Enable detailed logging:
```bash
LOG_LEVEL=debug npm start
```

### Request Tracing

Every request has a unique ID:
- Check response header: `X-Request-Id`
- Search logs by request ID
- Trace full request lifecycle

## Future Enhancements

### Planned Features

- Multi-language support (Spanish, Mandarin)
- Voice biometrics for client identification
- Real-time availability checking
- Calendar integration (Google, Outlook)
- Payment collection over phone
- Automated follow-up calls
- Call recording for quality assurance
- Analytics dashboard

### Scalability

Current architecture supports:
- 100+ concurrent calls
- 1000+ bookings per day
- Multiple instructors per instance

For higher scale:
- Add Redis for caching
- Implement queue system (Bull, RabbitMQ)
- Load balancer for multiple instances
- CDN for static assets

## Related Documentation

- [Twilio Setup Guide](../../drivebook-hybrid/TWILIO_SETUP_GUIDE.md)
- [Deployment Instructions](../../drivebook-hybrid/DEPLOYMENT_INSTRUCTIONS.md)
- [OpenAPI Specification](../../drivebook-hybrid/openapi.yaml)
- [Database Schema](../01-architecture/DATABASE_SCHEMA.md)
- [API Structure](../01-architecture/API_STRUCTURE.md)

## Support

For issues or questions:
- Check logs for request ID
- Review Twilio console for call details
- Test endpoints with curl/Postman
- Verify environment variables
- Check database connectivity

---

**Last Updated**: March 4, 2026  
**Version**: 1.0.0  
**Maintained By**: DriveBook Engineering Team


---

## CRITICAL: Availability Checking

### ⚠️ IMPORTANT: Always Check Database Before Booking

The AI MUST check the actual database for existing bookings, not just the instructor's working hours template.

### The Problem

**WRONG** ❌:
```
User: "Book me for 1pm on March 23"
AI: Checks working hours → "Monday 8am-6pm"
AI: 1pm is within 8am-6pm → "Available!"
AI: Creates booking
Result: DOUBLE BOOKING if 1pm already booked in database
```

**CORRECT** ✅:
```
User: "Book me for 1pm on March 23"
AI: Calls CheckAvailability API
API: Checks database for existing bookings
API: Returns { available: false, alternatives: ["2pm", "4pm"] }
AI: "Sorry, 1pm is already booked. I have 2pm or 4pm available."
User: "I'll take 2pm"
AI: Calls CheckAvailability API for 2pm
API: Returns { available: true }
AI: Creates booking for 2pm
Result: NO CONFLICT ✅
```

### Required API Call: Check Availability

**Endpoint**: `POST /api/voice/availability`

**When to Call**: BEFORE confirming any booking time

**Request**:
```json
{
  "instructorId": "instructor_id_here",
  "date": "2026-03-23",
  "time": "13:00",
  "duration": 60
}
```

**Response (Available)**:
```json
{
  "available": true,
  "instructorName": "Debesay",
  "date": "2026-03-23",
  "time": "13:00",
  "duration": 60
}
```

**Response (Not Available)**:
```json
{
  "available": false,
  "reason": "Time slot already booked",
  "requestedTime": "13:00",
  "alternatives": [
    { "date": "2026-03-23", "time": "14:00", "available": true },
    { "date": "2026-03-23", "time": "14:30", "available": true },
    { "date": "2026-03-23", "time": "15:00", "available": true }
  ]
}
```

### Correct Booking Flow

```
1. User requests: "Book me for [time] on [date]"

2. AI collects: instructor, date, time, duration

3. AI CALLS: CheckAvailability API ← CRITICAL STEP
   POST /api/voice/availability
   {
     "instructorId": "...",
     "date": "2026-03-23",
     "time": "13:00",
     "duration": 60
   }

4. IF available = true:
   → Continue to collect client details
   → Create booking
   → Send confirmation

5. IF available = false:
   → Say: "Sorry, [time] is already booked"
   → Show alternatives: "I have [alt1], [alt2], [alt3] available"
   → Ask: "Which time would you prefer?"
   → Go back to step 3 with new time

6. Create booking ONLY after availability confirmed
```

### What Gets Checked

The CheckAvailability API checks:
- ✅ Existing bookings in database (PENDING or CONFIRMED status)
- ✅ Time conflicts (overlapping appointments)
- ✅ PDA test blocks (2 hours before + 1 hour after)
- ✅ Availability exceptions (instructor time off)
- ✅ Time is not in the past

### Why This Matters

**Without database checking**:
- Multiple clients can book the same time slot
- Instructor gets double-booked
- Clients show up at same time
- Poor user experience
- Unprofessional service

**With database checking**:
- Only one client per time slot
- No conflicts
- Alternative times suggested automatically
- Professional service
- Happy clients and instructors

### Implementation in Copilot Studio

1. **Add Action**: CheckAvailability
2. **Configure**:
   - URL: `https://drivebook.vercel.app/api/voice/availability`
   - Method: POST
   - Headers: `X-API-Key: your-api-key`
   - Body: instructorId, date, time, duration
3. **Add to Flow**: Before CreateBooking action
4. **Handle Response**: 
   - If available → proceed to booking
   - If not available → show alternatives

See: `COPILOT_ACTION_SETUP.md` for detailed configuration steps.

### Testing

To verify availability checking works:

1. Create a booking for 1pm on March 26
2. Ask AI: "Book me for 1pm on March 26"
3. AI should say: "Sorry, 1pm is taken. Try 2pm?"
4. If AI says "1pm is available" → BUG (not checking database)

### API Authentication

All voice service API calls require authentication:

**Header**: `X-API-Key: dev-voice-key-change-in-production`

Change this key in production for security.

---

## Summary: Critical Requirements

1. ✅ AI MUST call CheckAvailability API before booking
2. ✅ AI MUST check database, not just working hours
3. ✅ AI MUST suggest alternatives if slot is taken
4. ✅ AI MUST NOT create bookings without availability check
5. ✅ API key MUST be included in all requests

**Failure to check availability = Double bookings = Unhappy clients**

Configure the CheckAvailability action in Copilot Studio to prevent this issue!
