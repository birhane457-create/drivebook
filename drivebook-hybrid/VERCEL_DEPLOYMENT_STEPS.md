# Vercel Deployment Guide

## ✅ Repository Status
- **GitLab Repository**: https://gitlab.com/debesay304/deivebook.git
- **Branch**: main
- **Status**: All files committed and pushed (including mobile app)
- **Latest Commit**: "Add mobile app files (React Native)"

---

## 🚀 Deployment Steps

### 1. Connect GitLab to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Select "Import Git Repository"
4. Choose "GitLab" as the provider
5. Authorize Vercel to access your GitLab account
6. Select the repository: `debesay304/deivebook`
7. Click "Import"

### 2. Configure Project Settings

**Framework Preset**: Next.js (should auto-detect)

**Build Settings**:
- Build Command: `npm run build`
- Output Directory: `.next` (default)
- Install Command: `npm install`

**Root Directory**: `.` (leave as root)

### 3. Add Environment Variables

Click "Environment Variables" and add ALL of these (copy from your `.env` file):

#### Database
```
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/driving_instructor_db?retryWrites=true&w=majority
```

#### NextAuth
```
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-secret-key-here
```

#### Google Maps
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

#### Google Calendar OAuth2
```
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.vercel.app/api/auth/google/callback
```

#### Email (Gmail SMTP)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM=your-email@gmail.com
```

#### SMS (Twilio)
```
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

#### Stripe
```
STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key
STRIPE_SECRET_KEY=sk_live_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

#### Platform Settings
```
PLATFORM_COMMISSION_RATE=15
PLATFORM_NAME=DriveBook
ADMIN_EMAIL=admin@drivebook.com
```

#### Upstash Redis (Rate Limiting)
```
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

#### Cloudinary (Image Upload)
```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**IMPORTANT**: 
- Use PRODUCTION values (not test values)
- Update `NEXTAUTH_URL` to your Vercel domain
- Update `GOOGLE_REDIRECT_URI` to your Vercel domain
- Use Stripe LIVE keys (not test keys)

### 4. Deploy

1. Click "Deploy"
2. Wait for build to complete (3-5 minutes)
3. Vercel will show you the deployment URL

---

## 🔧 Post-Deployment Configuration

### 1. Update Stripe Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Create a new webhook endpoint
3. URL: `https://your-domain.vercel.app/api/stripe/webhook`
4. Events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook signing secret
6. Update `STRIPE_WEBHOOK_SECRET` in Vercel environment variables
7. Redeploy (Vercel > Deployments > ... > Redeploy)

### 2. Update Google OAuth Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services > Credentials
3. Edit your OAuth 2.0 Client ID
4. Add authorized redirect URIs:
   - `https://your-domain.vercel.app/api/auth/google/callback`
   - `https://your-domain.vercel.app/api/calendar/callback`
5. Save changes

### 3. Configure Custom Domain (Optional)

1. In Vercel project settings, go to "Domains"
2. Add your custom domain (e.g., `drivebook.com`)
3. Follow DNS configuration instructions
4. Update `NEXTAUTH_URL` environment variable to use custom domain
5. Update Google OAuth redirect URIs to use custom domain
6. Update Stripe webhook URL to use custom domain

### 4. Set Up Subdomain Wildcard (For Branding Feature)

1. In your DNS provider, add a CNAME record:
   - Name: `*` (wildcard)
   - Value: `cname.vercel-dns.com`
2. In Vercel, add wildcard domain: `*.drivebook.com`
3. This enables custom subdomains like `debesay.drivebook.com`

---

## ✅ Verification Checklist

After deployment, test these features:

- [ ] Homepage loads correctly
- [ ] User registration works
- [ ] Login works (email/password)
- [ ] Instructor dashboard accessible
- [ ] Booking flow works end-to-end
- [ ] Stripe payments process correctly
- [ ] Email notifications send
- [ ] SMS notifications send (Twilio)
- [ ] Google Calendar sync works
- [ ] Image uploads work (Cloudinary)
- [ ] Branding settings save and display
- [ ] Custom subdomains work (if configured)
- [ ] Mobile API endpoints respond correctly

---

## 🐛 Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Verify all environment variables are set
- Run `npm run build` locally to test

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check MongoDB Atlas network access (allow all IPs: `0.0.0.0/0`)
- Ensure database user has read/write permissions

### Stripe Webhook Not Working
- Verify webhook URL is correct
- Check webhook signing secret matches
- Test webhook in Stripe dashboard

### Images Not Uploading
- Verify Cloudinary credentials
- Check API key permissions
- Test upload locally first

### Email Not Sending
- Verify Gmail app password (not regular password)
- Enable "Less secure app access" if needed
- Check SMTP settings

---

## 📊 Monitoring

### Vercel Analytics
- Enable in Vercel dashboard > Analytics
- Monitor page views, performance, errors

### Error Tracking
- Check Vercel logs for runtime errors
- Set up error alerts in Vercel settings

### Database Monitoring
- Monitor MongoDB Atlas metrics
- Set up alerts for high usage

---

## 🔄 Future Deployments

Vercel automatically deploys when you push to GitLab:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

Vercel will:
1. Detect the push
2. Build the project
3. Deploy automatically
4. Show preview URL

---

## 📝 Notes

- First deployment may take 5-10 minutes
- Subsequent deployments are faster (2-3 minutes)
- Preview deployments created for each commit
- Production deployment only on main branch
- Environment variables are encrypted and secure
- Vercel provides automatic HTTPS/SSL
- CDN and edge caching included
- Serverless functions auto-scale

---

## 🎉 Success!

Once deployed, your DriveBook platform will be live at:
- **Vercel URL**: `https://your-project.vercel.app`
- **Custom Domain**: `https://drivebook.com` (if configured)

Share the URL with your instructors and start booking lessons!
