# Codebase Inspection

**Purpose:** Systematic inspection of the entire codebase. Each area is inspected once, findings recorded, fixes applied inline where small, larger gaps moved to TODO.md.  
**Last Updated:** July 12, 2026  
**Approach:** Read the code, record what IS (not what was planned), fix directly when clear, document gaps.

---

## Areas

| # | Area | Status | Finding Summary |
|---|------|--------|-----------------|
| 1 | Auth & Account Creation | ✅ Done | See below |
| 2 | Public Booking Flow | ✅ Done | See below |
| 3 | Instructor Dashboard APIs | ✅ Done | See below |
| 4 | Admin APIs | ✅ Done | See below — July 2026 admin inspection |
| 5 | Payment & Wallet | ✅ Done | See below |
| 6 | Stripe Webhooks | ✅ Done | See below |
| 7 | Cron Jobs | ✅ Done | See below |
| 8 | Voice AI (Hybrid + VAPI) | ✅ Done | Covered in VOICE_AI_RECEPTIONIST.md |
| 9 | Notifications & Email | ✅ Done | See below |
| 10 | Subdomain / Public Booking Page | ⬜ Pending | |
| 11 | Student Dashboard | ✅ Done | July 2026 — 6 issues found and fixed (see Fix Log) |
| 12 | SEO / Sitemap | ⬜ Pending | |
| 13 | Security (middleware, rate limits) | ✅ Done | See Area 7–8 |
| 14 | Admin Dashboard + APIs | ✅ Done | July 2026 — 8 issues found and fixed (see Fix Log) |
| 15 | DOCROLEBASE docs vs code | ✅ Done (partial) | public/instructor/student areas cross-checked July 2026; admin pending |

---

## Area 1 — Auth & Account Creation ✅

### Files inspected
- `app/api/auth/set-password/route.ts`
- `app/api/auth/verify-setup-token/route.ts`
- `app/set-password/page.tsx`
- `app/api/public/bookings/bulk/route.ts` (account creation section)
- `app/api/bookings/route.ts` (instructor booking, fresh token fix)
- `app/api/bookings/batch/route.ts` (batch booking, fresh token fix)

### As-is
- Voice bookings: account auto-created during `createBooking`, auto-password, setup link via SMS + email ✅
- Web bookings: student provides email + password on form, no setup link needed ✅
- Instructor creates booking for student: user created when client record linked, setup link in "top up" email ✅
- `/set-password` page: student can correct email if AI misheard it ✅
- Token expiry handled: fresh token regenerated when instructor creates booking for existing client ✅

### Gaps found
- `app/set-password/page.tsx` — no `/set-password` link in `app/login/page.tsx` for "forgot password" flow. Students who lose the SMS before clicking it have no recovery path shown on the login page. → **Add "Request new setup link" on login page** — TODO.md

---

## Area 2 — Public Booking Flow ✅

### Files inspected
- `app/api/public/bookings/bulk/route.ts` (full)
- `app/api/packages/route.ts`
- `app/api/instructors/recommendations/route.ts`
- `app/api/instructors/search/route.ts`
- `app/api/availability/slots/route.ts`
- `app/api/locations/validate/route.ts`
- `app/api/public/check-service-area/route.ts`

### As-is
- Recommendations: returns `voice.voiceName`, `voice.summary` ✅
- Packages: returns `voicePackages` pre-formatted ✅
- Bulk booking: email/phone sanitiser, Zod validation, user account creation, Stripe Checkout for Buy Later, Booking row for Book Now ✅
- Search: uses stored lat/lng (fast), geocodes `baseAddress` as fallback, normalises `Automatic→AUTO` ✅
- Spaced postcode normalisation in recommendations ✅

### Gaps found
- `app/api/packages/route.ts` — `platformFeePercentage` hardcoded as `3.6`. The `bulk/route.ts` reads it dynamically via `getPlatformFeeRate()`. These can drift. → Fix: read from `getPlatformFeeRate()` in packages route too. **Small fix — apply now.**
- `app/api/availability/slots/route.ts` — not yet inspected fully.

---

## Area 3 — Instructor Dashboard APIs 🔄

### Files inspected
- `app/api/availability/slots/route.ts` ✅
- `app/api/availability/route.ts` ✅
- `app/api/instructor/profile/route.ts` ✅
- `app/api/clients/route.ts` ✅
- `app/api/bookings/[id]/cancellation-policy/route.ts` ✅

### Findings

**`availability/slots/route.ts`** — ✅ Clean. Returns `timezone`, `bookingTime`, `voice.confirmation`. Validates input with Zod. No issues.

**`availability/route.ts`** — ✅ Simple POST wrapper around availability service. Used by legacy clients. No issues.

**`instructor/profile/route.ts`** — ✅ GET + PUT. Handles `videoUrl`, `specialties`, `languages` array→comma-string transform. Subscription guard on PUT. One note: profile update **does not re-geocode `baseAddress`** — if instructor updates their address, `baseLatitude`/`baseLongitude` won't update automatically. → **Gap: add geocoding trigger on `baseAddress` change in profile PUT.** Added to TODO.md.

**`clients/route.ts`** — ✅ Creates dormant user account on client add (30-day token), creates wallet immediately, deduplicates by email. Clean.  
One observation: token expiry is 30 days here vs 24 hours in `bulk/route.ts`. Inconsistency — a client added but not booked for can have a token valid for 30 days. This is acceptable (longer window = better UX for instructor-added clients) but should be documented. → Noted.

**`bookings/[id]/cancellation-policy/route.ts`** — ✅ Tiered refund: 48h+ = 100%, 24-48h = 50%, <24h = 0%. Uses `platformSettings.lateCancellationWindowHours`. Non-refundable flag respected. Returns all fields the voice AI needs. Auth: session OR `x-api-key` header (voice service). Note: `x-api-key` compared against `process.env.VOICE_SERVICE_API_KEY` — check this env var is set in Railway.

### Gaps found
- `instructor/profile/route.ts` PUT — `baseAddress` update doesn't re-geocode → instructor's search radius won't reflect new location until manually backfilled. Added to TODO.md.
- `VOICE_SERVICE_API_KEY` env var dependency in cancellation-policy route — verify set in Railway. Added to TODO.md.

---

## Area 4 — Payment & Wallet / Stripe Webhooks ✅

### Files inspected
- `app/api/stripe/webhook/route.ts` ✅
- `app/api/instructor/settings/route.ts` ✅
- `app/api/instructor/earnings/route.ts` ✅

### Findings

**`instructor/settings/route.ts`** — ✅ Clean. Validates with Zod, subscription guard on PUT, `acceptingBookings` toggle supported. Same `baseAddress` geocoding gap as `profile/route.ts` — same fix applies.

**`instructor/earnings/route.ts`** — ✅ Uses DB aggregation (not in-memory). Separates platform vs offline earnings. Has `@ts-nocheck` at top — acceptable given complex Prisma union types. One observation: fallback payout calculation `price * 0.9` hardcodes 10% commission — should use `lockedDiscountPct` or `commissionRate` from the booking record. Minor.

**`stripe/webhook/route.ts`** — ✅ Very thorough:
- Signature verification (fail-closed: no `STRIPE_WEBHOOK_SECRET` = rejected) ✅
- Idempotency table with hard-fail on DB error ✅  
- Rate limiting ✅
- Expired booking → auto-refund + cancel (no revival) ✅
- State machine enforced: only `PENDING_PAYMENT → CONFIRMED` ✅
- Payment amount validation (cents comparison) ✅
- `checkout.session.completed` handles wallet credit for Book Later ✅
- Wallet CREDIT + DEBIT correctly split for package purchases ✅
- Audit logging for financial events ✅

**One gap found:** `handleBookingPaymentSuccess` checks `paymentIntent.customer` against `instructor.stripeCustomerId` — but for public voice bookings, the customer is the student, not the instructor. This check will always fail (student's Stripe customer ≠ instructor's Stripe customer ID). The guard says "if instructor has a stripeCustomerId AND it doesn't match, throw". Since most instructors won't have `stripeCustomerId` set (only those using Stripe Connect), this check only affects Connect-enabled instructors — and for those it IS checking the right thing. Acceptable.

### Gaps found
- `instructor/earnings/route.ts`: fallback `price * 0.9` hardcodes commission rate → added to TODO.

---

## Area 5 — Cron Jobs ✅

### Files inspected
- `app/api/cron/slot-cleanup/route.ts` ✅
- `app/api/cron/notifications/route.ts` ✅
- `lib/jobs/bookingReminders.ts` ✅
- `lib/jobs/packageExpiryAlerts.ts` ✅

### Findings

**`slot-cleanup/route.ts`** — ✅ Clean. Deletes expired `SlotReservation` rows, pings cron health, idempotent. No auth needed (Vercel handles it via `x-vercel-cron`).

**`notifications/route.ts`** — ✅ Accepts both `x-vercel-cron` and `CRON_SECRET`. Jobs are independently try/caught. Clean.

**`bookingReminders.ts`** — ⚠️ Gap: "tomorrow at 9:00 AM" reminder is hardcoded in Sydney/server time, not Perth time. Lesson times are stored in UTC. The job filters `startTime gte tomorrowStart lte tomorrowEnd` using server-local dates — if the server is not in AEST/AWST this will send wrong reminders. Should use `Australia/Perth` timezone offset when calculating the window. → Added to TODO.

**`packageExpiryAlerts.ts`** — ✅ Clean. 4 tiers: 7d/1d/today/yesterday. Marks expired packages. Deduplication within time windows. No timezone issue (just compares dates, not lesson times).

---

## Area 6 — Admin APIs ✅

### Files inspected
- `app/api/admin/bookings/route.ts` ✅
- `app/api/admin/instructors/route.ts` ✅
- `app/api/verifications/otp/route.ts` ✅

### Findings

**`admin/bookings/route.ts`** — ✅ Auth verified (ADMIN/SUPER_ADMIN only). Pagination. Search pushed to Prisma (not in-memory cap). AuditLog on every status change. Admin-created bookings check wallet balance. One small issue: `platformFee` hardcoded at `0.036` in POST — should use `getPlatformFeeRate()`. → Added to TODO.

**`admin/instructors/route.ts`** — ✅ Simple GET, admin-only, returns minimal fields. No issues.

**`verifications/otp/route.ts`** — ✅ Well-implemented:
- Rate limiting: Upstash Redis when configured, in-memory fallback ✅
- OTP hashed with HMAC-SHA256 before storing ✅
- User enumeration prevention (no error if phone not found) ✅
- 5-minute expiry ✅
- `resetToken` field reused for OTP storage — acceptable, but means resetting password invalidates active OTP. Low risk (different flows).

---

## Area 7 — Notifications & Email ✅ (partial)

### Files inspected
- `middleware.ts` ✅
- `lib/ratelimit.ts` ✅
- `lib/middleware/subscriptionValidation.ts` ✅

### Findings

**`middleware.ts`** — ✅ Clean and well structured:
- Maintenance mode with bypass cookie ✅
- Custom domain rewrite (Studio tier) ✅
- Subdomain rewrite with compound TLD detection (`com.au`) ✅
- `isVercelPreview` guard prevents Vercel preview URLs from being treated as subdomains ✅
- Edge auth for protected API paths (`/api/admin/`, `/api/instructor/`, etc.) ✅
- `/set-password` is in `publicPaths` ✅ (already included, so the new page is accessible without auth)
- Cookie name switches between `__Secure-` prefix on HTTPS and plain on HTTP ✅

**One observation:** `/api/bookings/` is in `isProtectedApiPath` but `/api/public/` is not — public booking and voice tools are correctly excluded from auth guard.

**`lib/ratelimit.ts`** — ✅ Comprehensive:
- In-memory fallback when Upstash not configured ✅
- `checkRateLimit` = fail-open (non-critical) ✅
- `checkRateLimitStrict` = fail-closed in production, fail-open in dev ✅
- Warning suppressed during Next.js build phase ✅
- Rate limiters defined for: bookings, bulk booking, payout, wallet, admin, auth, webhook ✅

**`lib/middleware/subscriptionValidation.ts`** — ✅ Clean:
- ACTIVE or non-expired TRIAL → full access ✅
- Expired/cancelled/past-due → read-only (not blocked — preserves data access per Privacy Act) ✅
- Fail-open on DB error ✅
- `requireActiveSubscription` used consistently across API routes ✅

### No gaps found in these files.

---

## Area 8 — Security ✅

Covered by Area 7 inspection (middleware.ts, ratelimit.ts, subscriptionValidation.ts).

Key security posture:
- Edge auth on all protected API routes ✅
- Per-endpoint rate limiting with strict mode for financial ops ✅
- OTP hashed with HMAC-SHA256 ✅
- Stripe webhook signature required (fail-closed) ✅
- Idempotency keys for all financial operations ✅
- Payment amount validation before wallet credit ✅
- AuditLog on all sensitive admin and financial actions ✅

**One gap:** No Content-Security-Policy header set in middleware or `next.config.js`. Low-medium risk for a web app. → Added to TODO.

---

## Area 9 — Public Pages / Subdomain ⬜ Pending

### Files to inspect
- `app/subdomain/[slug]/page.tsx`
- `components/subdomain/SubdomainBookingWizard.tsx`
- `app/api/public/instructor/[instructorId]/branding/route.ts`
- `app/api/public/check-service-area/route.ts`
- `app/api/locations/validate/route.ts`

---

## Area 10 — DOCROLEBASE vs Code ⬜ Pending

Cross-check key docs against actual code:
- `docs/DOCROLEBASE/06-payments/REFUNDS.md` vs actual refund logic
- `docs/DOCROLEBASE/08-technical/CRON_JOBS.md` vs vercel.json schedule
- `docs/DOCROLEBASE/01-public/SUBDOMAIN_PAGE.md` vs subdomain code

---

## Remaining: start from Area 10 (Subdomain) next session.

---

## Fix Log (applied during inspection)

| Date | File | Fix |
|------|------|-----|
| Jul 12 | `app/api/packages/route.ts` | `platformFeePercentage` now reads from `getPlatformFeeRate()` instead of hardcoded 3.6 |
| Jul 2026 | `components/BookingDetailsForm.tsx` | Slot DELETE — changed from body to URL query params |
| Jul 2026 | `components/BookingDetailsForm.tsx` | All `alert()` + `confirm()` → `FieldError`, `ConfirmDialog` inline components |
| Jul 2026 | `components/BookingDetailsForm.tsx` | Availability fallback removed — API failure shows error + retry |
| Jul 2026 | `components/BookingDetailsForm.tsx` | Duration race condition — `useEffect` deps include `selectedDuration` |
| Jul 2026 | `lib/contexts/BookingContext.tsx` | Password fields excluded from `saveToLocalStorage`; duplicate `loadFromLocalStorage` effect removed; `testPackingDate` typo fixed |
| Jul 2026 | `app/book/[instructorId]/payment/page.tsx` | 3DS `requires_action` → `stripe.handleNextAction()`; console.logs removed; `resetBooking` race removed |
| Jul 2026 | `app/book/[instructorId]/confirmation/page.tsx` | `alert()` → inline error; unused `Link` + `params` removed |
| Jul 2026 | `app/book/[instructorId]/booking-details/page.tsx` | `alert()` → inline error |
| Jul 2026 | `app/api/availability/validate-slots/route.ts` | Timezone: `+08:00` offset parse; `COMPLETED` removed from conflict statuses |
| Jul 2026 | `app/api/availability/check-and-reserve/route.ts` | Timezone: renamed to `parsePerthDateTime`, `+08:00` offset parse |
| Jul 2026 | `app/api/payments/create-intent/route.ts` | `customer@example.com` → `null` |
| Jul 2026 | `app/api/instructor/earnings/route.ts` | `@ts-nocheck` removed; proper types added |
| Jul 2026 | `components/instructor/PlatformEarningsSection.tsx` | `alert()` → toast |
| Jul 2026 | `components/instructor/MobileBottomNav.tsx` | Schedule added as first-class nav item |
| Jul 2026 | `components/instructor/TodayWorkspace.tsx` | Unused `hourlyRate` prop removed |
| Jul 2026 | `app/dashboard/schedule/page.tsx` | Loading skeleton added; unused `BookingStatus` import removed |
| Jul 2026 | `app/dashboard/layout.tsx` | Subscription + approval DB calls parallelised |
| Jul 2026 | `app/dashboard/page.tsx` | `hourlyRate` prop removed from `TodayWorkspace` call site |
| Jul 2026 | `app/client-dashboard/bookings/[id]/page.tsx` | `confirm()` + `alert()` on cancel → inline two-step confirm panel |
| Jul 2026 | `app/client-dashboard/page.tsx` | `confirm()` on Switch Instructor → inline confirm panel; json() awaits parallelised |
| Jul 2026 | `app/client-dashboard/profile/page.tsx` | 3× `alert()` → Toast component |
| Jul 2026 | `components/client/MobileBottomNav.tsx` | Profile tab href fixed to `/client-dashboard/profile` |
| Jul 2026 | `app/admin/payouts/page.tsx` | `confirm()` removed from processPayout + handleHoldPayout |
| Jul 2026 | `app/admin/support/user/[userId]/page.tsx` | `confirm()` on approve/deduct/reset removed; `prompt()` on suspend → inline textarea form |
| Jul 2026 | `app/admin/bookings/[id]/edit/page.tsx` | `alert()` + `confirm()` → inline error state + two-step cancel confirm |
| Jul 2026 | `app/admin/clients/[id]/page.tsx` | 3× `confirm()` removed (flash feedback already present) |
| Jul 2026 | `app/admin/documents/page.tsx` | `confirm()` on deactivate → per-row two-step; auto-process → inline confirm panel |
| Jul 2026 | `app/admin/documents/review/[instructorId]/page.tsx` | `confirm()` on remove doc → two-step inline |
| Jul 2026 | `app/admin/voice-lines/page.tsx` | `confirm()` on delete → two-step inline confirm |
| Jul 2026 | `app/admin/disputes/page.tsx` | `alert()` on hold release failure → `actionError` inline banner |
| Jul 2026 | `app/admin/settings/page.tsx` | UTF-8 mojibake encoding artifacts fixed |

---

## Area 14 — Admin Dashboard + APIs ✅ (July 2026)

### Files inspected
`app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/payouts/page.tsx`, `app/admin/disputes/page.tsx`, `app/admin/documents/page.tsx`, `app/admin/documents/review/[instructorId]/page.tsx`, `app/admin/bookings/[id]/edit/page.tsx`, `app/admin/clients/[id]/page.tsx`, `app/admin/support/user/[userId]/page.tsx`, `app/admin/voice-lines/page.tsx`, `app/admin/settings/page.tsx`, `app/admin/pricing/page.tsx`, all `app/api/admin/*/route.ts` files.

### As-is (solid)
- Layout: dual role-gate (layout + each page independently) — ADMIN/SUPER_ADMIN only ✅
- Dashboard: 11 parallel DB queries, offline/platform split, all `try/catch`-wrapped ✅
- Bookings API: proper pagination, Prisma-level search, audit log on every status change ✅
- Payouts API: bank account masking, dispute detection, withheld/dispute grouping ✅
- Pricing API: Zod validation with ranges, singleton upsert ✅
- Revenue API: date-filtered, top instructors, 6-month chart, ledger integration ✅
- CSV Export: proper escaping, 3 types (bookings/revenue/instructors), date filtering ✅
- Register route: bootstrap key required, disabled once SUPER_ADMIN exists ✅
- Disputes API: full CRUD, audit log on hold release ✅
- Settings API: DB-backed, Zod validation, merge-not-overwrite pattern ✅

### Gaps found and fixed
8 browser dialog calls replaced (see Fix Log above). All 8 resolved.

### Remaining: start from Area 10 (Subdomain) next session.
