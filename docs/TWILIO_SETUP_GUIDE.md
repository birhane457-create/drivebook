# Twilio Setup Guide for Local Testing

## Prerequisites

- Twilio Account
- Twilio Phone Number: +17089335601
- ngrok installed (for exposing local server)

---

## Step 1: Get Twilio Credentials

1. Go to https://console.twilio.com
2. Find your **Account SID** and **Auth Token**
3. Update `.env` file with these credentials:

```env
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_number
```

---

## Step 2: Install ngrok

### Windows
```bash
# Download from https://ngrok.com/download
# Or use chocolatey:
choco install ngrok
```

### Verify Installation
```bash
ngrok version
```

---

## Step 3: Expose Local Server with ngrok

### Start ngrok
```bash
ngrok http 3003
```

This will give you a public URL like:
```
https://abc123.ngrok.io
```

**Keep this terminal open!**

---

## Step 4: Configure Twilio Webhooks

1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click on your phone number: **+17089335601**
3. Scroll to **Voice Configuration**

### Voice & Fax Settings:
- **Configure with**: Webhooks, TwiML Bins, Functions, Studio, or Proxy
- **A call comes in**: Webhook
  - URL: `https://your-ngrok-url.ngrok.io/api/voice/incoming`
  - HTTP Method: `POST`

### Status Callback:
- URL: `https://your-ngrok-url.ngrok.io/api/voice/voicemail`
- HTTP Method: `POST`

4. Click **Save**

---

## Step 5: Restart Voice Service

```bash
# Stop current process (Ctrl+C)
cd drivebook/drivebook-hybrid
npm start
```

Or restart the background process.

---

## Step 6: Test the Integration

### Test 1: Call Your Twilio Number
```
Call your Twilio phone number
```

**Expected:**
- You should hear an AI greeting
- The AI should ask how it can help
- You can say "I want to book a lesson"

### Test 2: Check Logs
Watch the voice service logs for incoming requests:
```bash
# In the terminal where voice service is running
# You should see:
# "POST /api/voice/incoming"
```

### Test 3: Check ngrok Dashboard
Open: http://localhost:4040

You'll see all webhook requests from Twilio.

---

## Troubleshooting

### Issue: "Twilio signature validation failed"
**Solution:** Set `SKIP_TWILIO_VALIDATION=true` in `.env` for local testing

### Issue: "ngrok connection refused"
**Solution:** 
- Ensure voice service is running on port 3003
- Check: `curl http://localhost:3003/api/health`

### Issue: "Twilio webhook timeout"
**Solution:**
- Check ngrok is running
- Verify webhook URL in Twilio console
- Check voice service logs for errors

### Issue: "No audio on call"
**Solution:**
- Check Twilio console for errors
- Verify TwiML response is valid
- Check voice service logs

---

## Testing Scenarios

### Scenario 1: Book a Lesson
1. Call your Twilio number
2. Say: "I want to book a driving lesson"
3. AI should ask for details
4. Provide: date, time, instructor preference
5. AI should confirm booking

### Scenario 2: Leave Voicemail
1. Call your Twilio number
2. Say: "I want to leave a message"
3. AI should prompt for message
4. Leave your message
5. Check database for saved message

### Scenario 3: Instructor Lookup
1. Call your Twilio number
2. Say: "I'm looking for an instructor"
3. AI should ask for location
4. Provide location
5. AI should list available instructors

---

## Environment Variables Reference

```env
# Required for Twilio Integration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_phone_number

# Required for AI Integration
COPILOT_BASE_URL=http://localhost:3001

# Optional for Local Testing
SKIP_TWILIO_VALIDATION=true
NODE_ENV=development
```

---

## ngrok Commands

### Start ngrok
```bash
ngrok http 3003
```

### Start with custom subdomain (requires paid plan)
```bash
ngrok http 3003 --subdomain=drivebook-voice
```

### Start with auth token
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
ngrok http 3003
```

---

## Monitoring

### Voice Service Logs
Watch for:
- `POST /api/voice/incoming` - Incoming calls
- `POST /api/voice/voicemail` - Voicemail recordings
- `POST /api/bookings` - Booking creations

### ngrok Dashboard
- Open: http://localhost:4040
- View all webhook requests
- Inspect request/response details
- Replay requests for debugging

### Twilio Console
- Go to: https://console.twilio.com/us1/monitor/logs/calls
- View call logs
- Check for errors
- See call duration and status

---

## Production Deployment

Once testing is complete:

1. **Deploy voice service** to Railway/Render
2. **Update Twilio webhooks** to production URL
3. **Set `SKIP_TWILIO_VALIDATION=false`**
4. **Use production database**
5. **Enable rate limiting**

---

## Security Notes

### Local Testing
- ✅ `SKIP_TWILIO_VALIDATION=true` is OK
- ✅ ngrok exposes your local server temporarily
- ✅ Use test Twilio credentials if available

### Production
- ❌ Never skip Twilio validation
- ❌ Never commit `.env` with real credentials
- ✅ Use environment variables in deployment platform
- ✅ Enable HTTPS
- ✅ Configure CORS properly

---

## Quick Reference

| Service | URL | Purpose |
|---------|-----|---------|
| Voice Service | http://localhost:3003 | Local API |
| ngrok | https://abc123.ngrok.io | Public URL |
| ngrok Dashboard | http://localhost:4040 | Monitor webhooks |
| Twilio Console | https://console.twilio.com | Configure webhooks |
| Main App | http://localhost:3001 | DriveBook platform |

---

Last updated: 2026-03-01
