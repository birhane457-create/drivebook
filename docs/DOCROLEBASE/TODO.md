# TODO — Planned, Pending, and Deferred

**Rule:** This file tracks only what is NOT yet done.  
Completed work belongs in the permanent doc for that feature.  
**Last Updated:** July 2026

> Completed audit items have been moved to their permanent docs:
> - Instructor dashboard fixes → `03-instructor/DASHBOARD.md` + `INSPECTION.md`
> - Booking flow fixes → `01-public/BOOKING_FLOW_COMPLETE.md` + `06-payments/SECURITY_ISSUES_QUICK_REFERENCE.md`
> - Student dashboard fixes → `02-student/DASHBOARD.md` + `INSPECTION.md`
> - All resolved gaps → `00-overview/GAP_ANALYSIS.md` (Resolved section)
> - Change log → `00-overview/CHANGES.md`

---

## ⚠️ PRE-LAUNCH CONFIG (no code changes needed)

| # | What | Where |
|---|------|--------|
| 1 | Set live Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`) | Vercel env vars |
| 2 | Set `STRIPE_WEBHOOK_SECRET` — use path `/api/stripe/webhook` | Vercel env vars → Stripe Dashboard → Webhooks |
| 3 | Create live Stripe price IDs for all 8 tiers (BASIC/PRO/STUDIO/BUSINESS × monthly/annual) | Vercel env vars |
| 4 | Configure Stripe Billing Portal (plan switching + proration) | Stripe Dashboard → Settings → Billing |
| 5 | Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | ✅ Done |
| 6 | Verify `GOOGLE_REDIRECT_URI=https://drivebook.com.au/api/calendar/callback` | Vercel env vars + Google Cloud Console |
| 7 | Set `NEXT_PUBLIC_VOICE_PHONE_NUMBER` with real AU number | Vercel env vars |
| 8 | Replace placeholder ABN on about page | `app/about/page.tsx` — one line |
| 9 | `npx prisma migrate deploy` on production DB | ✅ Done July 2026 |
| 10 | Set `connection_limit=20` in `DATABASE_URL` | Vercel env vars |
| 11 | Set Firebase env vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) | Vercel env vars — required for mobile push |
| 12 | Submit sitemap to Google Search Console | search.google.com/search-console → Sitemaps |
| 13 | Set `VOICE_SERVICE_API_KEY` in Railway | Required for voice AI cancel flow without session auth |

---

## 🔧 PENDING CODE FIXES

### Instructor earnings — hardcoded commission fallback
`app/api/instructor/earnings/route.ts` falls back to `price * 0.9` when `instructorPayout` is 0. Should use `booking.commissionRate` instead. Low priority — only affects old bookings.

### Admin — `confirm()` and `alert()` in admin UI (July 2026)
Several admin pages still use browser dialogs. These are lower priority than student/booking flows (admin is internal) but should be replaced before production.

| # | Priority | Issue | File | Status |
|---|----------|-------|------|--------|
| A1 | 🟠 High | `confirm()` on process payout + hold payout (financial actions) | `app/admin/payouts/page.tsx` | ✅ Fixed July 2026 |
| A2 | 🟠 High | `confirm()` on approve instructor, deduct wallet, reset password in support; `prompt()` on suspend | `app/admin/support/user/[userId]/page.tsx` | ✅ Fixed July 2026 |
| A3 | 🟡 Medium | `alert()` + `confirm()` on cancel booking in edit page | `app/admin/bookings/[id]/edit/page.tsx` | ✅ Fixed July 2026 |
| A4 | 🟡 Medium | `confirm()` on cancel/complete/delete booking in client detail | `app/admin/clients/[id]/page.tsx` | ✅ Fixed July 2026 |
| A5 | 🟡 Medium | `confirm()` on deactivate instructor + auto-process in documents | `app/admin/documents/page.tsx`, `documents/review/[instructorId]/page.tsx` | ✅ Fixed July 2026 |
| A6 | 🟡 Medium | `confirm()` on delete voice line number | `app/admin/voice-lines/page.tsx` | ✅ Fixed July 2026 |
| A7 | 🟡 Medium | `alert()` on release hold failure in disputes page | `app/admin/disputes/page.tsx` | ✅ Fixed July 2026 |
| A8 | 🟢 Low | Encoding artifacts (â€¢, â€") in admin/settings/page.tsx JSX strings | `app/admin/settings/page.tsx` | ✅ Fixed July 2026 |

> All 8 admin UI issues resolved. Admin inspection complete.

### Booking flow — max date hardcoded to 3 months
`components/BookingDetailsForm.tsx` uses `maxDate.setMonth(maxDate.getMonth() + 3)`. Should use platform config `bookingSettings.maxAdvanceDays`. Deferred — not a release blocker, current business rule is 3 months.

### Student confirmation page — `force-dynamic` on client component
`app/booking/[id]/confirmation/page.tsx` line 3: `export const dynamic = 'force-dynamic'` is a no-op on a `'use client'` component. Cosmetic only, no runtime impact.

### Voice AI — deploy to Vercel production
8 commits on `origin/main` not yet on `gitlab/main` → Vercel. Run: `git push gitlab main`.

### Voice AI — instructor address typo in DB
`DEBESAY WELDEGEBRIEL BIRHANE` has `baseAddress = "6/226 whatley Crescent Maylamds"`. Fix via admin dashboard — will auto-resolve on next settings save.

### Voice AI — replace support phone placeholder
`drivebook-hybrid/VAPI_SYSTEM_PROMPT.md` has `0488 000 000`. Run `node scripts/build-vapi-prompt.js` after setting real `SUPPORT_PHONE` in env.

### Voice AI — TTS voice quality
Adam (11Labs) mispronounces Eritrean names. Consider Azure `en-AU-NatashaNeural`. Low priority.

### Voice AI — test `/set-password` flow
Test: call → book later → receive SMS → click link → correct email → set password.

---

## 🔵 DEFERRED FEATURES

### Data export — instructor/student UI
Admin CSV export is built (`GET /api/admin/export`). Instructor self-serve export (`Settings → Data → Export`) not built. Blog post `can-i-export-my-students-drivebook.mdx` stays `draft: true` until done.

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

### Other states — location pages
NSW/VIC/QLD/SA pages exist and are in sitemap. They show "coming soon" until instructors register in those states. No action needed.

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
