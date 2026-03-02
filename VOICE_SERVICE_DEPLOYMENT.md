# Voice Service Deployment Guide

## Quick Setup for Online Testing

### Step 1: Add Environment Variable to Vercel (Main App)

1. Go to https://vercel.com (your main drivebook project)
2. Navigate to: Settings → Environment Variables
3. Add new variable:
   - **Name**: `NEXT_PUBLIC_VOICE_PHONE_NUMBER`
   - **Value**: `+17089335601`
   - **Environment**: Production, Preview, Development (select all)
4. Click "Save"
5. Redeploy: Go to Deployments → Click "..." → Redeploy

### Step 2: Deploy Voice Service to Railway

#### Option A: Using Railway CLI
```bash
cd drivebook/drivebook-hybrid

# Install Railway CLI (if not installed)
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add environment variables
railway variables set DATABASE_URL="your_database_url"
railway variables set TWILIO_ACCOUNT_SID="ACd97478e87ca4d78d699ca742f636edef"
railway variables set TWILIO_AUTH_TOKEN="585d4a1d2d8e8f399cdd4d5e8948eaa6"
railway variables set TWILIO_PHONE_NUMBER="+17089335601"
railway variables set COPILOT_BASE_URL="https://deivebook.vercel.app"
railway variables set ALLOWED_ORIGINS="https://deivebook.vercel.app"
railway variables set SKIP_TWILIO_VALIDATION="false"
railway variables set NODE_ENV="production"
railway variables set PORT="3003"

# Deploy
railway up
```

#### Option B: Using Railway Dashboard
1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Set root directory: `drivebook/drivebook-hybrid`
5. Add environment variables (see list below)
6. Deploy

### Step 3: Get Your Voice Service URL

After deployment, Railway will give you a URL like:
```
https://your-app.railway.app
```

### Step 4: Configure Twilio Webhooks

1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click on phone number: +17089335601
3. Under "Voice Configuration":
   - **A call comes in**: `https://your-app.railway.app/api/voice/incoming` (POST)
   - **Call status changes**: `https://your-app.railway.app/api/voice/voicemail` (POST)
4. Click "Save"

### Step 5: Test

1. Visit your main app: https://deivebook.vercel.app
2. You should see the phone number displayed
3. Call (708) 933-5601
4. The AI voice receptionist should answer

---

## Environment Variables for Voice Service

```env
DATABASE_URL=your_mongodb_or_postgres_url
TWILIO_ACCOUNT_SID=ACd97478e87ca4d78d699ca742f636edef
TWILIO_AUTH_TOKEN=585d4a1d2d8e8f399cdd4d5e8948eaa6
TWILIO_PHONE_NUMBER=+17089335601
COPILOT_BASE_URL=https://deivebook.vercel.app
ALLOWED_ORIGINS=https://deivebook.vercel.app
SKIP_TWILIO_VALIDATION=false
NODE_ENV=production
PORT=3003
```

---

## Alternative: Deploy to Render

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Settings:
   - **Name**: drivebook-voice-service
   - **Root Directory**: `drivebook/drivebook-hybrid`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add environment variables (same as above)
6. Click "Create Web Service"

---

## Monitoring

### Check Voice Service Health
```bash
curl https://your-app.railway.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "uptime": 123.45,
  "database": "connected",
  "timestamp": "2026-03-01T17:30:00.000Z"
}
```

### View Logs
- **Railway**: Dashboard → Your Project → Logs
- **Render**: Dashboard → Your Service → Logs

### Test Twilio Integration
1. Call (708) 933-5601
2. Check logs for incoming webhook
3. Verify TwiML response

---

## Troubleshooting

### Issue: "Cannot connect to database"
- Check DATABASE_URL is set correctly
- Ensure database allows connections from Railway/Render IPs

### Issue: "Twilio signature validation failed"
- Ensure SKIP_TWILIO_VALIDATION=false in production
- Check TWILIO_AUTH_TOKEN is correct
- Verify webhook URL in Twilio console matches deployment URL

### Issue: "Service not responding"
- Check service is running in Railway/Render dashboard
- Verify PORT is set to 3003
- Check logs for startup errors

---

Last updated: 2026-03-01
