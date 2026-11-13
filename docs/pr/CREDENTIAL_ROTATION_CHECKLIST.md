# Credential Rotation Checklist

⚠️ **ROTATE ALL CREDENTIALS BEFORE PRODUCTION DEPLOYMENT**

This checklist tracks which credentials must be rotated before going live.
All actual credential values have been removed from this file. See `.env.local` (not committed) for current dev values.

## Status: 🔴 NOT ROTATED (Development Only)

---

## Credentials Requiring Rotation

### 1. Database (Supabase)
- [ ] **DATABASE_URL** — Supabase pooler connection
- [ ] **DIRECT_URL** — Supabase direct connection
- **Action:** Supabase Dashboard → Settings → Database → Reset Password → update Vercel env vars

### 2. NextAuth
- [ ] **NEXTAUTH_SECRET**
- **Action:** Generate new: `openssl rand -base64 32` → update Vercel env var

### 3. Stripe
- [ ] **STRIPE_SECRET_KEY** (test key)
- [ ] **STRIPE_WEBHOOK_SECRET**
- **Action:** Stripe Dashboard → Developers → API Keys → Roll → update Vercel env vars

### 4. Twilio
- [ ] **TWILIO_ACCOUNT_SID**
- [ ] **TWILIO_AUTH_TOKEN**
- **Action:** Twilio Console → Settings → Auth Token → Rotate → update Vercel env vars

### 5. OpenAI
- [ ] **OPENAI_API_KEY**
- **Action:** platform.openai.com → API Keys → Create New, Delete Old → update Vercel env var

### 6. Email (Gmail SMTP)
- [ ] **SMTP_PASS** (App password)
- **Action:** Google Account → Security → App Passwords → Revoke & Create New → update Vercel env var

### 7. VAPI
- [ ] **VAPI_WEBHOOK_SECRET**
- [ ] **VAPI_API_KEY**
- **Action:** VAPI Dashboard → Regenerate Keys → update Vercel env vars

### 8. Cloudinary
- [ ] **CLOUDINARY_API_KEY**
- [ ] **CLOUDINARY_API_SECRET**
- **Action:** Cloudinary Dashboard → Settings → Security → Regenerate → update Vercel env vars

### 9. Upstash Redis
- [ ] **UPSTASH_REDIS_REST_TOKEN**
- [ ] **KV_REST_API_TOKEN**
- **Action:** Upstash Console → Database → REST API → Reset Token → update Vercel env vars

### 10. Google OAuth
- [ ] **GOOGLE_CLIENT_ID**
- [ ] **GOOGLE_CLIENT_SECRET**
- **Action:** console.cloud.google.com → Credentials → OAuth 2.0 Client → Reset Secret → update Vercel env vars

---

## Post-Rotation Steps

1. [ ] Update all credentials in Vercel environment settings
2. [ ] Test application startup with new credentials
3. [ ] Verify all integrations working (Stripe, Twilio, Email, VAPI, etc.)
4. [ ] Verify old credentials no longer authenticate
5. [ ] Contact GitHub/GitLab support to purge cached views of old commits

---

## Git History Cleanup — COMPLETED

All credential values were removed from Git history using `git filter-repo` on 2026-11-13.
History rewritten across all three remotes (GitHub `origin`, GitLab `gitlab`, GitLab `old-origin`).
Credentials in Git history are now `REDACTED_*` placeholders.

The `.env.local` file (never tracked) holds current development values.
Rotate all values above before production deployment.
