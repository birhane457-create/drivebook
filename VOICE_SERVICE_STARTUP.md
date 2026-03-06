# Voice Service Integration - Startup Guide

**Date**: March 5, 2026  
**Status**: Ready for Testing

## Quick Start

### Step 1: Start Main Platform

Open Terminal 1:
```bash
cd drivebook
npm run dev
```

Wait for: `✓ Ready on http://localhost:3000`

### Step 2: Start Voice Service

Open Terminal 2:
```bash
cd drivebook/drivebook-hybrid
npm run dev
```

Wait for: `Server running on port 3001`

### Step 3: Run Integration Tests

Open Terminal 3:
```bash
cd drivebook
node test-voice-integration.js
```

Expected output:
```
✅ Main Platform Health - SUCCESS
✅ Voice Service Health - SUCCESS
✅ Instructor Lookup - SUCCESS
```

## Configuration Checklist

### Main Platform (.env)
- [x] `DATABASE_URL` - MongoDB connection
- [x] `VOICE_SERVICE_API_KEY` - API key for voice service
- [x] `VOICE_SERVICE_URL` - http://localhost:3001
- [x] `TWILIO_ACCOUNT_SID` - Twilio credentials
- [x] `TWILIO_AUTH_TOKEN` - Twilio credentials
- [x] `TWILIO_PHONE_NUMBER` - Twilio number

### Voice Service (.env)
- [x] `DATABASE_URL` - Same MongoDB as main platform
- [x] `DRIVEBOOK_BASE_URL` - http://localhost:3000
- [x] `DRIVEBOOK_API_KEY` - Same as main platform
- [x] `PORT` - 3001
- [x] `TWILIO_ACCOUNT_SID` - Twilio credentials
- [x] `TWILIO_AUTH_TOKEN` - Twilio credentials
- [x] `TWILIO_PHONE_NUMBER` - Twilio number

## Testing the Voice Flow

### 1. Test with Postman/cURL

**Instructor Lookup:**
```bash
curl -H "X-API-Key: dev-voice-key-change-in-production" \
  "http://localhost:3000/api/voice/instructors/lookup?phone=+17089335601"
```

**Create Booking:**
```bash
curl -X POST http://localhost:3000/api/voice/bookings \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-voice-key-change-in-production" \
  -d '{
    "instructorId": "YOUR_INSTRUCTOR_ID",
    "clientPhone": "+61412345678",
    "clientName": "John Smith",
    "date": "2026-03-20",
    "time": "14:00",
    "duration": 60,
    "notes": "Test booking from voice"
  }'
```

### 2. Test with Twilio (Local Development)

**Setup ngrok:**
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3001
```

**Configure Twilio Webhook:**
1. Go to: https://console.twilio.com/
2. Navigate to: Phone Numbers → Active Numbers
3. Click your number: +17089335601
4. Under "Voice & Fax":
   - A Call Comes In: Webhook
   - URL: `https://YOUR-NGROK-URL.ngrok.io/api/voice/incoming`
   - HTTP: POST
5. Save

**Test Call:**
1. Call your Twilio number: +17089335601
2. Voice service should answer
3. Check logs in Terminal 2
4. Verify webhook received

### 3. Test Voice Conversation Flow

**Expected Flow:**
```
1. Client calls Twilio number
   ↓
2. Twilio sends webhook to voice service
   ↓
3. Voice service looks up instructor by phone
   ↓
4. Voice service connects to Copilot AI (if configured)
   ↓
5. AI handles conversation
   ↓
6. AI creates booking via main platform API
   ↓
7. Confirmation email sent
```

**Current Limitation:**
- Copilot Studio agent not configured yet
- Falls back to voicemail for now
- Manual booking creation works via API

## Troubleshooting

### "Connection refused" on port 3000
- Main platform not running
- Run: `cd drivebook && npm run dev`

### "Connection refused" on port 3001
- Voice service not running
- Run: `cd drivebook/drivebook-hybrid && npm run dev`

### "Unauthorized" error
- API key mismatch
- Check both .env files have same `VOICE_SERVICE_API_KEY`

### "Instructor not found"
- No instructor with that phone number
- Add phone number to instructor in database
- Or use different phone number in test

### "Database connection failed"
- MongoDB connection issue
- Check `DATABASE_URL` in both .env files
- Verify MongoDB is accessible

### Twilio webhook not working
- ngrok not running
- Webhook URL not configured in Twilio
- Check `SKIP_TWILIO_VALIDATION=true` in voice service .env

## Next Steps

### Immediate (Today)
1. ✅ Configure environment variables
2. ✅ Start both services
3. ⏳ Run integration tests
4. ⏳ Test API endpoints
5. ⏳ Verify booking creation

### Short Term (This Week)
1. ⏳ Set up ngrok for Twilio testing
2. ⏳ Test voice call flow
3. ⏳ Configure Copilot Studio agent
4. ⏳ Train AI conversation flows
5. ⏳ End-to-end voice booking test

### Medium Term (Next Week)
1. ⏳ Deploy to staging
2. ⏳ Production Twilio setup
3. ⏳ Load testing
4. ⏳ Security audit
5. ⏳ Documentation updates

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Client Calls                          │
│              Twilio: +17089335601                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Twilio Platform                             │
│         Webhook: /api/voice/incoming                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Voice Service (drivebook-hybrid)                 │
│         Port: 3001                                       │
│                                                          │
│  Endpoints:                                              │
│  • POST /api/voice/incoming                              │
│  • POST /api/voice/voicemail                             │
│  • GET  /api/health                                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP + API Key Auth
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Main Platform (drivebook)                        │
│         Port: 3000                                       │
│                                                          │
│  Voice API Endpoints:                                    │
│  • GET  /api/voice/instructors/lookup                    │
│  • POST /api/voice/bookings                              │
│                                                          │
│  Database: MongoDB (Shared)                              │
│  • Instructors (with twilioPhoneNumber)                  │
│  • Clients                                               │
│  • Bookings                                              │
│  • Transactions                                          │
└─────────────────────────────────────────────────────────┘
```

## Success Criteria

### Integration Tests Pass ✅
- [x] Main platform health check
- [x] Voice service health check
- [ ] Instructor lookup returns data
- [ ] Booking creation works
- [ ] Emails sent correctly

### Voice Call Works ⏳
- [ ] Twilio receives call
- [ ] Webhook triggers voice service
- [ ] Instructor lookup succeeds
- [ ] Voicemail fallback works
- [ ] SMS notification sent

### End-to-End Booking ⏳
- [ ] Client calls number
- [ ] AI handles conversation
- [ ] Booking created in database
- [ ] Client receives confirmation email
- [ ] Instructor receives notification

## Support

### Logs to Check
- Main platform: Terminal 1
- Voice service: Terminal 2
- Twilio console: https://console.twilio.com/monitor/logs/calls

### Common Commands
```bash
# Check if services are running
curl http://localhost:3000/api/health
curl http://localhost:3001/api/health

# Test instructor lookup
curl -H "X-API-Key: dev-voice-key-change-in-production" \
  "http://localhost:3000/api/voice/instructors/lookup?phone=+17089335601"

# View logs
# Terminal 1: Main platform logs
# Terminal 2: Voice service logs

# Restart services
# Ctrl+C in terminal, then npm run dev again
```

---

**Status**: Ready for testing  
**Estimated Time**: 15-30 minutes  
**Priority**: P0 - Critical for voice service

Let's test! 🚀
