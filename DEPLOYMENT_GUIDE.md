# DriveBook Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────┐
│  Main App (drivebook/)                  │
│  ├── Next.js 14 App                     │
│  ├── Admin Dashboard                    │
│  ├── Client Portal                      │
│  ├── Instructor Dashboard               │
│  ├── API Routes                         │
│  └── Database: MongoDB                  │
│                                         │
│  Deploy to: Vercel                      │
│  URL: https://drivebook.vercel.app      │
└─────────────────────────────────────────┘
                    ↕ API Calls
┌─────────────────────────────────────────┐
│  Voice Service (drivebook-hybrid/)      │
│  ├── Express.js Server                  │
│  ├── Twilio Webhooks                    │
│  ├── Voice API Routes                   │
│  ├── AI Integration                     │
│  └── Database: SQLite (cache)           │
│                                         │
│  Deploy to: Railway                     │
│  URL: https://drivebook-voice.up.railway.app │
└─────────────────────────────────────────┘
                    ↕ Webhooks
┌─────────────────────────────────────────┐
│  External Services                      │
│  ├── Twilio (Voice/SMS)                 │
│  ├── Stripe (Payments)                  │
│  ├── Microsoft Copilot (AI)             │
│  └── Resend (Email)                     │
└─────────────────────────────────────────┘
```

## What's in Each Project

### Main App (`drivebook/`)
**Type:** Next.js 14 Application  
**Contains:**
- Full web application
- Admin, client, instructor dashboards
- Authentication (NextAuth)
- Payment processing (Stripe)
- Database (MongoDB via Prisma)
- Email/SMS notifications

**Files:**
- `app/` - Next.js pages and API routes
- `components/` - React components
- `lib/` - Utilities and services
- `prisma/schema.prisma` - Database schema
- `package.json` - Dependencies

### Voice Service (`drivebook-hybrid/`)
**Type:** Express.js Microservice  
**Contains:**
- Voice webhook handlers
- Twilio integration
- AI agent connector
- Booking API for voice
- Instructor lookup cache

**Files:**
- `server.js` - Express app entry point
- `routes/` - Voice webhook routes
- `services/` - Business logic
- `utils/` - Helpers and validators
- `prisma/schema.prisma` - SQLite cache schema
- `package.json` - Dependencies

## Deployment Steps

### 1. Commit Your Changes

```bash
cd drivebook

# Check what's being committed
git status

# Commit
git commit -m "feat: Add voice integration and improvements

- Voice service microservice (Express)
- Password reset flow
- Enhanced documentation
- Security improvements
- Clean up 191 old files"

# Push to remote
git push origin main
```

### 2. Deploy Main App to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy from root directory
cd drivebook
vercel --prod
```

**Or use Vercel Dashboard:**
1. Go to https://vercel.com
2. Import Git Repository
3. Select `drivebook` repo
4. Root Directory: `/` (leave empty)
5. Framework: Next.js
6. Click Deploy

**Environment Variables (Vercel Dashboard):**
```env
DATABASE_URL=mongodb+srv://...
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://drivebook.vercel.app
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890
RESEND_API_KEY=re_...
VOICE_SERVICE_URL=https://drivebook-voice.up.railway.app
```

### 3. Deploy Voice Service to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Navigate to voice service
cd drivebook-hybrid

# Initialize Railway project
railway init

# Deploy
railway up
```

**Or use Railway Dashboard:**
1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select `drivebook` repo
4. Root Directory: `drivebook-hybrid`
5. Start Command: `npm start`
6. Click Deploy

**Environment Variables (Railway Dashboard):**
```env
DATABASE_URL=file:./prisma/dev.db
DRIVEBOOK_BASE_URL=https://drivebook.vercel.app
DRIVEBOOK_API_KEY=your-api-key-here
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890
COPILOT_BASE_URL=https://copilotstudio.microsoft.com/...
NODE_ENV=production
PORT=3001
ALLOWED_ORIGINS=https://drivebook.vercel.app
```

### 4. Configure Twilio Webhooks

1. Go to Twilio Console
2. Phone Numbers → Your Number
3. Voice Configuration:
   - When a call comes in: **Webhook**
   - URL: `https://drivebook-voice.up.railway.app/api/voice/incoming`
   - HTTP Method: **POST**
4. Save

### 5. Test Deployments

**Test Main App:**
```bash
curl https://drivebook.vercel.app/api/health
```

**Test Voice Service:**
```bash
curl https://drivebook-voice.up.railway.app/api/health
```

**Test Voice Integration:**
1. Call your Twilio number
2. Should hear AI receptionist
3. Try booking a lesson
4. Check database for new booking

## Post-Deployment Checklist

### Main App
- [ ] Website loads correctly
- [ ] Login/authentication works
- [ ] Admin dashboard accessible
- [ ] Instructor dashboard accessible
- [ ] Client booking flow works
- [ ] Stripe payments process
- [ ] Email notifications send
- [ ] SMS notifications send

### Voice Service
- [ ] Health endpoint responds
- [ ] Twilio webhooks receive calls
- [ ] AI agent responds
- [ ] Bookings create successfully
- [ ] SMS confirmations send
- [ ] Voicemail fallback works

### Integration
- [ ] Voice service can call main app API
- [ ] Main app can call voice service
- [ ] Database syncs correctly
- [ ] Payments process end-to-end

## Monitoring

### Vercel (Main App)
- Dashboard: https://vercel.com/dashboard
- Logs: Real-time in dashboard
- Analytics: Built-in
- Errors: Automatic error tracking

### Railway (Voice Service)
- Dashboard: https://railway.app/dashboard
- Logs: `railway logs`
- Metrics: CPU, memory, network
- Deployments: Automatic on git push

## Troubleshooting

### Main App Issues

**Build fails:**
```bash
# Check build locally
npm run build

# Check environment variables
vercel env ls
```

**Database connection fails:**
- Verify `DATABASE_URL` in Vercel
- Check MongoDB Atlas IP whitelist
- Test connection string locally

**Authentication issues:**
- Verify `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches deployment URL
- Clear cookies and try again

### Voice Service Issues

**Server won't start:**
```bash
# Check logs
railway logs

# Verify environment variables
railway variables
```

**Twilio webhooks fail:**
- Verify webhook URL in Twilio console
- Check Railway deployment is running
- Test health endpoint
- Check Twilio signature validation

**Database errors:**
```bash
# Regenerate Prisma client
cd drivebook-hybrid
npx prisma generate
railway up
```

## Scaling

### Main App (Vercel)
- Automatic scaling
- Upgrade to Pro for:
  - More bandwidth
  - Longer function timeout
  - Priority support

### Voice Service (Railway)
- Starts with 512MB RAM, 1 vCPU
- Upgrade plan for:
  - More resources
  - Multiple replicas
  - Custom domains

## Cost Estimates

### Vercel (Main App)
- **Hobby:** Free
  - 100GB bandwidth/month
  - 10s function timeout
  - Unlimited deployments
- **Pro:** $20/month
  - 1TB bandwidth
  - 60s function timeout
  - Team features

### Railway (Voice Service)
- **Free Trial:** $5 credit
- **Developer:** $5/month
  - 512MB RAM
  - 1 vCPU
  - 100GB bandwidth
- **Team:** $20/month
  - More resources
  - Multiple services

### Total Monthly Cost
- **Development:** $0 (free tiers)
- **Production:** $5-25/month
- **Scale:** $40+/month

## Backup and Recovery

### Database Backups
```bash
# MongoDB (Main App)
mongodump --uri="$DATABASE_URL" --out=backup/

# SQLite (Voice Service)
railway run cp prisma/dev.db backup/voice-$(date +%Y%m%d).db
```

### Code Backups
- Git repository (already backed up)
- Tag releases: `git tag v1.0.0`
- Push tags: `git push --tags`

## Security Checklist

- [ ] All environment variables secured
- [ ] HTTPS enabled (automatic on Vercel/Railway)
- [ ] API keys rotated regularly
- [ ] Database access restricted
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Logs don't expose sensitive data

## Support

**Issues:**
- Check logs first (Vercel/Railway dashboards)
- Review error messages
- Test locally to reproduce
- Check environment variables

**Documentation:**
- Main App: `drivebook/README.md`
- Voice Service: `drivebook-hybrid/README.md`
- API Docs: `docs/01-architecture/API_STRUCTURE.md`

---

**Last Updated:** March 2026  
**Status:** Production Ready
