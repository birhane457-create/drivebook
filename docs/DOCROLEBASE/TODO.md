# TODO — Planned, Pending, and Deferred

**Rule:** This file tracks only what is NOT yet done. When an item is completed, remove it from here and record it in CHANGES.md or the permanent feature doc.  
**Last Updated:** August 2026

---

## 🔴 PRE-LAUNCH BLOCKERS — must be done before going live

| # | What | Where |
|---|------|--------|
| 1 | Set live Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`) | Vercel env vars |
| 2 | Set `STRIPE_WEBHOOK_SECRET` — use path `/api/stripe/webhook` ONLY. Remove `/api/subscriptions/webhook` from Stripe dashboard — it is retired. | Vercel env vars → Stripe Dashboard → Webhooks |
| 3 | Create live Stripe price IDs for all 8 tiers (BASIC/PRO/STUDIO/BUSINESS × monthly/annual) | Vercel env vars |
| 4 | Configure Stripe Billing Portal (plan switching + proration) | Stripe Dashboard → Settings → Billing |
| 6 | Verify `GOOGLE_REDIRECT_URI=https://drivebook.com.au/api/calendar/callback` | Vercel env vars + Google Cloud Console |
| 10 | Set `connection_limit=20` in `DATABASE_URL` | Vercel env vars |
| 11 | Set Firebase env vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) | Vercel env vars — required for mobile push |
| 12 | Submit sitemap to Google Search Console | search.google.com/search-console → Sitemaps |
| 13 | Set `VOICE_SERVICE_API_KEY` in Railway | Required for voice AI cancel flow without session auth |
| 14 | Refund 2 duplicate $129 charges for birhane457@gmail.com | Stripe Dashboard → `sub_1TvWkY` and `sub_1TvXkM` |
| 15 | Link correct `stripeSubscriptionId` for birhane457@gmail.com | `/admin/subscriptions` → instructor → Subscription tab → Link Stripe Sub |

---

## 🔧 PENDING CODE FIXES

### Document security

| # | Priority | Feature | Notes |
|---|---|---|---|
| DOC-1 | ✅ Done | **Signed URLs for private documents** | All document views (instructor + admin) now go through API endpoints that generate 5-min signed Cloudinary URLs. Raw URLs no longer returned to client. |
| DOC-2 | 🟡 MED | **LLM document scanning on upload** | After upload, send image to GPT-4o vision (server-side only). Extract `name`, `dob`, `licenceNumber`, `issueDate`, `expiryDate`. Store in `DocumentVerification` table. Admin sees extracted card — approve or flag. Cross-check extracted name/DOB against instructor profile. Schema needed: `DocumentVerification` model with `extractedName`, `extractedDob`, `extractedExpiry`, `extractedIssueDate`, `extractedLicenceNo`, `matchStatus` (`MATCH`/`MISMATCH`/`UNREADABLE`/`PENDING`), `flagReason`, `reviewedByAdminId`, `reviewedAt`. Never send extracted PII to client. Admin-only review UI. |

### Instructor search

| # | Priority | Feature | Notes |
|---|---|---|---|
| SEARCH-1 | ✅ Done | **Suburb-based search** | Instructors pick served suburbs from static AU data. Search matches by suburb/postcode — no maths. km radius kept as fallback for instructors without a suburb list. |
| SEARCH-2 | 🟢 LOW | **Road-distance filter** | Current radius uses air distance (Haversine). Consider Google Maps Distance Matrix API for route-accurate filtering. Cost ~$0.005/call — only viable at scale. Alternative: apply a 1.3× road factor multiplier to the radius threshold as a cheap approximation. |

### Timezone — national expansion readiness

| # | Priority | What | File | Notes |
|---|---|---|---|---|
| TZ-1 | ✅ Done | **Instructor timezone selector in Settings UI** | `app/dashboard/settings/page.tsx` | Dropdown added using `AU_TIMEZONES`. Saves to `Instructor.timezone` in DB. |
| TZ-2 | ✅ Done | **Availability service timezone** | `lib/services/availability.ts` | `parseTimeUTC()` now uses `localDateTimeToUTC` with instructor's stored timezone. Falls back to state-derived TZ, then Perth. |
| TZ-3 | ✅ Done | **Schedule page week view timezone** | `app/dashboard/schedule/page.tsx` | `toPerth()` replaced with `toLocal(dt, tz)`. All date helpers accept `tz` param. `bufferSettings.timezone` flows through WeekView, AgendaView, BookingCard. |
| TZ-4 | ✅ Done | **Booking confirmation email/SMS times** | `lib/services/email.ts`, `sms.ts`, `notifications.ts` | All functions accept optional `timezone` param defaulting to Perth. Existing call sites unaffected; new call sites can pass instructor's timezone. |

**Already timezone-aware (August 2026):**
- `app/api/bookings/offline/route.ts` — uses `localDateTimeToUTC` with instructor's stored timezone
- `components/instructor/OfflineEarningsSection.tsx` — accepts `timezone` prop, uses utility functions
- `app/dashboard/expenses/page.tsx` — fetches instructor timezone from settings API



| # | Priority | Issue | File | Notes |
|---|---|---|---|---|
| UX-2 | 🟢 | Availability page has no unsaved-changes warning | `app/dashboard/availability/page.tsx` | Deferred |

### Payout system

**Failed payout — no UI retry action**  
`Payout.status = 'FAILED'` records have no retry button in `/admin/payouts`. Admin must call `POST /api/admin/payouts/process` manually. Medium priority.

### Recommendations (do when touching relevant file)

| ID | File | What |
|---|---|---|
| R-02 | `app/api/admin/instructors/route.ts` | Use JWT role from session, not extra DB lookup |
| R-04 | `app/admin/settings/page.tsx` | Masked SMTP field shows `••••••••` even when env var is absent — show `—` instead |
| D-2 | `app/dashboard/profile/page.tsx` | Profile dual-request save — second request failure shows success UI |
| D-4 | Various admin pages | Second-confirmation step on high-impact financial actions |
| D-5 | Admin subscription routes | Rate limiting on subscription override mutations |

### Voice AI — production readiness (complete when declaring Voice AI live)

> The core platform can go live without these. Required only when activating the AI receptionist for production use.

| Item |
|---|
| Deploy: `git push gitlab main` (8 commits on `origin/main` not yet on Vercel) |
| Fix instructor address typo in DB — `baseAddress = "6/226 whatley Crescent Maylamds"` → fix via admin dashboard |
| Replace `0488 000 000` placeholder in VAPI prompt: set `SUPPORT_PHONE`/`SUPPORT_EMAIL` in Railway → run `node scripts/build-vapi-prompt.js` → re-upload to VAPI dashboard |
| Test `/set-password` flow end-to-end: call → book later → SMS → click link → set password |
| TTS: Adam (11Labs) mispronounces Eritrean names — consider Azure `en-AU-NatashaNeural` (low priority) |

---

## 🔒 SECURITY — Phase 2

| # | Priority | Feature | Notes |
|---|---|---|---|
| SEC-1 | ✅ Done | **New device verification code** | 6-digit email OTP required when instructor logs in from a new browser. OtpModal blocks navigation until confirmed. Known devices skip OTP. Non-instructor roles get notification email only (no gate). OTP rate-limited, HMAC-hashed, 5-min TTL. |
| SEC-2 | ✅ Done | **Recognised devices page** — `/dashboard/settings/security` | Built: list devices, remove individual, remove all others. |
| SEC-3 | 🟡 MED | **Force logout all devices** — revoke all sessions | Requires switching to database sessions (`strategy: 'database'`). Currently JWT-based — sessions expire at 7d max / 30min idle. |
| SEC-4 | 🟢 LOW | **Geo-location on device notification email** | Integrate `ip-api.com` free tier. `LoginDevice.location` field already in schema. |
| SEC-5 | 🟢 LOW | **Admin audit monitoring cron** — daily AuditLog review for suspicious patterns | Check >20 failed logins, unusual wallet credits, bank detail changes. Email admin summary. |
| SEC-6 | 🟢 LOW | **Cleanup old devices cron** | `cleanupOldDevices()` already written. Just needs a cron endpoint. |

---

## 🔵 DEFERRED FEATURES

### Data export — instructor self-serve UI
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
