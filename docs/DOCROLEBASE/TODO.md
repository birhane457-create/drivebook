# DOCROLEBASE TODO

**Purpose:** Track only what is genuinely left to do before or after launch.
**Last Updated:** June 19, 2026

---

## ⚠️ PRE-LAUNCH CONFIG (no code changes — all dashboard/env tasks)

| # | What | Where |
|---|------|--------|
| 1 | Set live Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`) | Vercel env vars |
| 2 | Set `STRIPE_WEBHOOK_SECRET` from real endpoint | Vercel env vars (Stripe Dashboard → Webhooks) |
| 3 | Create live Stripe price IDs for all 8 tiers (BASIC/PRO/STUDIO/BUSINESS × monthly/annual) | Vercel env vars (after creating products in Stripe) |
| 4 | Configure Stripe Billing Portal (plan switching + proration) | Stripe Dashboard → Settings → Billing |
| 5 | Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Vercel env vars — rate limiting is disabled without this |
| 6 | Verify `GOOGLE_REDIRECT_URI=https://drivebook.com.au/api/calendar/callback` | Vercel env vars + Google Cloud Console |
| 7 | Set `NEXT_PUBLIC_VOICE_PHONE_NUMBER` with real AU number | Vercel env vars — AIReceptionistShowcase shows "coming soon" without it |
| 8 | Replace placeholder ABN on about page | One line in `app/about/page.tsx` |
| 9 | Run `npx prisma migrate deploy` on production DB | Terminal against production DB |

---

## 🔵 DEFERRED (post-launch, by choice)

| What | Decision |
|------|----------|
| `/blog` nav link — build 2 articles or remove link | Deferred — write real content when ready |

---

## ✅ ALL CODE WORK COMPLETE

Build passes. TypeScript: 0 errors. All features implemented, documented, and verified as of June 19, 2026.

**Additional fixes applied after VS Copilot review:**
- `app/api/reviews/route.ts` — rewritten to use actual schema (`Booking.clientRating`, `clientReview`, `reviewGivenAt`). Was calling non-existent `prisma.review` model.
- `app/api/bookings/send-payment-link/route.ts` — fixed typo fallback URL `deivebook.vercel.app` → `drivebook.com.au`.

**Voice service fixes (June 19, 2026):**
- `drivebook-hybrid/routes/main-app-proxy.js` — BLOCKER: was requiring `../generated-client-js/dist/index.js` which doesn't exist. Service crashed on startup. Rewrote to use direct axios proxy calls. Also now sends `x-api-key` header to authenticate voice service requests to the main app.
- `drivebook-hybrid/routes/voice-webhook.js` — BLOCKER: `getSession()` and `saveSession()` called without `await`. Every incoming call was treated as a session recovery (Promise is truthy). Both now awaited.
- `drivebook-hybrid/package.json` — added `axios` to dependencies (was used but not declared).
- `drivebook-hybrid/.env.example` — completely rewritten. Old version referenced MongoDB and main-app vars. Now documents the actual voice service vars: `DRIVEBOOK_BASE_URL`, `DRIVEBOOK_API_KEY`, `REDIS_URL`, etc.
- `drivebook-hybrid/tests/contract.test.js` — replaced broken generated-client mock with axios mock. Fixed all voice session unit tests to use `await` on async methods.
- `drivebook-hybrid/voice-script.md` + `copilot/voice-script.md` — OTP digits corrected 4→6 in all prompts and TwiML examples. Reschedule/cancel prompts no longer ask for "booking reference" (callers don't know this) — now ask for phone number only.
- `drivebook-hybrid/docs/AI_VOICE_RECEPTIONIST_GUIDE.md` — removed `accountHolderPassword` from booking request format example.

See `AGENT_INSTRUCTIONS.md` → Current State for the full summary of what was done.
