# DOCROLEBASE TODO

**Purpose:** Track what is genuinely left to do before or after launch.  
**Last Updated:** July 2026  
**Note:** Completed items are recorded in `00-overview/CHANGES.md` and relevant DOCROLEBASE docs — not here.

---

## ⚠️ PRE-LAUNCH CONFIG (no code changes — all dashboard/env tasks)

| # | What | Where |
|---|------|--------|
| 1 | Set live Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`) | Vercel env vars |
| 2 | Set `STRIPE_WEBHOOK_SECRET` from real endpoint | Vercel env vars (Stripe Dashboard → Webhooks) |
| 3 | Create live Stripe price IDs for all 8 tiers (BASIC/PRO/STUDIO/BUSINESS × monthly/annual) | Vercel env vars (after creating products in Stripe) |
| 4 | Configure Stripe Billing Portal (plan switching + proration) | Stripe Dashboard → Settings → Billing |. 
| 5 | Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | ✅ DONE — set in `.env` from Upstash console |
| 6 | Verify `GOOGLE_REDIRECT_URI=https://drivebook.com.au/api/calendar/callback` | Vercel env vars + Google Cloud Console |
| 7 | Set `NEXT_PUBLIC_VOICE_PHONE_NUMBER` with real AU number | Vercel env vars — AIReceptionistShowcase shows "coming soon" without it |
| 8 | Replace placeholder ABN on about page | One line in `app/about/page.tsx` |
| 9 | Run `npx prisma migrate deploy` on production DB | Terminal against production DB — includes DeviceToken + NotificationRetry models |
| 10 | Set `connection_limit=20` in `DATABASE_URL` | Vercel env vars — Prisma default is 5, causes queueing under load |
| 11 | Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Vercel env vars — required for mobile push notifications |
| 12 | Submit sitemap to Google Search Console | https://search.google.com/search-console → Sitemaps → `https://drivebook.com.au/sitemap.xml` |

---

## ✅ COMPLETED — SEO & Content Architecture

| What | Notes |
|------|-------|
| 100+ blog posts | Students + instructors, all with frontmatter, tags, JSON-LD |
| Tag archive pages (`/blog/tag/[tag]`) | Auto-generated from post tags |
| RSS feed (`/rss.xml`) | Auto-generated from all posts |
| Sitemap with blog + tag + instructor pages | Dynamic, regenerated hourly |
| JSON-LD on all blog posts | BreadcrumbList + BlogPosting |
| Related posts + prev/next navigation | On all blog post pages |
| Pillar page: `/learn-to-drive` | Learner hub — 40+ article links, FAQ schema |
| Pillar page: `/pda-guide` | WA PDA master guide — scoring, failures, prep |
| Pillar page: `/for-instructors` | Instructor resource hub — 60+ article links by topic |
| Pillar page: `/platform` | Platform documentation — all features explained with links |
| Sitemap updated with all 4 pillar pages | Priority 0.9 |
| Homepage footer updated with pillar page links | Internal linking from root |

---

## 🔵 PENDING CODE WORK

### Fix #5 — DB connection pool (5 min, config only)
Add `?connection_limit=20` to `DATABASE_URL` in Vercel env vars.

### Fix #6 — No tests (5–8 days)
Zero `*.test.ts` / `*.spec.ts` files. Add Jest. Priority: Stripe webhook → wallet deduction → booking creation → refund flow.

### Fix #8 — Voice AI conversation memory (2 days)
`voice-session-service.js` stores booking state but not OpenAI message history. Each utterance starts fresh.  
Fix: Store message history in Redis session keyed by `CallSid`.

### Fix #9 — AI hallucination prevention (3 days)
No output validation in any voice or AI route.  
Fix: Ground system prompt with live data at call start. Validate booking data against DB before confirming.

---

## 🔵 SEO PHASE 2 — Feature Landing Pages

| Page | Target query | Priority | Status |
|------|-------------|----------|--------|
| `/features/ai-receptionist` | "AI answering service driving school Australia" | HIGH | ✅ DONE |
| `/features/online-booking` | "driving lesson booking software Australia" | HIGH | ✅ DONE |
| `/features/custom-domain` | "driving instructor website Australia" | HIGH | ✅ DONE |
| `/features/student-progress` | "driving lesson progress tracker" | MED | ✅ DONE |
| `/features/multi-instructor` | "driving school management software" | MED | ✅ DONE |
| `/features/payments` | "driving lesson payment system" | MED | ✅ DONE |
| `/features/wallet` | "prepaid driving lesson wallet" | LOW | 🔵 Pending |
| `/features/packages` | "driving lesson packages" | LOW | 🔵 Pending |
| `/features/reviews` | "driving instructor reviews" | LOW | 🔵 Pending |
| `/features/offline-booking` | "record offline driving lesson bookings" | LOW | 🔵 Pending |

---

## 🔵 SEO PHASE 3 — Comparison Pages

| Page | Title | Status |
|------|-------|--------|
| `/compare/google-calendar` | DriveBook vs Google Calendar | ✅ DONE |
| `/compare/paper-diary` | DriveBook vs Paper Diary | ✅ DONE |
| `/compare/calendly` | DriveBook vs Calendly | ✅ DONE |
| `/compare/acuity` | DriveBook vs Acuity Scheduling | 🔵 Pending |
| `/compare/manual-booking` | Online Booking vs Manual Booking | 🔵 Pending |

---

## 🔵 SEO PHASE 4 — Location Pages (WA first, then national)

Each location page should include:
- Instructors available in that suburb/area (pulled from DB if approved)
- Average lesson cost in that area
- Nearby test centres
- Local FAQs
- CTA to book

### Perth Metro (Priority 1)
`/perth`, `/joondalup`, `/fremantle`, `/midland`, `/morley`, `/cannington`, `/armadale`, `/baldivis`, `/rockingham`, `/mandurah`, `/subiaco`, `/victoria-park`, `/belmont`, `/canning-vale`

### Regional WA (Priority 2)
`/bunbury`, `/albany`, `/geraldton`, `/kalgoorlie`, `/broome`

### Other States (Priority 3 — after WA established)
`/sydney`, `/melbourne`, `/brisbane`, `/adelaide`

**Implementation note:** Location pages should be server-rendered pulling live instructor data from DB. Use `generateStaticParams` with ISR revalidation.

---

## 🔵 SEO PHASE 5 — Documentation Centre (`/docs`)

Like Stripe Docs but for DriveBook. Builds deep topical authority on platform-specific queries.

Proposed articles:
- How to connect Stripe
- How AI phone booking works
- How weekly payouts are calculated
- How the student wallet works
- How refunds are processed
- How SMS notifications work
- How to set up Google Calendar sync
- How DNS works for custom domains
- How reviews are verified
- How the commission structure works

These answer questions that users and Google ask. Most competitors have nothing like this.

---

## 🔵 SEO PHASE 6 — Interactive Tools

Tools attract backlinks far more readily than articles. Each of these has genuine utility.

| Tool | Description | Effort |
|------|-------------|--------|
| Lesson cost calculator | Enter suburb + hours needed → estimated total cost | 2 days |
| Learner hours tracker | Log supervised hours, track toward 50-hour goal | 3 days |
| PDA readiness quiz | Answer questions → "ready / needs work / not ready" | 2 days |
| Package savings calculator | Compare pay-per-lesson vs package cost | 1 day |
| Instructor earnings calculator | Enter hourly rate + hours → weekly/monthly revenue | 1 day |
| Driving school revenue calculator | Instructors × lessons × rate → school revenue | 1 day |

**Implementation note:** Client-side React components. No DB required. Host at `/tools/[tool-name]`. Include schema markup.

---

## 🔵 DEFERRED — Post-Launch Product Work

| # | What | Notes | Effort |
|---|------|-------|--------|
| 1 | Chargeback automation | `charge.dispute.created` handler exists but no auto-freeze of instructor payout | 3 days |
| 2 | Payout recovery job | Stripe payout success + DB commit failure = PENDING with no recovery | 2 days |
| 3 | Instructor deleted before payout | No guard — payout goes to null instructorId | 1 day |
| 4 | Dashboard metrics — refunds not subtracted | `FinancialLedger` tracks refunds but dashboard SUM doesn't use it | 1 day |
| 5 | Denormalized summary table | Large `SUM(Transaction)` queries slow at scale | 3 days |
| 6 | Notification duplicate prevention | Two concurrent calls can fire two emails for same event | 2 days |
| 7 | Stripe balance ledger tracking | No endpoint to track available Stripe balance over time | 2 days |
| 8 | Rate limiting per-user vs per-IP | Currently IP only | 2 days |
| 9 | SOC 2 compliance | Zero framework in place | 10+ days |

---

## 🔵 BLOG — Ongoing (2–4 posts/month)

At 100 posts, quantity is no longer the priority. Maintain 2–4 high-quality posts per month covering:
- New platform features as they ship
- Australian state expansions (NSW, VIC road rules)
- Seasonal content (wet season driving, school holiday availability)
- Topical news (DoT rule changes, road safety campaigns)

Blog OG images, client-side search (Fuse.js), and pagination are deferred until 150+ posts.
