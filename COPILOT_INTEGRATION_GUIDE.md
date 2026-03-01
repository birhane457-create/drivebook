# Copilot Studio Integration Guide

## Overview

This guide explains how to connect your Microsoft Copilot Studio AI agent to your DriveBook voice service API, enabling the AI to book lessons, look up instructors, and interact with your platform.

## Architecture

```
[Student Calls] → [Twilio] → [Copilot Studio Agent] → [DriveBook Voice API] → [DriveBook Database]
                                      ↓
                              (Your AI Receptionist)
```

---

## Prerequisites

- Microsoft Copilot Studio account
- DriveBook voice service deployed (Railway/Render)
- OpenAPI specification file (`openapi.yaml`)
- API endpoint URL (e.g., `https://your-service.railway.app`)

---

## Step 1: Prepare Your API

### 1.1 Deploy Voice Service

Deploy your voice service to a public URL:

```bash
# Option 1: Railway
cd drivebook/drivebook-hybrid
railway up

# Option 2: Render
# Push to GitHub and connect Render

# Option 3: Docker
docker build -t drivebook-voice .
docker push your-registry/drivebook-voice
```

### 1.2 Get Your API URL

After deployment, you'll have a public URL like:
- Railway: `https://drivebook-voice-production.up.railway.app`
- Render: `https://drivebook-voice.onrender.com`

### 1.3 Update OpenAPI Specification

Edit `openapi.yaml` and update the `host` field:

```yaml
host: your-actual-service-url.railway.app
```

### 1.4 Test Your API

```bash
curl https://your-service-url.railway.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

## Step 2: Add REST API Tool to Copilot Studio

### 2.1 Open Copilot Studio

1. Go to https://copilotstudio.microsoft.com
2. Sign in with your Microsoft account
3. Select your agent or create a new one

### 2.2 Navigate to Tools

1. Click on your agent to open it
2. Go to the **Overview** page
3. In the **Tools** section, click **Add tool**
4. Or go to the **Tools** tab and select **Add a tool**

### 2.3 Add REST API Tool

1. Select **New tool** → **REST API**
2. You'll see the REST API configuration page

---

## Step 3: Upload OpenAPI Specification

### 3.1 Upload File

1. Click **Upload** or drag and drop `openapi.yaml`
2. Wait for validation to complete
3. Review the detected endpoints

### 3.2 Verify Details

You should see:
- **Title**: DriveBook Voice Service API
- **Version**: 1.0.0
- **Base URL**: Your deployed service URL
- **Endpoints**: 
  - `/health` - Health check
  - `/instructor/lookup` - Find instructor
  - `/bookings` - Create booking
  - `/voice/incoming` - Handle calls
  - `/voice/voicemail` - Handle voicemail

### 3.3 Improve Description

Update the description to help the AI understand when to use this API:

```
This API allows the AI agent to interact with the DriveBook platform to:
- Look up instructors by phone number
- Check instructor availability
- Create driving lesson bookings
- Send SMS confirmations to clients

Use this API whenever a caller wants to book a lesson, find an instructor, 
or check availability.
```

### 3.4 Select Solution

- Leave blank (a solution will be created automatically)
- Or select an existing solution if you have one
- Click **Next**

---

## Step 4: Configure Authentication

### For Development/Testing

1. Select **Authentication**: **None**
2. Click **Next**

### For Production

1. Select **Authentication**: **API Key**
2. Configure:
   - **Parameter label**: API Key
   - **Parameter name**: X-API-Key
   - **Parameter location**: Header
3. Click **Next**

---

## Step 5: Select and Configure Tools

### 5.1 Select Operations

Check the operations you want your agent to use:

- ✅ **healthCheck** - Check service status
- ✅ **lookupInstructor** - Find instructor by phone
- ✅ **createBooking** - Book a lesson

Leave unchecked:
- ⬜ **handleIncomingCall** - Internal Twilio webhook
- ⬜ **handleVoicemail** - Internal Twilio webhook

### 5.2 Configure Each Tool

For each selected tool, improve the description:

#### lookupInstructor
```
Use this tool when the caller asks about a specific instructor or wants to 
find an instructor by their phone number. This helps verify instructor 
availability and details before booking.

Example triggers:
- "Is instructor John available?"
- "Find instructor with phone +61412345678"
- "Who is the instructor at this number?"
```

#### createBooking
```
Use this tool to book a driving lesson after confirming:
1. Instructor availability
2. Client's preferred date and time
3. Client's phone number for confirmation

Always confirm details with the caller before creating the booking.

Example triggers:
- "Book a lesson for Tuesday at 2pm"
- "I want to schedule a driving lesson"
- "Can you book me with instructor John?"
```

### 5.3 Review Parameters

For each tool, review and update parameter descriptions:

**lookupInstructor parameters:**
- `phone`: "Instructor's phone number in international format (e.g., +61412345678)"

**createBooking parameters:**
- `instructorId`: "Unique ID of the instructor (obtained from lookupInstructor)"
- `clientPhone`: "Client's phone number for SMS confirmation"
- `date`: "Lesson date in YYYY-MM-DD format"
- `time`: "Lesson time in HH:MM 24-hour format"
- `duration`: "Lesson duration in minutes (default: 60)"

Click **Next**

---

## Step 6: Review and Publish

### 6.1 Review Configuration

- Verify all tools are configured correctly
- Check parameter descriptions
- Ensure authentication is set up

### 6.2 Publish

1. Click **Next** to publish
2. Wait for publishing to complete (may take 1-2 minutes)
3. You'll see a success message

### 6.3 Verify Tools

Go to the **Tools** tab and verify your REST API tools appear:
- lookupInstructor
- createBooking
- healthCheck

---

## Step 7: Update Agent Instructions

### 7.1 Add Tool Usage Instructions

Go to your agent's **Instructions** and add:

```
You are a friendly AI receptionist for DriveBook, a driving school booking platform.

AVAILABLE TOOLS:
- lookupInstructor: Find instructor details by phone number
- createBooking: Book a driving lesson

BOOKING WORKFLOW:
1. Greet the caller warmly
2. Ask what they need (booking, information, etc.)
3. If booking:
   a. Ask for preferred instructor (or help them find one)
   b. Use lookupInstructor if they provide a phone number
   c. Ask for preferred date and time
   d. Confirm all details with the caller
   e. Use createBooking to complete the booking
   f. Confirm booking was successful and provide booking ID
4. Always be polite and helpful
5. If you encounter errors, apologize and offer alternatives

IMPORTANT:
- Always confirm details before creating a booking
- Use international phone format (+country code)
- Dates must be in YYYY-MM-DD format
- Times must be in HH:MM 24-hour format
- Default lesson duration is 60 minutes
```

### 7.2 Add Example Conversations

Add example conversations to train your agent:

**Example 1: Simple Booking**
```
User: I want to book a lesson
Agent: I'd be happy to help you book a driving lesson! Do you have a 
       preferred instructor, or would you like me to help you find one?
User: I want instructor John
Agent: Great! What date and time would work best for you?
User: Next Tuesday at 2pm
Agent: Perfect! And what's the best phone number to send your confirmation to?
User: +61412345678
Agent: [Uses createBooking tool]
       Excellent! I've booked your lesson with John for Tuesday at 2:00 PM. 
       You'll receive an SMS confirmation shortly. Your booking ID is bk_abc123.
```

---

## Step 8: Test the Integration

### 8.1 Use Test Panel

1. Open the **Test** panel in Copilot Studio
2. Enable **Show activity map when testing**
3. Try test conversations:

```
Test 1: "Find instructor with phone +61412345678"
Expected: Agent uses lookupInstructor tool

Test 2: "Book a lesson for tomorrow at 10am"
Expected: Agent asks for more details, then uses createBooking

Test 3: "What's your health status?"
Expected: Agent uses healthCheck tool
```

### 8.2 Verify Tool Calls

In the activity map, you should see:
- Tool invocations highlighted
- Request/response data
- Any errors or issues

### 8.3 Check API Logs

Monitor your voice service logs:

```bash
# Railway
railway logs

# Render
# Check logs in dashboard

# Docker
docker logs your-container
```

You should see incoming API requests from Copilot Studio.

---

## Step 9: Connect to Twilio

### 9.1 Configure Twilio to Use Copilot

Instead of calling your voice service directly, configure Twilio to use Copilot Studio:

1. Go to Twilio Console
2. Select your phone number
3. Under **Voice Configuration**:
   - **A call comes in**: Webhook
   - **URL**: Your Copilot Studio webhook URL
   - **HTTP Method**: POST

### 9.2 Get Copilot Webhook URL

In Copilot Studio:
1. Go to **Settings** → **Channels**
2. Enable **Twilio** channel
3. Copy the webhook URL
4. Add to Twilio configuration

---

## Step 10: Production Deployment

### 10.1 Security Checklist

- [ ] Enable API key authentication
- [ ] Set `SKIP_TWILIO_VALIDATION=false`
- [ ] Use HTTPS for all endpoints
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Set up monitoring and alerts

### 10.2 Update Environment Variables

```env
NODE_ENV=production
ALLOWED_ORIGINS=https://your-copilot-domain.com
SKIP_TWILIO_VALIDATION=false
```

### 10.3 Monitor Performance

- Set up logging aggregation
- Configure error alerts
- Monitor API response times
- Track booking success rates

---

## Troubleshooting

### Issue: "Tool not found"
**Solution:** Republish your REST API tool in Copilot Studio

### Issue: "Authentication failed"
**Solution:** Verify API key is configured correctly in both Copilot and your API

### Issue: "Timeout calling API"
**Solution:** 
- Check your API is running and accessible
- Verify the URL in openapi.yaml is correct
- Check for network/firewall issues

### Issue: "Invalid response format"
**Solution:** Ensure your API returns JSON in the format specified in openapi.yaml

### Issue: "Agent doesn't use tools"
**Solution:** 
- Improve tool descriptions
- Add more specific instructions
- Test with clearer user prompts

---

## Alternative Integration Methods

### Method 1: Direct Line API

For programmatic control:

```javascript
// Get Direct Line token
const response = await fetch(
  'https://directline.botframework.com/v3/directline/tokens/generate',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_DIRECT_LINE_SECRET'
    }
  }
);

const { token } = await response.json();

// Send message to agent
await fetch(
  'https://directline.botframework.com/v3/directline/conversations',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

### Method 2: Power Automate Integration

Create flows that trigger on:
- New bookings
- Instructor lookups
- Failed calls

---

## Resources

- OpenAPI Specification: `openapi.yaml`
- Copilot Studio Docs: https://learn.microsoft.com/copilot-studio
- REST API Tool Guide: https://learn.microsoft.com/copilot-studio/advanced-plugin-actions
- Twilio Integration: https://www.twilio.com/docs/voice

---

## Support

For issues:
1. Check voice service logs
2. Review Copilot Studio activity map
3. Verify API endpoints are accessible
4. Check authentication configuration

---

Last updated: 2026-03-01
