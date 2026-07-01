# DOCROLEBASE TODO

**Purpose:** Track only what is genuinely left to do before or after launch.  
**Last Updated:** July 2026  
**Note:** Completed items are recorded permanently in `00-overview/CHANGES.md` and relevant DOCROLEBASE docs — not here.

---

## ⚠️ PRE-LAUNCH CONFIG (no code changes — all dashboard/env tasks)

| # | What | Where |
|---|------|--------|
| 1 | Set live Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`) | Vercel env vars |
| 2 | Set `STRIPE_WEBHOOK_SECRET` from real endpoint | Vercel env vars (Stripe Dashboard → Webhooks) |
| 3 | Create live Stripe price IDs for all 8 tiers (BASIC/PRO/STUDIO/BUSINESS × monthly/annual) | Vercel env vars (after creating products in Stripe) |
| 4 | Configure Stripe Billing Portal (plan switching + proration) | Stripe Dashboard → Settings → Billing |
| 5 | Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | ✅ DONE — set in `.env` from Upstash console |
| 6 | Verify `GOOGLE_REDIRECT_URI=https://drivebook.com.au/api/calendar/callback` | Vercel env vars + Google Cloud Console |
| 7 | Set `NEXT_PUBLIC_VOICE_PHONE_NUMBER` with real AU number | Vercel env vars — AIReceptionistShowcase shows "coming soon" without it |
| 8 | Replace placeholder ABN on about page | One line in `app/about/page.tsx` |
| 9 | Run `npx prisma migrate deploy` on production DB | Terminal against production DB — includes DeviceToken + NotificationRetry models |
| 10 | Set `connection_limit=20` in `DATABASE_URL` | Vercel env vars — Prisma default is 5, causes queueing under load |
| 11 | Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Vercel env vars — required for mobile push notifications |
| 12 | Submit sitemap to Google Search Console | https://search.google.com/search-console → Sitemaps → `https://drivebook.com.au/sitemap.xml` |

---

## 🔵 PENDING: Code Work

### Fix #5 — DB connection pool (5 min, config only)
**Evidence:** Prisma default pool size is 5. Under moderate load (10+ concurrent requests) timeouts occur.  
**Fix:** Add `?connection_limit=20` to `DATABASE_URL` in Vercel env vars.

### Fix #6 — No tests (5–8 days)
**Evidence:** Zero `*.test.ts` / `*.spec.ts` files in the Next.js app. Financial code has no automated verification.  
**Fix:** Add Jest. Priority: Stripe webhook → wallet deduction → booking creation → refund flow.

### Fix #8 — Voice AI conversation memory (2 days)
**Evidence:** `voice-session-service.js` stores booking state but not OpenAI message history. Each utterance starts fresh.  
**Fix:** Store message history in Redis session keyed by `CallSid`. Pass last N turns as context on each request.

### Fix #9 — AI hallucination prevention (3 days)
**Evidence:** No output validation in any voice or AI route. LLM can invent instructor names, prices, availability.  
**Fix:** Ground system prompt with live data at call start. Validate booking data against DB before confirming.

---

## 🔵 DEFERRED — Post-Launch

| # | What | Notes | Effort |
|---|------|-------|--------|
| 1 | Chargeback automation | `charge.dispute.created` handler exists but no auto-freeze of instructor payout | 3 days |
| 2 | Payout recovery job | Stripe payout success + DB commit failure = PENDING with no recovery | 2 days |
| 3 | Instructor deleted before payout | No guard — payout goes to null instructorId | 1 day |
| 4 | Dashboard metrics — refunds not subtracted | `FinancialLedger` tracks refunds but dashboard SUM doesn't use it | 1 day |
| 5 | Denormalized summary table | Large `SUM(Transaction)` queries slow at scale | 3 days |
| 6 | Notification duplicate prevention | Two concurrent calls can fire two emails for same event | 2 days |
| 7 | Stripe balance ledger tracking | No endpoint to track available Stripe balance over time | 2 days |
| 8 | Rate limiting per-user vs per-IP | Currently IP only — doesn't distinguish attack vs mobile | 2 days |
| 9 | SOC 2 compliance | Zero framework in place | 10+ days |
| 10 | Blog: OG images per post | 1200×630 generated images for social sharing | Needs design assets |
| 11 | Blog: client-side search | Add at 40+ posts (Fuse.js) | 1 day |
| 12 | Blog: pagination | Add at 60+ posts | 1 day |
| 13 | Blog: reading progress bar | Client-side component | 0.5 days |
| 14 | Blog: newsletter signup | When email service ready | 2 days |
