# Vercel Deployment Guide - Production Setup

## Current Issue

You have TWO separate Vercel deployments:
- `drivebook-alpha.vercel.app` - Voice service (shows API JSON)
- `drivebook.vercel.app` - Main app (shows login page)

This is confusing and not production-ready.

## Recommended Solution

Deploy ONLY the main DriveBook app. The voice service should run separately or be integrated.

---

## Option 1: Separate Voice Service (Recommended)

### Step 1: Keep Main App Deployment
- Domain: `drivebook.vercel.app` (or your custom domain)
- Deploy from: `drivebook/` folder
- This is your public-facing app

### Step 2: Deploy Voice Service Separately
The voice service (`drivebook-hybrid`) should NOT be on Vercel. Instead:

**Deploy to:**
- Railway.app
- Render.com
- Heroku
- AWS EC2/ECS
- DigitalOcean App Platform

**Why?** The voice service needs:
- Long-running server (Express.js)
- WebSocket support for Twilio
- Persistent connections
- Not serverless-friendly

### Step 3: Configure Twilio Webhooks
Point Twilio to your voice service URL:
```
Voice URL: https://your-voice-service.railway.app/api/voice/incoming
Status Callback: https://your-voice-service.railway.app/api/voice/voicemail
```

---

## Option 2: Integrate Voice Service into Main App

Move voice service routes into Next.js API routes:

### Step 1: Create API Routes in Main App
```
drivebook/app/api/voice/
├── incoming/route.ts
├── voicemail/route.ts
└── ...
```

### Step 2: Convert Express Routes to Next.js
Example:
```typescript
// drivebook/app/api/voice/incoming/route.ts
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Validate Twilio signature
  const signature = request.headers.get('x-twilio-signature');
  // ... validation logic
  
  // Handle voice call
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say('Welcome to DriveBook');
  
  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' }
  });
}
```

### Step 3: Configure Twilio
```
Voice URL: https://drivebook.vercel.app/api/voice/incoming
```

---

## Option 3: Keep Both (Not Recommended)

If you must keep both:

### Step 1: Make Voice Service Private
In Vercel dashboard for `drivebook-alpha`:
- Go to Settings → Domains
- Remove public domain
- Use only for Twilio webhooks

### Step 2: Use Environment Variables
In main app, set:
```env
VOICE_SERVICE_URL=https://drivebook-alpha.vercel.app
```

### Step 3: Configure CORS
In voice service, only allow main app:
```javascript
const corsOptions = {
  origin: ['https://drivebook.vercel.app'],
  credentials: true
};
```

---

## Current Deployment Status

### Main App (drivebook.vercel.app)
- ✅ Next.js app deployed
- ✅ Shows login page
- ✅ Public-facing
- ⚠️ Missing voice service integration

### Voice Service (drivebook-alpha.vercel.app)
- ⚠️ Shows API status JSON (should be hidden)
- ⚠️ Publicly accessible (security risk)
- ⚠️ Serverless deployment (not ideal for Express)
- ❌ Should not be public

---

## Recommended Action Plan

### Immediate (This Week)
1. **Hide drivebook-alpha from public**
   - Go to Vercel dashboard
   - Settings → Domains → Remove public domain
   - Or delete the project entirely

2. **Deploy voice service to Railway/Render**
   - Create account on Railway.app
   - Deploy `drivebook-hybrid` folder
   - Get deployment URL

3. **Update Twilio webhooks**
   - Point to new voice service URL
   - Test incoming calls

### Short Term (Next 2 Weeks)
1. **Set up custom domain**
   - Main app: `drivebook.com`
   - Voice service: `api.drivebook.com` or keep on Railway

2. **Configure environment variables**
   - Update all URLs
   - Test end-to-end

3. **Security audit**
   - Ensure voice service is not publicly browsable
   - Only Twilio can access webhooks

---

## Deployment Commands

### Deploy Main App to Vercel
```bash
cd drivebook
vercel --prod
```

### Deploy Voice Service to Railway
```bash
cd drivebook/drivebook-hybrid
railway login
railway init
railway up
```

### Deploy Voice Service to Render
```bash
# Create render.yaml in drivebook-hybrid/
# Push to GitHub
# Connect Render to your repo
```

---

## Environment Variables

### Main App (Vercel)
```env
DATABASE_URL=your_postgres_url
NEXTAUTH_URL=https://drivebook.vercel.app
NEXTAUTH_SECRET=your_secret
STRIPE_SECRET_KEY=your_stripe_key
VOICE_SERVICE_URL=https://your-voice-service.railway.app
```

### Voice Service (Railway/Render)
```env
DATABASE_URL=your_postgres_url
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=your_number
COPILOT_BASE_URL=https://drivebook.vercel.app
ALLOWED_ORIGINS=https://drivebook.vercel.app
PORT=3001
```

---

## Testing

### Test Main App
```bash
curl https://drivebook.vercel.app
# Should show landing page or login
```

### Test Voice Service
```bash
curl https://your-voice-service.railway.app/api/health
# Should return: {"status":"ok","uptime":123}
```

### Test Twilio Integration
1. Call your Twilio number
2. Should hear AI receptionist
3. Check logs in Railway/Render dashboard

---

## Security Checklist

- [ ] Voice service is not publicly browsable
- [ ] Twilio signature validation enabled
- [ ] CORS configured properly
- [ ] Environment variables secured
- [ ] HTTPS enabled on all endpoints
- [ ] Rate limiting configured
- [ ] Database connections secured

---

## Troubleshooting

### "drivebook-alpha shows JSON instead of app"
- This is expected - it's the voice service API
- Should not be public-facing
- Delete or hide this deployment

### "Twilio webhooks not working"
- Check webhook URL in Twilio console
- Verify voice service is running
- Check logs for errors
- Ensure signature validation is correct

### "CORS errors"
- Update ALLOWED_ORIGINS in voice service
- Include your main app domain
- Test with curl first

---

Last updated: 2026-03-01
