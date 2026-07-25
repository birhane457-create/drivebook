# TODO — Planned, Pending, and Deferred

**Rule:** This file tracks only what is NOT yet done.  
Completed work belongs in the permanent doc for that feature.  
**Last Updated:** July 2026

---

## 🔴 PRE-LAUNCH BLOCKERS — must be done before going live

### ⚠️ Pre-launch config (no code changes needed)

| # | What | Where |
|---|------|--------|
| 1 | Set live Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`) | Vercel env vars |
| 2 | Set `STRIPE_WEBHOOK_SECRET` — use path `/api/stripe/webhook` ONLY. Remove `/api/subscriptions/webhook` from Stripe dashboard — it is retired. | Vercel env vars → Stripe Dashboard → Webhooks |
| 3 | Create live Stripe price IDs for all 8 tiers (BASIC/PRO/STUDIO/BUSINESS × monthly/annual) | Vercel env vars |
| 4 | Configure Stripe Billing Portal (plan switching + proration) | Stripe Dashboard → Settings → Billing |
| 5 | Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | ✅ Done |
| 6 | Verify `GOOGLE_REDIRECT_URI=https://drivebook.com.au/api/calendar/callback` | Vercel env vars + Google Cloud Console |
| 7 | Set `NEXT_PUBLIC_VOICE_PHONE_NUMBER` with real AU number | Vercel env vars |
| 8 | Replace placeholder ABN on about page | `app/about/page.tsx` — one line |
| 9 | `npx prisma migrate deploy` on production DB | ✅ Pushed 2026-07-21 |
| 10 | Set `connection_limit=20` in `DATABASE_URL` | Vercel env vars |
| 11 | Set Firebase env vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) | Vercel env vars — required for mobile push |
| 12 | Submit sitemap to Google Search Console | search.google.com/search-console → Sitemaps |
| 13 | Set `VOICE_SERVICE_API_KEY` in Railway | Required for voice AI cancel flow without session auth |
| 14 | Refund 2 duplicate $129 charges for birhane457@gmail.com | Stripe Dashboard → `sub_1TvWkY` and `sub_1TvXkM` |
| 15 | Link correct `stripeSubscriptionId` for birhane457@gmail.com | `/admin/subscriptions` → instructor → Subscription tab → Link Stripe Sub |

---

## 🔧 PENDING CODE FIXES

### Instructor dashboard — remaining gaps

| # | Priority | Issue | File | Notes |
|---|---|---|---|---|
| UX-2 | 🟢 | Availability page has no unsaved-changes warning | `app/dashboard/availability/page.tsx` | Deferred |

> All other DASH_GAPS items confirmed resolved:
> - **UX-1** (Perth TZ comments) ✅ — multi-state expansion notes added to `dashboard/page.tsx`, `dashboard/schedule/page.tsx`, `lib/services/notifications.ts`
> - **C-07** (staff tasks `alert()`) ✅ — replaced with `createError` inline state + `role="alert"`
> - **MISSING-1** (`EarningsThisWeekCard`) ✅ — that IS the week earnings card already on the dashboard  
> - **MISSING-2** (`lesson-feedback/summary`) ✅ — route exists and is fully implemented  
> - **TECH-2** (whiteboard route) ✅ — `app/api/instructor/whiteboard/upload/route.ts` exists, uploads to Cloudinary  
> - **TECH-3** (`client-lesson-feedback` + `client-performance`) ✅ — both routes exist and return correct shape

### Booking flow — remaining gaps

**Bug 5 — By design (not a bug):** Package bookings — remaining hours stored as `packageHoursRemaining`. Students schedule remaining hours from dashboard. Intentional.

### Payout system — remaining gaps

**Bank account masking — no reveal endpoint**
`bankBsb` is masked in list table display (`•••-XXX`). Full BSB is only visible in MarkSentModal confirm flow. No server-side reveal endpoint exists — admin must use DB directly for full account details. Low priority.

**Failed payout — no UI retry action**
`Payout.status = 'FAILED'` records have no retry button in `/admin/payouts`. Admin must call `POST /api/admin/payouts/process` manually. Medium priority.

**Governance payout thresholds — policy only, not enforced in code**
`lib/config/governance.ts` defines `PAYOUT_APPROVAL_THRESHOLDS` but payout routes don't check them. Manual policy only. Low priority.

### Remaining `alert()` calls (not release blockers — internal/low-traffic pages)

| File | Calls | Priority |
|---|---|---|
| `app/staff/tasks/[id]/page.tsx` | 2 × `alert()` on task creation failure | 🟢 Low — staff internal |

### Booking flow — max date hardcoded to 3 months
`components/BookingDetailsForm.tsx` — `maxDate.setMonth(maxDate.getMonth() + 3)`. Should read from `bookingSettings.maxAdvanceDays`. Deferred — current business rule is 3 months.

### Expiry columns backfill — existing records
Expiry data for pre-July-2026 instructor records is in `workingHours.expiry` JSON, not the real columns. New saves write to both. Not a release blocker.

```sql
-- One-time backfill (run when convenient)
UPDATE "Instructor"
SET
  "licenseExpiry"    = (("workingHours"->>'expiry')::jsonb->>'licenseExpiry')::timestamptz,
  "insuranceExpiry"  = (("workingHours"->>'expiry')::jsonb->>'insuranceExpiry')::timestamptz,
  "policeCheckExpiry"= (("workingHours"->>'expiry')::jsonb->>'policeCheckExpiry')::timestamptz,
  "wwcCheckExpiry"   = (("workingHours"->>'expiry')::jsonb->>'wwcCheckExpiry')::timestamptz
WHERE "workingHours" IS NOT NULL
  AND ("workingHours"->>'expiry') IS NOT NULL
  AND "licenseExpiry" IS NULL;
```

### Recommendations (do when touching relevant file)

| ID | File | What |
|---|---|---|
| R-02 | `app/api/admin/instructors/route.ts` | Use JWT role from session, not extra DB lookup |
| R-04 | `app/admin/settings/page.tsx` | Masked SMTP field shows `••••••••` even when env var is absent — show `—` instead |
| D-2 | `app/dashboard/profile/page.tsx` | Profile dual-request save — second request failure shows success UI |
| D-4 | Various admin pages | Second-confirmation step on high-impact financial actions |
| D-5 | Admin subscription routes | Rate limiting on subscription override mutations |

### Voice AI — production readiness (complete when declaring Voice AI live)

> The core platform can go live without these. These are required only when activating the AI receptionist for production use.

| Item |
|---|
| Deploy: `git push gitlab main` (8 commits on `origin/main` not yet on Vercel) |
| Fix instructor address typo in DB — `baseAddress = "6/226 whatley Crescent Maylamds"` → fix via admin dashboard |
| Replace `0488 000 000` placeholder in VAPI prompt: set `SUPPORT_PHONE`/`SUPPORT_EMAIL` in Railway → run `node scripts/build-vapi-prompt.js` → re-upload to VAPI dashboard |
| Test `/set-password` flow end-to-end: call → book later → SMS → click link → set password |
| TTS: Adam (11Labs) mispronounces Eritrean names — consider Azure `en-AU-NatashaNeural` (low priority) |

---

## 🔵 DEFERRED FEATURES

### Data export — instructor/student UI
Admin CSV export is built. Instructor self-serve export not built.

### Vehicle model (Sprint 5)
Defer until Business dashboard. See `03-instructor/SCHEDULE.md`.

### Student progress tracking
Needs product design + schema work. Current implementation is lesson notes only.

### Mobile app publication
Capacitor shell exists. Not published to App Store or Google Play.

### Tests
Zero `*.test.ts` files. Priority order: Stripe webhook → wallet deduction → booking creation → refund flow.

---

## 🔵 SEO — PENDING

- Feature pages: `/features/wallet`, `/features/packages`, `/features/reviews`, `/features/offline-booking`
- Comparison pages: `/compare/acuity`, `/compare/manual-booking`
- SEO Phase 5 — Documentation centre `/docs`
- SEO Phase 6 — Interactive tools (lesson cost calculator, PDA quiz, package savings calculator)

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
| 9 | Unified booking lifecycle service (single state machine for all flows) | 5+ days |
| 10 | Student dashboard partial-failure degraded states | 2 days |

---

## 🔵 BLOG

Maintain 2–4 posts/month. Topics: new features, state expansions, seasonal content, DoT rule changes.
OG images, Fuse.js search, and pagination deferred until 150+ posts.
