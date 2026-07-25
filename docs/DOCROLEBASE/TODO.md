# TODO — Planned, Pending, and Deferred

**Rule:** This file tracks only what is NOT yet done.  
Completed work belongs in the permanent doc for that feature.  
**Last Updated:** July 2026

---

## 🔴 INSTRUCTOR DASHBOARD GAPS (2026-07-22 inspection)

Full register: `docs/DOCROLEBASE/03-instructor/DASH_GAPS.md`

**Batch 1 fixes — DONE** (BUG-1/2/3/4/5/6/7, DATA-1/2/3/4, UX-4 — see CHANGES.md)

**Remaining (next sprint):**

| # | Priority | Issue | File |
|---|---|---|---|
| MISSING-1 | 🟡 | `PayoutScheduleCard` component referenced in docs but not built | `components/instructor/` |
| MISSING-2 | 🟡 | `lesson-feedback/summary` route — verify exists or create | `app/api/instructor/lesson-feedback/` |
| UX-1 | 🟡 | Perth timezone hardcoded — add comment, plan multi-state support | Multiple files |
| UX-2 | 🟡 | Availability page has no unsaved-changes warning | `app/dashboard/availability/page.tsx` |
| TECH-2 | 🟡 | Whiteboard API route — verify exists | `app/api/instructor/whiteboard/` |
| TECH-3 | 🟡 | `client-lesson-feedback` + `client-performance` routes — verify shape | `app/api/instructor/` |

> **TECH-1 (`prisma as any` + stale client) — DONE.** `npx prisma generate` run. `(prisma as any).transaction` and 40+ other in-schema casts removed across the codebase. Remaining `(prisma as any)` casts are documented custom tables not in schema.prisma.

---

## ⚠️ PRE-LAUNCH CONFIG (no code changes needed)

| # | What | Where |
|---|------|--------|
| 1 | Set live Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`) | Vercel env vars |
| 2 | Set `STRIPE_WEBHOOK_SECRET` — use path `/api/stripe/webhook` ONLY. Remove `/api/subscriptions/webhook` from Stripe dashboard if listed — it is retired. | Vercel env vars → Stripe Dashboard → Webhooks |
| 3 | Create live Stripe price IDs for all 8 tiers (BASIC/PRO/STUDIO/BUSINESS × monthly/annual) | Vercel env vars |
| 4 | Configure Stripe Billing Portal (plan switching + proration) | Stripe Dashboard → Settings → Billing |
| 5 | Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | ✅ Done |
| 6 | Verify `GOOGLE_REDIRECT_URI=https://drivebook.com.au/api/calendar/callback` | Vercel env vars + Google Cloud Console |
| 7 | Set `NEXT_PUBLIC_VOICE_PHONE_NUMBER` with real AU number | Vercel env vars |
| 8 | Replace placeholder ABN on about page | `app/about/page.tsx` — one line |
| 9 | `npx prisma migrate deploy` on production DB (includes new `studioCommissionRate` migration) | ✅ Pushed 2026-07-21 |
| 10 | Set `connection_limit=20` in `DATABASE_URL` | Vercel env vars |
| 11 | Set Firebase env vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) | Vercel env vars — required for mobile push |
| 12 | Submit sitemap to Google Search Console | search.google.com/search-console → Sitemaps |
| 13 | Set `VOICE_SERVICE_API_KEY` in Railway | Required for voice AI cancel flow without session auth |
| 14 | Refund 2 duplicate $129 charges for birhane457@gmail.com | Stripe Dashboard → find duplicate `sub_1TvWkY` and `sub_1TvXkM` payments, refund 2 of the 3 |
| 15 | Link correct `stripeSubscriptionId` for birhane457@gmail.com | `/admin/subscriptions` → find instructor → Subscription tab → Link Stripe Sub |

---

## 🔧 PENDING CODE FIXES

### Booking flow — remaining gaps

**Bug 5 — By design (not a bug):** Only the first scheduled lesson creates a `Booking` DB row. Multiple slots in one package — remaining are stored as `packageHoursRemaining`. Students schedule remaining hours from their client dashboard post-payment. This is intentional.

### Payout system — remaining gaps

**Bank account masking — no reveal endpoint**
The admin payout list masks bank accounts as `****XXX`. A comment in the code says "full details available via explicit reveal action" but no reveal endpoint exists. Admin must go to the DB directly to get the full BSB/account for a manual transfer. Low priority.

**Failed payout — no UI retry action**
`Payout.status = 'FAILED'` records appear in the summary stats but there's no tab or button to retry them from `/admin/payouts`. Admin must call `POST /api/admin/payouts/process` manually. Medium priority.

**Governance payout thresholds — policy only, not enforced in code**
`lib/config/governance.ts` defines `PAYOUT_APPROVAL_THRESHOLDS` ($200/$1000) but neither `process/route.ts` nor `process-all/route.ts` checks them. Any ADMIN can process any amount. SUPER_ADMIN approval for large payouts is a manual policy, not a code gate. Low priority.

### Expiry columns backfill — existing records
The expiry DateTime columns (`licenseExpiry`, `insuranceExpiry`, `policeCheckExpiry`, `wwcCheckExpiry`) were never written to before 2026-07-22. All expiry data is in `workingHours.expiry` JSON. New saves write to both. A one-time backfill SQL would sync old records into the real columns. **Not a release blocker.**

```sql
-- One-time backfill (run when convenient, not urgent)
UPDATE "Instructor"
SET
  "licenseExpiry"    = (("workingHours"->>'expiry')::jsonb->>'licenseExpiry')::timestamptz,
  "insuranceExpiry"  = (("workingHours"->>'expiry')::jsonb->>'insuranceExpiry')::timestamptz,
  "policeCheckExpiry"= (("workingHours"->>'expiry')::jsonb->>'policeCheckExpiry')::timestamptz,
  "wwcCheckExpiry"   = (("workingHours"->>'expiry')::jsonb->>'wwcCheckExpiry')::timestamptz
WHERE
  "workingHours" IS NOT NULL
  AND ("workingHours"->>'expiry') IS NOT NULL
  AND "licenseExpiry" IS NULL;
```

### Booking flow — max date hardcoded to 3 months
`components/BookingDetailsForm.tsx` uses `maxDate.setMonth(maxDate.getMonth() + 3)`. Should use platform config `bookingSettings.maxAdvanceDays`. Deferred — not a release blocker.

### Voice AI — deploy to Vercel production
8 commits on `origin/main` not yet on `gitlab/main` → Vercel. Run: `git push gitlab main`.

### Voice AI — instructor address typo in DB
`DEBESAY WELDEGEBRIEL BIRHANE` has `baseAddress = "6/226 whatley Crescent Maylamds"`. Fix via admin dashboard — will auto-resolve on next settings save.

### Voice AI — replace support phone placeholder
`drivebook-hybrid/VAPI_SYSTEM_PROMPT.md` has `0488 000 000` placeholder. Steps:
1. Set `SUPPORT_PHONE` and `SUPPORT_EMAIL` in Railway env vars for the drivebook-hybrid service
2. Run `node scripts/build-vapi-prompt.js` in `drivebook-hybrid/` to generate `VAPI_SYSTEM_PROMPT.built.md`
3. Copy the built file content and upload to VAPI dashboard as the system prompt

### Voice AI — TTS voice quality
Adam (11Labs) mispronounces Eritrean names. Consider Azure `en-AU-NatashaNeural`. Low priority.

### Voice AI — test `/set-password` flow
Test: call → book later → receive SMS → click link → correct email → set password.

### Post-audit deferred — architecture work
These were identified in the July 2026 audit as real but require larger refactors:

| # | What | Why deferred |
|---|------|---|
| D-1 | Unified booking lifecycle service — public/instructor/admin/student all share one state machine | Major refactor, all paths are individually idempotent for now |
| D-2 | Profile/settings dual-request save — second request failure leaves partial state | UX resilience; both requests independently succeed most of the time |
| D-3 | Student dashboard client-side degraded states | Acceptable for lightweight UI; not a data integrity risk |
| D-4 | Second-confirmation step on high-impact admin actions | UX improvement; existing audit trail is adequate for launch |
| D-5 | Rate limiting on subscription override mutations | Defense-in-depth; admin-only route, audit log exists |

---

## 🔵 DEFERRED FEATURES

### Data export — instructor/student UI
Admin CSV export is built (`GET /api/admin/export`). Instructor self-serve export (`Settings → Data → Export`) not built.

### Vehicle model (Sprint 5)
Defer until Business dashboard. See `03-instructor/SCHEDULE.md` → "What Is NOT Built" for full scope.

### Student progress tracking
Needs product design and schema work. Marketing claims "skill tracking" — current implementation is lesson notes only.

### Mobile app publication
Capacitor shell exists. Not published to App Store or Google Play.

### Tests
Zero `*.test.ts` files. Priority order: Stripe webhook → wallet deduction → booking creation → refund flow.

---

## 🔵 SEO — PENDING

### Feature pages (LOW priority)
`/features/wallet`, `/features/packages`, `/features/reviews`, `/features/offline-booking`

### Comparison pages (LOW priority)
`/compare/acuity`, `/compare/manual-booking`

### SEO Phase 5 — Documentation centre `/docs`
Articles explaining platform internals (how payouts work, how AI booking works, etc.)

### SEO Phase 6 — Interactive tools
Lesson cost calculator, PDA readiness quiz, package savings calculator. Client-side React, no DB.

---

## 🔵 POST-LAUNCH PRODUCT WORK

| # | What | Effort |
|---|------|--------|
| 1 | Chargeback auto-freeze of instructor payout | 3 days |
| 2 | Payout recovery job (DB commit failure after Stripe success) | 2 days |
| 3 | Guard: instructor deleted before payout | 1 day |
| 4 | Dashboard revenue: subtract refunds from displayed totals | 1 day |
| 5 | Denormalized summary table for analytics at scale | 3 days |
| 6 | Notification deduplication (concurrent double-send) | 2 days |
| 7 | Stripe balance ledger over time | 2 days |
| 8 | SOC 2 compliance framework | 10+ days |

---

## 🔵 SCHEDULING — NEXT SPRINT

### Sprint 5 — Vehicle Model
See `03-instructor/SCHEDULE.md` → "What Is NOT Built" for full scope. Defer until Business dashboard feature set is designed.

---

## 🔵 BLOG

Maintain 2–4 posts/month. Topics: new features, state expansions, seasonal content, DoT rule changes.
OG images, Fuse.js search, and pagination deferred until 150+ posts.
