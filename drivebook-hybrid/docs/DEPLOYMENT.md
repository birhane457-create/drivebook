# Deployment Guide — drivebook-hybrid

**Last Updated:** July 2026  
**Platform:** Railway  
**URL:** https://voice.drivebook.com.au

---

## Environment Variables

All secrets are set in Railway's environment panel. Reference: `.env.voice-service.example`

```
# VAPI
VAPI_API_KEY=                    # VAPI dashboard API key
VAPI_PHONE_NUMBER=               # Assigned VAPI number (E.164)
VAPI_ASSISTANT_ID=               # Assistant ID from VAPI dashboard

# Main DriveBook app
MAIN_APP_URL=https://drivebook.com.au
VOICE_SERVICE_API_KEY=           # Shared secret for /api/* calls

# Twilio (SMS only — calls handled by VAPI)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=             # Fallback SMS number

# Upstash Redis (session recovery)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Support contact (embedded in VAPI prompt)
SUPPORT_PHONE=                   # e.g. 0488 000 000 (real number)

# Server
PORT=3000
NODE_ENV=production
```

After changing `SUPPORT_PHONE`, rebuild the VAPI prompt:
```bash
node scripts/build-vapi-prompt.js
```
Then update the prompt in the VAPI dashboard.

---

## Deploy

Railway auto-deploys on push to `main`. No Docker build step required — Railway uses the `npm start` command from `package.json`.

**To trigger a manual redeploy:** push to `main` or click "Redeploy" in Railway dashboard.

**Health check:** `GET https://voice.drivebook.com.au/api/health`  
Expected: `{"status":"ok"}`

---

## VAPI Configuration

VAPI assistant is configured in the VAPI dashboard at https://app.vapi.ai.

The assistant uses `VAPI_SYSTEM_PROMPT.md` as its system prompt (loaded at runtime, not hardcoded in VAPI). Tool endpoints point to `https://voice.drivebook.com.au/api/...`.

**To update the assistant after prompt changes:**
1. Run `node scripts/build-vapi-prompt.js`
2. Copy the output to the VAPI dashboard → Assistant → System Prompt
3. Or use the VAPI API: `node scripts/update-vapi-prompt.js` (if available)

---

## Twilio Configuration

Twilio handles the phone number pool. Each PRO+ instructor number is:
- Owned by DriveBook's Twilio account
- Webhook configured to: `https://voice.drivebook.com.au/api/voice/incoming`
- Managed via `/admin/voice-lines` in the admin dashboard

**Add a new number to pool:**
1. Buy in Twilio Console
2. Set webhook URL above
3. Add to pool via `/admin/voice-lines` → Add Number

---

## Logs

View in Railway dashboard → Deployments → Logs.

Key log patterns to watch:
- `VAPI tool call:` — tool invocations from VAPI
- `SMS sent` — Twilio delivery confirmation
- `Session recovered` — Redis session resume
- `ERROR` — any errors needing investigation

---

## Rollback

In Railway: Deployments → select previous deployment → Redeploy.

---

## Local Development

```bash
cp .env.voice-service.example .env
npm install
npm run dev       # nodemon with auto-reload
```

Test VAPI webhooks locally with ngrok:
```bash
ngrok http 3000
# Use the ngrok URL in VAPI dashboard temporarily
```
