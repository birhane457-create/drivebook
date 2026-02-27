# 🚀 Complete Deployment Guide

**Platform:** Driving School Booking System  
**Version:** 1.0.0  
**Last Updated:** February 22, 2026

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Deployment Options](#deployment-options)
5. [Post-Deployment](#post-deployment)
6. [Troubleshooting](#troubleshooting)

---

## 🔍 Pre-Deployment Checklist

### Run Automated Checks

```bash
# Check environment variables
npm run check:env

# Validate database schema
npm run validate

# Run pre-deployment checks
npm run pre-deploy
```

### Manual Checklist

- [ ] All environment variables configured
- [ ] Database connection tested
- [ ] Prisma schema validated
- [ ] TypeScript compiles without errors
- [ ] Application builds successfully
- [ ] Admin account created
- [ ] Email service tested
- [ ] Payment gateway configured
- [ ] Domain name ready (for production)
- [ ] SSL certificate ready (for production)

---

## 🔧 Environment Setup

### 1. Create Production Environment File

Create `.env.production` with production values:

```bash
# Database
DATABASE_URL="mongodb+srv://prod-user:password@prod-cluster.mongodb.net/prod-db"

# Authentication
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="generate-new-secret-for-production"

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-production-api-key"

# Stripe (Production Keys)
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="noreply@yourdomain.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@yourdomain.com"

# Platform
PLATFORM_NAME="Your Platform Name"
ADMIN_EMAIL="admin@yourdomain.com"
PLATFORM_COMMISSION_RATE="15"

# Optional: SMS
TWILIO_ACCOUNT_SID="your-production-sid"
TWILIO_AUTH_TOKEN="your-production-token"
TWILIO_PHONE_NUMBER="+1234567890"

# Optional: Google Calendar
GOOGLE_CLIENT_ID="your-production-client-id"
GOOGLE_CLIENT_SECRET="your-production-secret"
GOOGLE_REDIRECT_URI="https://yourdomain.com/api/calendar/callback"
```

### 2. Generate Secure Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Validate Environment

```bash
npm run check:env
```

---

## 🗄️ Database Setup

### Option A: MongoDB Atlas (Recommended)

1. **Create Production Cluster**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create new cluster (M10+ for production)
   - Choose region closest to your users
   - Enable backup

2. **Configure Security**
   - Create database user with strong password
   - Whitelist application IP addresses
   - Enable encryption at rest

3. **Get Connection String**
   - Click "Connect" → "Connect your application"
   - Copy connection string
   - Replace `<password>` and `<dbname>`

4. **Apply Schema**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

### Option B: Self-Hosted MongoDB

1. **Install MongoDB**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install mongodb

   # macOS
   brew install mongodb-community
   ```

2. **Configure MongoDB**
   - Enable authentication
   - Set up replica set (for transactions)
   - Configure firewall

3. **Create Database**
   ```bash
   mongo
   use drivebook_prod
   db.createUser({
     user: "prod_user",
     pwd: "strong_password",
     roles: ["readWrite"]
   })
   ```

4. **Apply Schema**
   ```bash
   DATABASE_URL="mongodb://prod_user:password@localhost:27017/drivebook_prod" npx prisma db push
   ```

---

## 🌐 Deployment Options

### Option 1: Vercel (Recommended for Next.js)

#### Setup

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```

4. **Configure Environment Variables**
   - Go to Vercel Dashboard
   - Project Settings → Environment Variables
   - Add all variables from `.env.production`

5. **Deploy to Production**
   ```bash
   vercel --prod
   ```

#### Vercel Configuration

Create `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["sfo1"],
  "env": {
    "DATABASE_URL": "@database_url",
    "NEXTAUTH_SECRET": "@nextauth_secret"
  }
}
```

---

### Option 2: Railway

1. **Create Account**
   - Go to [Railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure**
   - Add environment variables
   - Set build command: `npm run build`
   - Set start command: `npm start`

4. **Deploy**
   - Railway auto-deploys on push to main branch

---

### Option 3: DigitalOcean App Platform

1. **Create App**
   - Go to DigitalOcean
   - Apps → Create App
   - Connect GitHub repository

2. **Configure Build**
   ```yaml
   name: drivebook
   services:
   - name: web
     build_command: npm run build
     run_command: npm start
     environment_slug: node-js
     envs:
     - key: DATABASE_URL
       value: ${DATABASE_URL}
     - key: NEXTAUTH_SECRET
       value: ${NEXTAUTH_SECRET}
   ```

3. **Deploy**
   - Click "Create Resources"

---

### Option 4: AWS (Advanced)

#### Using AWS Amplify

1. **Install Amplify CLI**
   ```bash
   npm install -g @aws-amplify/cli
   amplify configure
   ```

2. **Initialize**
   ```bash
   amplify init
   amplify add hosting
   ```

3. **Deploy**
   ```bash
   amplify publish
   ```

#### Using EC2 + PM2

1. **Launch EC2 Instance**
   - Ubuntu 22.04 LTS
   - t3.medium or larger
   - Configure security groups (80, 443, 22)

2. **Install Dependencies**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Install PM2
   sudo npm install -g pm2

   # Install Nginx
   sudo apt install nginx -y
   ```

3. **Deploy Application**
   ```bash
   # Clone repository
   git clone your-repo-url
   cd your-repo

   # Install dependencies
   npm install

   # Build
   npm run build

   # Start with PM2
   pm2 start npm --name "drivebook" -- start
   pm2 save
   pm2 startup
   ```

4. **Configure Nginx**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

5. **SSL with Let's Encrypt**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

---

## 🔐 Post-Deployment

### 1. Configure Stripe Webhooks

1. **Go to Stripe Dashboard**
   - Developers → Webhooks
   - Add endpoint: `https://yourdomain.com/api/payments/webhook`

2. **Select Events**
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`

3. **Get Webhook Secret**
   - Copy signing secret
   - Add to environment variables as `STRIPE_WEBHOOK_SECRET`

4. **Test Webhook**
   ```bash
   stripe listen --forward-to https://yourdomain.com/api/payments/webhook
   ```

### 2. Create Admin Account

```bash
# SSH into server or use platform CLI
npm run create:admin
```

### 3. Test Critical Flows

```bash
# Test platform endpoints
npm run test:platform
```

**Manual Testing:**
- [ ] Register new instructor
- [ ] Approve instructor (as admin)
- [ ] Create test booking
- [ ] Process payment
- [ ] Check email notifications
- [ ] Test mobile app connection
- [ ] Verify Google Calendar sync

### 4. Set Up Monitoring

#### Vercel Analytics
```bash
npm install @vercel/analytics
```

Add to `app/layout.tsx`:
```typescript
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

#### Sentry Error Tracking
```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

### 5. Configure DNS

1. **Add A Record**
   ```
   Type: A
   Name: @
   Value: Your server IP
   TTL: 3600
   ```

2. **Add WWW Record**
   ```
   Type: CNAME
   Name: www
   Value: yourdomain.com
   TTL: 3600
   ```

3. **Verify**
   ```bash
   dig yourdomain.com
   ```

### 6. Enable SSL/HTTPS

#### Vercel (Automatic)
- SSL is automatic on Vercel

#### Let's Encrypt (Manual)
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 7. Set Up Backups

#### MongoDB Atlas
- Enable continuous backup
- Set retention period (7-30 days)
- Test restore process

#### Manual Backups
```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="$DATABASE_URL" --out="/backups/backup_$DATE"

# Add to crontab
0 2 * * * /path/to/backup-script.sh
```

---

## 🐛 Troubleshooting

### Build Failures

**Error: TypeScript compilation failed**
```bash
# Check for errors
npx tsc --noEmit

# Fix and rebuild
npm run build
```

**Error: Module not found**
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run build
```

### Database Connection Issues

**Error: Connection timeout**
- Check DATABASE_URL is correct
- Verify IP whitelist in MongoDB Atlas
- Test connection:
  ```bash
  npx prisma db push --preview-feature
  ```

**Error: Authentication failed**
- Verify username and password
- Check user has correct permissions
- Ensure special characters are URL-encoded

### Email Not Sending

**Gmail SMTP Issues**
- Use App Password, not regular password
- Enable "Less secure app access" (if needed)
- Check spam folder

**Test email sending:**
```bash
curl https://yourdomain.com/api/test-email
```

### Payment Issues

**Stripe Webhooks Not Working**
- Verify webhook URL is correct
- Check webhook secret matches
- Test with Stripe CLI:
  ```bash
  stripe listen --forward-to https://yourdomain.com/api/payments/webhook
  ```

**Test Card Not Working**
- Use: 4242 4242 4242 4242
- Any future expiry date
- Any 3-digit CVC

### Performance Issues

**Slow Page Loads**
- Enable caching
- Optimize images
- Use CDN
- Check database indexes

**High Memory Usage**
- Increase server resources
- Optimize queries
- Enable connection pooling

---

## 📊 Monitoring Checklist

### Daily
- [ ] Check error logs
- [ ] Monitor uptime
- [ ] Review failed payments
- [ ] Check email delivery rate

### Weekly
- [ ] Review performance metrics
- [ ] Check database size
- [ ] Review user feedback
- [ ] Update dependencies

### Monthly
- [ ] Security audit
- [ ] Backup verification
- [ ] Cost optimization
- [ ] Feature usage analysis

---

## 🎯 Success Metrics

### Technical
- Uptime: >99.9%
- Response time: <500ms
- Error rate: <0.1%
- Build time: <5 minutes

### Business
- Booking conversion: >10%
- Payment success: >95%
- Email delivery: >98%
- User satisfaction: >4.5/5

---

## 📞 Support

### Documentation
- `README.md` - Project overview
- `QUICK_ACTION_PLAN.md` - Launch guide
- `PLATFORM_READY_TO_LAUNCH.md` - Status
- `TROUBLESHOOTING.md` - Common issues

### Commands Reference
```bash
npm run dev              # Development server
npm run build            # Production build
npm run start            # Production server
npm run check:env        # Check environment
npm run test:platform    # Test endpoints
npm run pre-deploy       # Pre-deployment checks
npm run create:admin     # Create admin user
npx prisma studio        # Database GUI
```

---

## ✅ Deployment Complete!

Once deployed, your platform will be live at:
- **Production:** https://yourdomain.com
- **Admin:** https://yourdomain.com/admin
- **API:** https://yourdomain.com/api

**Next Steps:**
1. Monitor for 24 hours
2. Gather user feedback
3. Optimize based on metrics
4. Plan feature updates

---

**Congratulations on deploying your platform!** 🎉

*Last Updated: February 22, 2026*
