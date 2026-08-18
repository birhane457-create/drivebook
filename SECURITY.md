# Security Guidelines for DriveBook

## ⚠️ CRITICAL: Environment Variables Security

### Production Secrets Management

**NEVER commit the following to version control:**
- `.env` (actual secrets)
- `.env.local` (local development secrets)
- `.env.production` (production secrets)

**ONLY commit:**
- `.env.example` (placeholder values only)

### Current Security Status

🔴 **ACTION REQUIRED:** The `.env` file in this repository contains actual secrets and must be rotated immediately.

### Steps to Secure Your Deployment

#### 1. Rotate All Exposed Credentials

All secrets in the current `.env` file have been exposed in version control and must be rotated:

- [ ] **Database:** Create new PostgreSQL credentials in Supabase
- [ ] **Stripe:** Rotate API keys in Stripe Dashboard → Developers → API Keys
- [ ] **Twilio:** Rotate Auth Token in Twilio Console → Account → API Keys & Tokens
- [ ] **Google OAuth:** Rotate client secret in Google Cloud Console
- [ ] **Cloudinary:** Rotate API secret in Cloudinary Console → Settings
- [ ] **OpenAI:** Rotate API key in OpenAI Platform → API Keys
- [ ] **SMTP:** Change password for email account
- [ ] **NextAuth:** Generate new secret: `openssl rand -base64 32`

#### 2. Remove Secrets from Git History

```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove .env from entire history (DESTRUCTIVE - backup first!)
git filter-repo --path .env --invert-paths

# Or use BFG Repo-Cleaner
git clone --mirror git://github.com/your-org/drivebook.git
java -jar bfg.jar --delete-files .env drivebook.git
cd drivebook.git
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

#### 3. Set Up Proper Environment Variables

**For Vercel Deployment:**

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add all variables from `.env.example`
3. Use Vercel CLI to pull/push: `vercel env pull` or `vercel env add`

**For Local Development:**

1. Copy `.env.example` to `.env.local`
2. Fill in your local development values
3. Never commit `.env.local`

#### 4. Verify .gitignore

Ensure these lines are in `.gitignore`:

```gitignore
.env
.env.local
.env.production
.env*.local
```

### Environment Variable Checklist

#### Critical (Required for Production)
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `DIRECT_URL` - Direct PostgreSQL connection (for migrations)
- [ ] `NEXTAUTH_SECRET` - Session encryption key
- [ ] `STRIPE_SECRET_KEY` - Stripe API secret
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret

#### High Priority (Required for Full Functionality)
- [ ] `TWILIO_ACCOUNT_SID` & `TWILIO_AUTH_TOKEN` - SMS notifications
- [ ] `SMTP_*` - Email sending
- [ ] `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - Calendar sync
- [ ] `CLOUDINARY_*` - Image uploads

#### Medium Priority (Optional Features)
- [ ] `VAPI_*` - Voice AI integration
- [ ] `OPENAI_API_KEY` - AI-powered features
- [ ] `VERCEL_API_TOKEN` - Custom domain automation
- [ ] `UPSTASH_REDIS_*` - Rate limiting

### Security Best Practices

1. **Use Separate Credentials for Each Environment**
   - Development: Test/sandbox credentials
   - Staging: Separate production-like credentials
   - Production: Production credentials only

2. **Rotate Secrets Regularly**
   - API keys: Every 90 days
   - Database passwords: Every 90 days
   - Webhook secrets: When compromised or annually

3. **Least Privilege Access**
   - Use read-only database replicas where possible
   - Create service-specific API keys (not master keys)
   - Limit Stripe key permissions to only what's needed

4. **Monitor for Exposure**
   - Use GitHub secret scanning
   - Set up alerts for credential exposure
   - Use tools like `truffleHog` to scan history

5. **Audit Access**
   - Review who has access to environment variables
   - Remove access when team members leave
   - Use audit logs in Vercel/Stripe/Twilio

### Emergency Response

**If secrets are exposed:**

1. **Immediately rotate** the exposed credentials
2. **Review audit logs** for unauthorized access
3. **Assess impact** - what data/systems were accessed
4. **Update** all deployment environments with new secrets
5. **Document** the incident and response

### Resources

- [Vercel Environment Variables Guide](https://vercel.com/docs/environment-variables)
- [OWASP Secret Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [git-filter-repo](https://github.com/newren/git-filter-repo)

### Contact

For security concerns, contact: **security@drivebook.com.au**

**DO NOT** share actual credentials via email, Slack, or any messaging platform.
