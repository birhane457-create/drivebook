# Credential Rotation Checklist

⚠️ **BEFORE PRODUCTION DEPLOYMENT - ROTATE ALL CREDENTIALS**

This checklist tracks which credentials have been exposed in version control and need rotation before going live.

## Status: 🔴 NOT ROTATED (Development Only)

---

## Credentials Requiring Rotation

### 1. Database (Supabase)
- [ ] **DATABASE_URL** - Contains: postgres:EhWh1cNGN4qzmXi7@db.ikhqphbbilrocsghjyda.supabase.co
- [ ] **DIRECT_URL** - Contains same password
- **Action:** Supabase Dashboard → Settings → Database → Reset Password

### 2. NextAuth
- [ ] **NEXTAUTH_SECRET** - Value: QR8WDQ3+T3dM/33fHQUATaVfqCOODG1xIuS4/8vEBnc=
- **Action:** Generate new with: openssl rand -base64 32

### 3. Stripe
- [ ] **STRIPE_SECRET_KEY** - Test key: sk_test_51Rt9FIPFqwsHwRMq...
- [ ] **STRIPE_WEBHOOK_SECRET** - Value: whsec_Y1LremsxnEOw39xSuUor4dx0fEDCkRJo
- **Action:** Stripe Dashboard → Developers → API Keys → Roll Keys

### 4. Twilio
- [ ] **TWILIO_AUTH_TOKEN** - Value: 6178e235e22397e151b81793d47ad29c
- **Action:** Twilio Console → Settings → Auth Token → Create Secondary

### 5. OpenAI
- [ ] **OPENAI_API_KEY** - Key: sk-proj-BHpVnFj_Z2B9RecgxLPRNAvm...
- **Action:** OpenAI Dashboard → API Keys → Create New, Delete Old

### 6. Email (Gmail)
- [ ] **SMTP_PASS** - App password: ilt rmvl ubup nnvi
- **Action:** Google Account → Security → App Passwords → Revoke & Create New

### 7. VAPI
- [ ] **VAPI_WEBHOOK_SECRET** - Value: 194cad50a0fe4bd2...
- [ ] **VAPI_API_KEY** - Value: 0b85cb8-acf6-4717-95d4-d9af01d1af42
- **Action:** VAPI Dashboard → Regenerate Keys

### 8. Cloudinary
- [ ] **CLOUDINARY_API_SECRET** - Value: ZfyNOq8O3yfeF-G43zezFZeuD2g
- **Action:** Cloudinary Dashboard → Settings → Security → Regenerate

### 9. Upstash Redis
- [ ] **UPSTASH_REDIS_REST_TOKEN** - Value: gQAAAAAAATaOAAIg...
- [ ] **KV_REST_API_TOKEN** - Same value
- **Action:** Upstash Console → Database → REST API → Reset Token

### 10. Google Services
- [ ] **GOOGLE_CLIENT_SECRET** - Value: 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
- **Action:** Google Cloud Console → Credentials → Reset Secret

---

## Post-Rotation Steps

After rotating credentials:

1. [ ] Update all credentials in production environment variables (Vercel, AWS, etc.)
2. [ ] Test application startup with new credentials
3. [ ] Verify all integrations working (Stripe, Twilio, Email, etc.)
4. [ ] Delete this checklist file
5. [ ] Consider using secrets manager (AWS Secrets Manager, Vercel Environment Variables)

---

## Additional Security Measures

- [ ] Remove .env from git history if needed: git filter-branch or BFG Repo-Cleaner
- [ ] Set up pre-commit hooks to prevent future credential commits
- [ ] Enable 2FA on all service accounts
- [ ] Set up monitoring/alerts for suspicious API usage
- [ ] Review access logs for unauthorized access during exposure period

---

**Created:** 2026-09-01 18:23  
**Status:** Development - Credentials still exposed but not in production use
