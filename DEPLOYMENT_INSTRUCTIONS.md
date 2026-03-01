# Voice Service Deployment Instructions

## Quick Start

The voice service should be deployed separately from the main DriveBook app.

### Recommended Platforms

1. **Railway.app** (Easiest)
2. **Render.com** (Good free tier)
3. **Heroku** (Classic choice)
4. **DigitalOcean App Platform**

---

## Option 1: Deploy to Railway (Recommended)

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

### Step 2: Login
```bash
railway login
```

### Step 3: Initialize Project
```bash
cd drivebook/drivebook-hybrid
railway init
```

### Step 4: Add Environment Variables
```bash
railway variables set DATABASE_URL="your_database_url"
railway variables set TWILIO_ACCOUNT_SID="your_sid"
railway variables set TWILIO_AUTH_TOKEN="your_token"
railway variables set TWILIO_PHONE_NUMBER="+1234567890"
railway variables set COPILOT_BASE_URL="https://drivebook.vercel.app"
railway variables set ALLOWED_ORIGINS="https://drivebook.vercel.app"
railway variables set NODE_ENV="production"
railway variables set PORT="3001"
```

### Step 5: Deploy
```bash
railway up
```

### Step 6: Get Your URL
```bash
railway domain
```

Your service will be available at: `https://your-project.railway.app`

---

## Option 2: Deploy to Render

### Step 1: Create Account
Go to https://render.com and sign up

### Step 2: Connect GitHub
- Push your code to GitHub
- Connect Render to your repository

### Step 3: Create Web Service
- Click "New +" → "Web Service"
- Select your repository
- Root Directory: `drivebook/drivebook-hybrid`
- Build Command: `npm install && npx prisma generate`
- Start Command: `npm start`

### Step 4: Add Environment Variables
In Render dashboard, add:
```
DATABASE_URL=your_database_url
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
COPILOT_BASE_URL=https://drivebook.vercel.app
ALLOWED_ORIGINS=https://drivebook.vercel.app
NODE_ENV=production
PORT=3001
```

### Step 5: Deploy
Click "Create Web Service"

Your service will be available at: `https://your-service.onrender.com`

---

## Option 3: Deploy with Docker

### Step 1: Build Image
```bash
cd drivebook/drivebook-hybrid
docker build -t drivebook-voice-service .
```

### Step 2: Run Container
```bash
docker run -d \
  -p 3001:3001 \
  -e DATABASE_URL="your_database_url" \
  -e TWILIO_ACCOUNT_SID="your_sid" \
  -e TWILIO_AUTH_TOKEN="your_token" \
  -e TWILIO_PHONE_NUMBER="+1234567890" \
  -e COPILOT_BASE_URL="https://drivebook.vercel.app" \
  -e ALLOWED_ORIGINS="https://drivebook.vercel.app" \
  -e NODE_ENV="production" \
  --name voice-service \
  drivebook-voice-service
```

### Step 3: Deploy to Cloud
Push to Docker Hub and deploy to:
- AWS ECS
- Google Cloud Run
- Azure Container Instances
- DigitalOcean

---

## Post-Deployment Steps

### 1. Test Health Endpoint
```bash
curl https://your-service-url.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2026-03-01T...",
  "database": "connected"
}
```

### 2. Configure Twilio Webhooks

Go to Twilio Console → Phone Numbers → Your Number

**Voice Configuration:**
- When a call comes in: `Webhook`
- URL: `https://your-service-url.com/api/voice/incoming`
- HTTP Method: `POST`

**Status Callback:**
- URL: `https://your-service-url.com/api/voice/voicemail`
- HTTP Method: `POST`

### 3. Update Main App Environment Variables

In Vercel (main app), add:
```env
VOICE_SERVICE_URL=https://your-service-url.com
```

### 4. Test End-to-End

1. Call your Twilio number
2. Should hear AI receptionist greeting
3. Try booking a lesson
4. Check database for new booking
5. Verify SMS confirmation sent

---

## Monitoring

### Railway
```bash
railway logs
```

### Render
- Go to dashboard → Your service → Logs

### Docker
```bash
docker logs voice-service -f
```

---

## Troubleshooting

### Service Won't Start
- Check environment variables are set
- Verify DATABASE_URL is correct
- Check logs for errors

### Twilio Webhooks Failing
- Verify webhook URL is correct
- Check Twilio signature validation
- Ensure service is publicly accessible
- Check CORS configuration

### Database Connection Issues
- Verify DATABASE_URL format
- Check database is accessible from deployment platform
- Ensure Prisma schema is generated

---

## Scaling

### Railway
- Upgrade plan for more resources
- Enable autoscaling in settings

### Render
- Upgrade to paid plan
- Configure autoscaling

### Docker
- Use Kubernetes for orchestration
- Configure horizontal pod autoscaling

---

## Security Checklist

- [ ] Environment variables secured
- [ ] HTTPS enabled
- [ ] Twilio signature validation enabled
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Database connections secured
- [ ] Logs don't expose sensitive data
- [ ] Health endpoint doesn't expose internals

---

## Cost Estimates

### Railway
- Free tier: $5 credit/month
- Hobby: $5/month
- Pro: $20/month

### Render
- Free tier: Available (with limitations)
- Starter: $7/month
- Standard: $25/month

### Heroku
- Eco: $5/month
- Basic: $7/month
- Standard: $25/month

---

## Backup and Recovery

### Database Backups
- Configure automated backups
- Test restore process
- Store backups securely

### Code Backups
- Keep code in Git
- Tag releases
- Document deployment process

---

Last updated: 2026-03-01
